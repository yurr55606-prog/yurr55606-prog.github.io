export const blackHoleVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const blackHoleFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uCinematicBase;
  uniform float uTime;
  uniform float uTravel;
  uniform vec2 uResolution;
  uniform vec2 uPointer;

  #define PI 3.14159265359
  #define BASE_ASPECT 1.7768331562

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(41.0, 289.0)));
    return fract(vec2(262144.0, 32768.0) * n);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.04 + 13.17;
      amplitude *= 0.5;
    }
    return value;
  }

  float particleLayer(vec2 p, float seed) {
    vec2 id = floor(p);
    vec2 gv = fract(p) - 0.5;
    vec2 random = hash22(id + seed * 17.31);
    vec2 offset = (random - 0.5) * 0.74;
    float radius = mix(0.026, 0.090, random.y * random.y);
    float particle = 1.0 - smoothstep(radius, radius + 0.045, length(gv - offset));
    return particle * step(0.74, random.x) * (0.28 + random.y * 0.72);
  }

  float photonDustLayer(vec2 p, float seed) {
    vec2 id = floor(p);
    vec2 gv = fract(p) - 0.5;
    vec2 random = hash22(id + seed * 19.73);
    vec2 offset = (random - 0.5) * 0.70;
    vec2 local = gv - offset;
    float radius = mix(0.030, 0.086, random.y * random.y);
    float core = exp(-dot(local, local) / max(radius * radius, 0.0001));
    float tailLength = mix(0.12, 0.32, random.x);
    float behind = max(-local.x, 0.0);
    float tail = exp(-abs(local.y) / max(radius * 0.58, 0.008))
      * exp(-behind / tailLength) * step(local.x, 0.035);
    return (core + tail * 0.24) * step(0.69, random.x) * (0.45 + random.y * 0.70);
  }

  vec2 coverUv(vec2 uv, float viewAspect) {
    vec2 covered = uv;
    if (viewAspect > BASE_ASPECT) {
      float visibleHeight = BASE_ASPECT / viewAspect;
      // 将事件视界从偏右位置移到画面约 54% 处，静态构图与穿越中心共用同一映射。
      covered.x = (uv.x - 0.5) * 0.86 + 0.553;
      covered.y = (uv.y - 0.5) * visibleHeight * 0.96 + 0.5;
    } else {
      float visibleWidth = viewAspect / BASE_ASPECT;
      // 窄屏围绕事件视界中心裁切，使主体和穿越中心始终保持在画面中央。
      covered.x = 0.587 + (uv.x - 0.5) * visibleWidth * 0.96;
      covered.y = (uv.y - 0.5) * 0.96 + 0.5;
    }
    return covered;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    float time = uTime * 0.46;
    vec2 baseUv = coverUv(vUv, aspect);
    baseUv += vec2(uPointer.x * 0.0048, -uPointer.y * 0.0034) * (1.0 - uTravel);

    // 以生成的摄影级底片为真实物质基础，只施加亚像素级流动，避免“贴图滑动”感。
    float broadFlow = fbm(vec2(baseUv.x * 5.2 - time * 0.42, baseUv.y * 14.0 + time * 0.11));
    float fineFlow = fbm(vec2(baseUv.x * 14.0 - time * 0.92, baseUv.y * 42.0 + broadFlow * 2.6));
    vec2 flowOffset = vec2(
      (broadFlow - 0.5) * 0.0092 + sin(time * 0.38) * 0.0018,
      (fineFlow - 0.5) * 0.0042
    );

    // 静态主体与转场共用同一个精确中心；宽高按源图比例校正为真实圆形度量。
    vec2 horizonUv = vec2(0.587, 0.505);
    vec2 fromHorizon = vec2((baseUv.x - horizonUv.x) * BASE_ASPECT, baseUv.y - horizonUv.y);
    float horizonDistance = length(fromHorizon);
    float travelPhase = clamp(uTravel, 0.0, 1.0);
    float travelZoom = mix(1.0, 0.085, smoothstep(0.0, 1.0, travelPhase));
    float travelSpin = travelPhase * travelPhase * 0.105;
    mat2 travelRotation = mat2(cos(travelSpin), -sin(travelSpin), sin(travelSpin), cos(travelSpin));
    vec2 warpedMetric = travelRotation * fromHorizon * travelZoom;
    vec2 warpedUv = horizonUv + vec2(warpedMetric.x / BASE_ASPECT, warpedMetric.y);
    // 事件视界与贴边光子环保持严格圆形；只让外层光云和盘面承受噪声位移。
    float warpedRadius = length(warpedMetric);
    float deformableMatter = smoothstep(0.225, 0.325, warpedRadius);
    vec2 sampleUv = clamp(
      warpedUv + flowOffset * deformableMatter * (1.0 - travelPhase),
      0.001,
      0.999
    );
    vec2 sampleMetric = vec2((sampleUv.x - horizonUv.x) * BASE_ASPECT, sampleUv.y - horizonUv.y);
    float sampleRadius = length(sampleMetric);
    float sampleAngle = atan(sampleMetric.y, sampleMetric.x);
    float foregroundDiskCoordinate = sampleMetric.y - sampleMetric.x * 0.18 + 0.045;
    float diskAlong = sampleMetric.x + sampleMetric.y * 0.18;
    float textureEdgeGuard = smoothstep(0.010, 0.042, sampleUv.x)
      * smoothstep(0.010, 0.042, 1.0 - sampleUv.x)
      * smoothstep(0.008, 0.036, sampleUv.y)
      * smoothstep(0.008, 0.036, 1.0 - sampleUv.y);

    vec3 staticBase = texture2D(uCinematicBase, sampleUv).rgb;
    vec2 radialUv = vec2(warpedMetric.x / BASE_ASPECT, warpedMetric.y);
    vec3 radialBlurA = texture2D(uCinematicBase, clamp(horizonUv + radialUv * (1.0 + travelPhase * 0.055), 0.001, 0.999)).rgb;
    vec3 radialBlurB = texture2D(uCinematicBase, clamp(horizonUv + radialUv * (1.0 + travelPhase * 0.115), 0.001, 0.999)).rgb;
    staticBase = mix(staticBase, staticBase * 0.48 + radialBlurA * 0.31 + radialBlurB * 0.21, travelPhase * 0.78);
    float staticLuminance = dot(staticBase, vec3(0.2126, 0.7152, 0.0722));
    float staticWarmth = smoothstep(0.018, 0.38, staticBase.r - staticBase.b * 0.50);

    // 下方吸积盘沿切线方向连续平流；两组采样交叉淡化，循环时不会出现跳帧。
    float diskPhase = fract(time * 0.52);
    vec2 diskDirection = normalize(vec2(1.0, 0.18));
    vec2 diskNormal = normalize(vec2(-0.18, 1.0));
    float diskShear = mix(0.72, 1.38, smoothstep(-0.135, 0.105, foregroundDiskCoordinate));
    float diskWarpNoise = noise(vec2(diskAlong * 8.0 - time * 0.42, foregroundDiskCoordinate * 34.0 + time * 0.16)) - 0.5;
    float diskTravel = 0.072 * diskShear;
    vec2 diskWarp = diskNormal * diskWarpNoise * 0.005;
    vec2 diskUvA = clamp(sampleUv - diskDirection * diskPhase * diskTravel + diskWarp, 0.001, 0.999);
    vec2 diskUvB = clamp(sampleUv - diskDirection * (diskPhase - 1.0) * diskTravel + diskWarp, 0.001, 0.999);
    vec3 diskPrimary = mix(texture2D(uCinematicBase, diskUvA).rgb, texture2D(uCinematicBase, diskUvB).rgb, diskPhase);

    float diskPhaseFine = fract(time * 0.79 + 0.31);
    float fineTravel = 0.034 * (1.15 - diskShear * 0.18);
    vec2 diskFineWarp = diskNormal * (noise(vec2(diskAlong * 17.0 + time * 0.31, foregroundDiskCoordinate * 63.0)) - 0.5) * 0.003;
    vec2 diskFineUvA = clamp(sampleUv - diskDirection * diskPhaseFine * fineTravel + diskFineWarp, 0.001, 0.999);
    vec2 diskFineUvB = clamp(sampleUv - diskDirection * (diskPhaseFine - 1.0) * fineTravel + diskFineWarp, 0.001, 0.999);
    vec3 diskSecondary = mix(
      texture2D(uCinematicBase, diskFineUvA).rgb,
      texture2D(uCinematicBase, diskFineUvB).rgb,
      diskPhaseFine
    );
    vec3 flowingDisk = mix(diskPrimary, diskSecondary, 0.24);

    // 上方光云围绕视界中心弯曲输送，模拟引力透镜中的物质绕行。
    float arcPhase = fract(time * 0.38);
    float arcTravel = 0.115;
    float arcAngleA = arcPhase * arcTravel;
    float arcAngleB = (arcPhase - 1.0) * arcTravel;
    mat2 arcRotationA = mat2(cos(arcAngleA), -sin(arcAngleA), sin(arcAngleA), cos(arcAngleA));
    mat2 arcRotationB = mat2(cos(arcAngleB), -sin(arcAngleB), sin(arcAngleB), cos(arcAngleB));
    vec2 arcMetricA = arcRotationA * sampleMetric;
    vec2 arcMetricB = arcRotationB * sampleMetric;
    vec2 arcUvA = clamp(horizonUv + vec2(arcMetricA.x / BASE_ASPECT, arcMetricA.y), 0.001, 0.999);
    vec2 arcUvB = clamp(horizonUv + vec2(arcMetricB.x / BASE_ASPECT, arcMetricB.y), 0.001, 0.999);
    vec3 flowingArc = mix(texture2D(uCinematicBase, arcUvA).rgb, texture2D(uCinematicBase, arcUvB).rgb, arcPhase);

    float movableMatter = staticWarmth * smoothstep(0.012, 0.42, staticLuminance)
      * (1.0 - smoothstep(0.70, 0.98, staticLuminance));
    float foregroundDiskMask = 1.0 - smoothstep(0.052, 0.116, abs(foregroundDiskCoordinate));
    float haloRadialMask = smoothstep(0.285, 0.335, sampleRadius)
      * (1.0 - smoothstep(0.415, 0.505, sampleRadius));
    // 盘面附近的外圈光云使用带低频扰动的宽羽化遮挡，避免左右两侧出现笔直截断线。
    float occlusionFeatherNoise = fbm(vec2(
      diskAlong * 3.2 - time * 0.12,
      sampleRadius * 9.0 + time * 0.04
    )) - 0.5;
    float haloDiskDistance = abs(foregroundDiskCoordinate) + occlusionFeatherNoise * 0.055;
    float haloDiskOcclusion = smoothstep(0.025, 0.210, haloDiskDistance);
    float darkDiskLuma = smoothstep(0.001, 0.035, staticLuminance);
    float darkDiskWarmth = smoothstep(0.0005, 0.045, staticBase.r - staticBase.b * 0.72);
    float darkDiskMatter = max(darkDiskLuma * (0.35 + darkDiskWarmth * 0.65), movableMatter);
    // 前景盘只在事件视界之外平流；内部改用独立的柔和光流，避免把盘面纹理硬拖进黑洞。
    float outsideHorizon = smoothstep(0.196, 0.224, sampleRadius);
    float diskFlowMask = foregroundDiskMask * textureEdgeGuard * darkDiskMatter * outsideHorizon;
    float arcFlowMask = movableMatter * haloRadialMask * haloDiskOcclusion * textureEdgeGuard;
    vec3 base = mix(staticBase, flowingDisk, diskFlowMask * 0.90);
    base = mix(base, flowingArc, arcFlowMask * 0.91);

    vec3 upstream = texture2D(uCinematicBase, clamp(sampleUv - vec2(0.0045, -0.0014), 0.001, 0.999)).rgb;
    vec3 downstream = texture2D(uCinematicBase, clamp(sampleUv + vec2(0.0032, -0.0010), 0.001, 0.999)).rgb;

    float luminance = dot(base, vec3(0.2126, 0.7152, 0.0722));
    float warmth = smoothstep(0.025, 0.42, base.r - base.b * 0.54);
    float materialMask = warmth * smoothstep(0.018, 0.60, luminance);
    float blurAwayFromHorizon = smoothstep(0.225, 0.275, sampleRadius);
    vec3 color = mix(
      base,
      (base * 0.70 + upstream * 0.18 + downstream * 0.12),
      materialMask * blurAwayFromHorizon * 0.56
    );
    color += max(flowingDisk - staticBase, 0.0) * diskFlowMask * 0.26;
    color += max(flowingArc - staticBase, 0.0) * arcFlowMask * 0.28;

    // 方向性亮团沿红线标注方向运动：外圈逆时针，前景盘从左向右。
    float haloClumpNoise = noise(vec2(sampleRadius * 21.0, sampleAngle * 3.2 + time * 0.18));
    float haloMovingClumps = pow(
      0.5 + 0.5 * sin(sampleAngle * 11.0 - time * 2.25 + haloClumpNoise * 4.2),
      13.0
    );
    float haloClumpMask = haloRadialMask * haloDiskOcclusion
      * smoothstep(0.055, 0.58, luminance) * (1.0 - travelPhase);
    color += vec3(1.08, 0.78, 0.50) * haloMovingClumps * haloClumpMask * 0.13;

    float diskClumpNoise = noise(vec2(diskAlong * 24.0 - time * 0.85, foregroundDiskCoordinate * 46.0));
    float diskMovingClumps = pow(
      0.5 + 0.5 * sin(diskAlong * 72.0 - time * 4.8 + diskClumpNoise * 3.6),
      15.0
    );
    float diskFineFilaments = pow(
      0.5 + 0.5 * sin(diskAlong * 118.0 - time * 7.1 + diskWarpNoise * 5.0),
      24.0
    );
    float diskEmissionMask = diskFlowMask * smoothstep(0.006, 0.38, luminance);
    color += vec3(1.05, 0.46, 0.12) * diskMovingClumps * diskEmissionMask * 0.15;
    color += vec3(0.88, 0.31, 0.075) * diskFineFilaments * diskEmissionMask * 0.055;

    // 多尺度体积云雾随平流缓慢翻卷，给吸积盘增加厚度而不覆盖真实纹理。
    float volumeCloudA = fbm(vec2(baseUv.x * 3.7 - time * 0.48, baseUv.y * 9.2 + time * 0.13));
    float volumeCloudB = fbm(vec2(baseUv.x * 7.8 - time * 0.92, baseUv.y * 18.0 - time * 0.20));
    float volumeCloud = smoothstep(0.48, 0.90, volumeCloudA * 0.68 + volumeCloudB * 0.42);
    float volumeMask = diskFlowMask * 0.56 + movableMatter * arcFlowMask * 0.86;
    color += vec3(0.82, 0.46, 0.20) * volumeCloud * volumeMask * 0.16;

    // 细微的亮暗脉动只发生在吸积盘物质上，事件视界仍保持绝对黑。
    float plasmaPulse = 0.965 + 0.055 * sin(time * 0.82 + broadFlow * 8.0);
    color *= mix(1.0, plasmaPulse, materialMask);
    color += vec3(0.46, 0.115, 0.028) * materialMask * pow(max(fineFlow - 0.50, 0.0), 2.2) * 0.26;

    // 粒子沿盘的倾斜方向高速流过，数量克制，避免变成雪花星空。
    vec2 particleUv = vec2(
      baseUv.x * 48.0 - time * 1.72,
      (baseUv.y + baseUv.x * 0.18) * 96.0 + broadFlow * 3.0
    );
    float particles = particleLayer(particleUv, 2.4);
    particles += particleLayer(particleUv * 1.61 + 12.7, 7.1) * 0.48;
    float particleMask = materialMask * staticWarmth * smoothstep(0.08, 0.58, luminance)
      * (1.0 - smoothstep(0.58, 0.72, baseUv.y));
    color += vec3(1.18, 0.64, 0.25) * particles * particleMask * 0.38;

    // 柔光光子具有随机大小与极短拖尾，分别以不同速度穿过盘面，避免规则排列。
    vec2 dustUv = vec2(
      baseUv.x * 18.0 - time * 1.92,
      (baseUv.y + baseUv.x * 0.18) * 34.0 + broadFlow * 2.4
    );
    float photonDust = photonDustLayer(dustUv, 3.4);
    photonDust += photonDustLayer(dustUv * vec2(1.74, 1.52) + vec2(-time * 1.8, 8.6), 9.8) * 0.56;
    photonDust += photonDustLayer(dustUv * vec2(0.62, 0.72) + vec2(-time * 0.7, -4.3), 17.1) * 0.34;
    float geometricDiskMask = staticWarmth * (1.0 - smoothstep(0.59, 0.74, baseUv.y));
    float dustCloudMask = geometricDiskMask * 0.86
      * smoothstep(0.018, 0.38, luminance) * (0.42 + volumeCloud * 0.58);
    color += vec3(1.34, 1.02, 0.70) * photonDust * dustCloudMask * 0.90;

    // 对白热区域做低成本多采样光晕，保留事件视界内部的纯黑。
    vec2 glowStepA = vec2(0.0055, 0.0);
    vec2 glowStepB = vec2(0.0, 0.0055);
    vec3 softGlow = texture2D(uCinematicBase, clamp(sampleUv + glowStepA, 0.001, 0.999)).rgb;
    softGlow += texture2D(uCinematicBase, clamp(sampleUv - glowStepA, 0.001, 0.999)).rgb;
    softGlow += texture2D(uCinematicBase, clamp(sampleUv + glowStepB, 0.001, 0.999)).rgb;
    softGlow += texture2D(uCinematicBase, clamp(sampleUv - glowStepB, 0.001, 0.999)).rgb;
    softGlow *= 0.25;
    float glowLuminance = dot(softGlow, vec3(0.2126, 0.7152, 0.0722));
    float sourceAttachment = smoothstep(0.008, 0.13, staticLuminance + glowLuminance * 0.08);
    float glowMask = smoothstep(0.10, 0.72, glowLuminance) * sourceAttachment;
    color += softGlow * vec3(1.07, 0.91, 0.79) * glowMask * 0.31;

    // 高亮边缘产生很轻的流向拖影，模拟长曝光而不模糊原始纹理。
    float upstreamLight = dot(upstream, vec3(0.333));
    float downstreamLight = dot(downstream, vec3(0.333));
    float directionalGlow = max(upstreamLight - downstreamLight, 0.0) * materialMask;
    color += vec3(0.94, 0.55, 0.28) * directionalGlow * 0.20;

    // 整个光圈的逆时针差速环流：内圈快、外圈慢，三层螺旋发射纹以不同速度叠加。
    // angle 的整数频率保证 ±PI 接缝连续；只调制原纹理亮度，不改变圆形几何。
    float haloRadiusProgress = clamp((sampleRadius - 0.198) / 0.315, 0.0, 1.0);
    float haloOrbitalRate = mix(0.62, 0.20, smoothstep(0.0, 1.0, haloRadiusProgress));
    float haloLogRadius = log(max(sampleRadius / 0.198, 1.001));
    float haloNoiseRotation = -time * 0.11;
    mat2 haloNoiseMatrix = mat2(
      cos(haloNoiseRotation), -sin(haloNoiseRotation),
      sin(haloNoiseRotation), cos(haloNoiseRotation)
    );
    vec2 haloNoiseMetric = haloNoiseMatrix * sampleMetric;
    float haloFlowNoise = fbm(
      haloNoiseMetric * vec2(19.0, 27.0) + vec2(time * 0.13, -time * 0.07)
    );
    float haloSpiralA = 0.5 + 0.5 * sin(
      (sampleAngle - time * haloOrbitalRate) * 7.0
      + haloLogRadius * 18.0 + haloFlowNoise * 3.2
    );
    float haloSpiralB = 0.5 + 0.5 * sin(
      (sampleAngle - time * haloOrbitalRate * 0.82) * 13.0
      + haloLogRadius * 36.0 - haloFlowNoise * 2.8
    );
    float haloSpiralC = 0.5 + 0.5 * sin(
      (sampleAngle - time * haloOrbitalRate * 1.27) * 21.0
      + haloLogRadius * 58.0 + haloFlowNoise * 4.2
    );
    float fullHaloFlow = pow(haloSpiralA, 4.5) * 0.56
      + pow(haloSpiralB, 7.0) * 0.29
      + pow(haloSpiralC, 11.0) * 0.15;
    float fullHaloRadialMask = smoothstep(0.198, 0.224, sampleRadius)
      * (1.0 - smoothstep(0.435, 0.515, sampleRadius));
    float fullHaloMaterial = staticWarmth * smoothstep(0.022, 0.62, staticLuminance);
    float fullHaloFlowMask = fullHaloRadialMask * fullHaloMaterial
      * haloDiskOcclusion * textureEdgeGuard * (1.0 - travelPhase);
    float haloBrightnessFlow = 0.925 + fullHaloFlow * 0.190;
    color = mix(color, color * haloBrightnessFlow, fullHaloFlowMask * 0.88);
    vec3 haloFlowColor = mix(
      vec3(1.10, 0.79, 0.45),
      vec3(0.66, 0.245, 0.060),
      haloRadiusProgress
    );
    color += haloFlowColor * fullHaloFlowMask * fullHaloFlow * 0.115;

    // 黑色核心保持底片原生边界，不再叠加整圈内缘补光；运动只存在于盘面与局部雾流。
    float innerInterior = 1.0 - smoothstep(0.198, 0.210, sampleRadius);

    // 图二式的半透明暖色光幕从盘面向内缘抬升，填掉死黑空洞但不越过核心。
    float innerDiskMist = exp(-pow((foregroundDiskCoordinate + 0.018) / 0.118, 2.0));
    float innerMistFlow = 0.58 + 0.42 * fbm(vec2(
      diskAlong * 11.0 - time * 0.68,
      foregroundDiskCoordinate * 23.0 + time * 0.13
    ));
    float innerMistMask = innerInterior
      * smoothstep(0.070, 0.170, sampleRadius)
      * innerDiskMist * (1.0 - travelPhase);
    color += vec3(0.46, 0.155, 0.036) * innerMistMask * innerMistFlow * 0.090;

    // 黑洞中部的低亮流丝沿盘面方向输送，并在真实前景盘附近自动让开。
    float middleFlowNoise = fbm(vec2(
      diskAlong * 16.0 - time * 0.86,
      foregroundDiskCoordinate * 31.0 + time * 0.14
    ));
    float middleFlowStrands = smoothstep(0.47, 0.78, middleFlowNoise);
    float middleFlowBand = exp(-pow((foregroundDiskCoordinate + 0.012) / 0.165, 2.0));
    float awayFromDiskSurface = smoothstep(0.034, 0.086, abs(foregroundDiskCoordinate));
    float middleFlowMask = innerInterior
      * smoothstep(0.040, 0.165, sampleRadius)
      * middleFlowBand * awayFromDiskSurface * (1.0 - travelPhase);
    color += vec3(0.52, 0.175, 0.040)
      * middleFlowMask * (0.045 + middleFlowStrands * 0.125);

    // 事件视界前方的暗盘使用独立光丝继续从左向右流动。
    // 不再挪动底片纹理，因此不会在黑色核心内产生灰块或拉伸接缝。
    float innerDiskDepthBand = exp(-pow((foregroundDiskCoordinate + 0.068) / 0.052, 2.0));
    float innerDiskSurfaceMask = innerDiskDepthBand
      * (1.0 - outsideHorizon)
      * smoothstep(0.052, 0.145, sampleRadius)
      * (1.0 - travelPhase);
    float innerDiskLaneNoise = fbm(vec2(
      diskAlong * 12.0 - time * 0.74,
      foregroundDiskCoordinate * 52.0 + time * 0.09
    ));
    float innerDiskLanes = pow(
      0.5 + 0.5 * sin(
        foregroundDiskCoordinate * 92.0
        + innerDiskLaneNoise * 5.2
        - time * 0.32
      ),
      8.5
    );
    float innerDiskPulse = pow(
      0.5 + 0.5 * sin(
        diskAlong * 58.0 - time * 5.1 + innerDiskLaneNoise * 3.8
      ),
      7.0
    );
    float innerDiskThreads = innerDiskLanes * (0.28 + innerDiskPulse * 0.72);
    color += vec3(0.70, 0.245, 0.055)
      * innerDiskSurfaceMask * (0.026 + innerDiskLaneNoise * 0.040);
    color += vec3(1.04, 0.52, 0.16)
      * innerDiskSurfaceMask * innerDiskThreads * 0.155;

    // 从已有光带向外径向抽取真实纹理，扩大物质厚度；不绘制新的几何圆环。
    vec2 lensMetric = sampleMetric;
    float lensRadius = sampleRadius;
    vec2 lensDirection = lensMetric / max(lensRadius, 0.0001);
    float pulledRadiusA = max(lensRadius - 0.042, 0.0);
    float pulledRadiusB = max(lensRadius - 0.074, 0.0);
    vec2 haloUvA = horizonUv + vec2(lensDirection.x * pulledRadiusA / BASE_ASPECT, lensDirection.y * pulledRadiusA);
    vec2 haloUvB = horizonUv + vec2(lensDirection.x * pulledRadiusB / BASE_ASPECT, lensDirection.y * pulledRadiusB);
    vec3 radialHaloA = texture2D(uCinematicBase, clamp(haloUvA, 0.001, 0.999)).rgb;
    vec3 radialHaloB = texture2D(uCinematicBase, clamp(haloUvB, 0.001, 0.999)).rgb;
    vec3 radialHalo = max(radialHaloA, radialHaloB * 0.78);
    float radialHaloLuma = dot(radialHalo, vec3(0.2126, 0.7152, 0.0722));
    float outerHaloZone = smoothstep(0.245, 0.285, lensRadius)
      * (1.0 - smoothstep(0.405, 0.515, lensRadius));
    float radialHaloMask = smoothstep(0.24, 0.72, radialHaloLuma) * outerHaloZone;
    color += radialHalo * vec3(1.05, 0.91, 0.76) * radialHaloMask * 0.14;

    // 穿越阶段的放射光丝保持与视界中心一致。
    float angle = atan(fromHorizon.y, fromHorizon.x);
    float rayNoise = fbm(vec2(angle * 7.0 - time * 0.22, time * 0.34));
    float rays = pow(max(0.0, sin(angle * 37.0 + rayNoise * 12.0)), 30.0);
    rays *= smoothstep(0.52, 0.78, rayNoise);
    rays *= smoothstep(0.06, 0.84, horizonDistance) / (0.13 + horizonDistance);
    color += mix(vec3(0.78, 0.21, 0.045), vec3(1.26, 1.06, 0.86), hash21(vec2(floor(angle * 100.0), 1.0)))
      * rays * uTravel * uTravel * 0.58;
    color += vec3(1.18, 0.86, 0.58) * pow(uTravel, 5.0) * exp(-horizonDistance * 2.9) * 1.50;

    // 电影式色彩控制：保留深铜物质，高光回到参考图的象牙白与浅金。
    float gradedLuminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 neutralMatter = vec3(gradedLuminance) * vec3(1.07, 1.015, 0.985);
    float highlightNeutral = smoothstep(0.22, 0.86, gradedLuminance) * 0.30;
    color = mix(color, neutralMatter, materialMask * 0.16 + highlightNeutral * 0.24);
    vec3 copperGold = vec3(color.r * 0.92, color.g + color.r * 0.20, color.b + color.r * 0.12);
    color = mix(color, copperGold, materialMask * 0.34 * (1.0 - highlightNeutral));
    color *= vec3(1.02, 0.995, 0.96);
    float vignette = 1.0 - smoothstep(0.28, 1.30, length((vUv * 2.0 - 1.0) * vec2(0.67, 0.88)));
    color *= 0.78 + vignette * 0.22;
    color = pow(max(color * 1.05, 0.0), vec3(0.91));

    gl_FragColor = vec4(color, 1.0);
  }
`;
