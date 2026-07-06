export const librarySpaceVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

export const librarySpaceFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uMaxSteps;
  uniform float uDepth;

  #define MAX_STEPS 56
  #define FAR_CLIP 84.0

  mat2 rotate2d(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float hash11(float p) {
    return fract(sin(p * 127.1) * 43758.5453123);
  }

  float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float sdBoxFrame(vec3 p, vec3 b, float e) {
    p = abs(p) - b;
    vec3 q = abs(p + e) - e;
    return min(
      min(
        length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
        length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)
      ),
      length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0)
    );
  }

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  vec2 shelfModule(vec3 p, float phase) {
    float sectionSize = 4.4;
    float section = floor((p.z + sectionSize * 0.5) / sectionSize);
    float seedA = hash11(section + phase * 11.7);
    float seedB = hash11(section * 1.91 + phase * 7.3);
    vec3 q = p;
    q.z = mod(q.z + sectionSize * 0.5, sectionSize) - sectionSize * 0.5;
    // 每一层代表一个不同时间截面：轻微错位、旋转，避免普通建筑隧道的机械重复。
    q.x += (seedA - 0.5) * 0.95;
    q.y += (seedB - 0.5) * 0.62;
    q.x += sin(uTime * 0.105 + section * 1.17 + phase) * 0.11;
    q.y += cos(uTime * 0.082 + section * 0.91 + phase) * 0.075;
    q.xy *= rotate2d(
      (seedA - 0.5) * 0.11
      + sin(section * 0.73 + phase) * 0.02
      + sin(uTime * 0.061 + section) * 0.006
    );

    float outer = sdBoxFrame(q, vec3(8.4, 5.45, 0.46), 0.19);
    float shelfGap = 0.79 + seedB * 0.19;
    float shelfY = mod(q.y + 5.28, shelfGap) - shelfGap * 0.5;
    float shelfCellX = mod(q.x + 8.1, 3.45) - 1.725;
    float shelfHalfWidth = 1.43 + seedA * 0.12;
    float shelves = sdBox(vec3(shelfCellX, shelfY, q.z), vec3(shelfHalfWidth, 0.062, 0.36));
    float majorGap = shelfGap * 3.0;
    float majorShelfY = mod(q.y + 5.2, majorGap) - majorGap * 0.5;
    float majorShelves = sdBox(vec3(q.x, majorShelfY, q.z), vec3(8.22, 0.15, 0.42));
    float railX = mod(q.x + 8.1, 3.45) - 1.725;
    float uprights = sdBox(vec3(railX, q.y, q.z), vec3(0.09, 5.25, 0.4));

    // 成排书脊：每本书的宽度、高度都略有差异，只生长在两侧书架中。
    float bookIndex = floor((q.x + 8.2) / 0.17);
    float bookSeed = hash11(bookIndex + section * 19.3 + phase * 5.7);
    float bookX = mod(q.x + 8.2, 0.17) - 0.085;
    float bookRowY = mod(q.y + 5.28, shelfGap) - shelfGap * 0.5;
    float bookHalfHeight = shelfGap * (0.19 + bookSeed * 0.11);
    float bookOffsetY = (bookSeed - 0.5) * shelfGap * 0.1;
    float books = sdBox(
      vec3(bookX, bookRowY - bookOffsetY, q.z + 0.08),
      vec3(0.044 + bookSeed * 0.012, bookHalfHeight, 0.19)
    );
    books = max(books, 3.0 - abs(q.x));

    // 避开中央视线，形成贯穿每个模块的深井。
    vec2 openingShift = vec2((seedB - 0.5) * 1.0, (seedA - 0.5) * 0.6);
    float opening = sdBox(vec3(q.x - openingShift.x, q.y - openingShift.y, 0.0), vec3(2.75 + seedA * 0.45, 1.85 + seedB * 0.34, 2.6));
    shelves = max(shelves, -opening);
    majorShelves = max(majorShelves, -opening);
    uprights = max(uprights, -opening);
    books = max(books, -opening);

    float depthRailX = mod(q.x + 8.0, 3.35) - 1.675;
    float depthRailY = mod(q.y + 5.2, 2.65) - 1.325;
    float depthRails = sdBox(vec3(depthRailX, depthRailY, p.z), vec3(0.038, 0.038, 48.0));
    float railBounds = sdBox(vec3(p.x, p.y, 0.0), vec3(8.25, 5.3, 60.0));
    depthRails = max(depthRails, railBounds);
    depthRails = max(depthRails, -sdBox(vec3(p.x, p.y, 0.0), vec3(2.55, 1.82, 60.0)));

    float structureD = min(min(outer, shelves), min(majorShelves, min(uprights, depthRails)));
    float d = min(structureD, books);
    float material = 1.0 + mod(section + phase * 3.0, 4.0) * 0.13;
    if (books < structureD) material = 3.65;
    return vec2(d, material);
  }

  vec2 macroFrames(vec3 p) {
    // 三个巨型框体分别落在 YZ / XZ 平面，负责建立真正的多轴空间尺度。
    vec3 leftP = vec3(p.y + 0.25, p.z + 18.5, p.x + 5.0);
    leftP.xy *= rotate2d(-0.055);
    float leftOuter = sdBoxFrame(leftP, vec3(4.85, 8.0, 0.72), 0.27);
    float leftMid = sdBoxFrame(leftP, vec3(4.05, 6.68, 0.75), 0.22);
    float leftInner = sdBoxFrame(leftP, vec3(3.25, 5.35, 0.78), 0.19);
    float leftCore = sdBoxFrame(leftP, vec3(2.42, 4.0, 0.8), 0.15);

    vec3 upperP = vec3(p.x - 2.0, p.z + 24.0, p.y - 4.15);
    upperP.xy *= rotate2d(0.075);
    float upperOuter = sdBoxFrame(upperP, vec3(6.4, 8.4, 0.68), 0.3);
    float upperMid = sdBoxFrame(upperP, vec3(5.38, 7.02, 0.71), 0.24);
    float upperInner = sdBoxFrame(upperP, vec3(4.35, 5.65, 0.74), 0.2);
    float upperCore = sdBoxFrame(upperP, vec3(3.3, 4.28, 0.77), 0.16);

    vec3 lowerP = vec3(p.x + 2.5, p.z + 30.0, p.y + 4.35);
    lowerP.xy *= rotate2d(-0.09);
    float lowerOuter = sdBoxFrame(lowerP, vec3(6.0, 7.6, 0.7), 0.29);
    float lowerMid = sdBoxFrame(lowerP, vec3(4.95, 6.3, 0.73), 0.23);
    float lowerInner = sdBoxFrame(lowerP, vec3(3.9, 5.0, 0.76), 0.2);

    vec3 crossA = p - vec3(-0.45, 0.25, -18.0);
    crossA.xy *= rotate2d(-0.035);
    float crossAX = sdBox(crossA, vec3(7.2, 0.2, 0.34));
    float crossAY = sdBox(crossA, vec3(0.2, 5.1, 0.34));
    float crossAZ = sdBox(crossA, vec3(0.22, 0.22, 9.0));

    vec3 crossB = p - vec3(2.8, -1.65, -31.0);
    crossB.xy *= rotate2d(0.08);
    float crossBX = sdBox(crossB, vec3(5.6, 0.17, 0.3));
    float crossBY = sdBox(crossB, vec3(0.17, 4.0, 0.3));
    float crossBZ = sdBox(crossB, vec3(0.19, 0.19, 7.4));

    float leftFrames = min(min(leftOuter, leftMid), min(leftInner, leftCore));
    float upperFrames = min(min(upperOuter, upperMid), min(upperInner, upperCore));
    float lowerFrames = min(min(lowerOuter, lowerMid), lowerInner);
    float frames = min(leftFrames, min(upperFrames, lowerFrames));
    float crossBeams = min(min(crossAX, crossAY), min(crossAZ, min(crossBX, min(crossBY, crossBZ))));
    float d = min(frames, crossBeams);
    return vec2(d, 2.75);
  }

  vec2 mapScene(vec3 p) {
    vec3 mainP = p;
    mainP.xy *= rotate2d(-0.055);
    vec2 mainShelf = shelfModule(mainP, 0.4);

    vec3 xP = vec3(p.z + 11.0, p.y - 1.5, p.x + 4.2);
    xP.xy *= rotate2d(0.08);
    vec2 xShelf = shelfModule(xP, 2.1);

    vec3 yP = vec3(p.x - 3.4, p.z + 13.0, p.y - 4.0);
    yP.xy *= rotate2d(-0.1);
    vec2 yShelf = shelfModule(yP, 4.3);

    vec3 downP = vec3(p.x + 3.2, p.z + 16.0, -p.y - 4.5);
    downP.xy *= rotate2d(0.085);
    vec2 downShelf = shelfModule(downP, 5.7);

    // 在主书架内部挖出三个互相穿越的体积，让 X/Y/Z 方向都能真正延伸。
    // 分支本身会立即填补这些空间，因此不会露出普通星空或空洞背景。
    float branchGate = smoothstep(1.0, 7.0, -p.z);
    float xVoid = sdBox(vec3(p.x + 5.25, p.y - 0.15, p.z + 26.0), vec3(4.15, 4.55, 21.0));
    float upVoid = sdBox(vec3(p.x - 2.8, p.y - 4.35, p.z + 31.0), vec3(4.0, 3.7, 18.0));
    float downVoid = sdBox(vec3(p.x + 2.4, p.y + 4.5, p.z + 34.0), vec3(4.25, 3.6, 17.0));
    float carve = min(xVoid, min(upVoid, downVoid));
    float carveField = -carve + (1.0 - branchGate) * 5.0;
    mainShelf.x = max(mainShelf.x, carveField);
    // 主通道只保留镜头附近的包裹感；深处让位给互相垂直的分支巨构。
    mainShelf.x += smoothstep(7.0, 15.0, -p.z) * 1.8;

    vec2 result = mainShelf;
    float xMask = 1.0 - smoothstep(-0.35, 1.2, p.x);
    float upMask = smoothstep(0.35, 1.8, p.y);
    float downMask = 1.0 - smoothstep(-1.8, -0.35, p.y);
    float xDistance = mix(8.0, xShelf.x, branchGate * xMask);
    float yDistance = mix(8.0, yShelf.x, branchGate * upMask);
    float downDistance = mix(8.0, downShelf.x, branchGate * downMask);
    if (xDistance < result.x) result = vec2(xDistance, xShelf.y + 0.35);
    if (yDistance < result.x) result = vec2(yDistance, yShelf.y + 0.7);
    if (downDistance < result.x) result = vec2(downDistance, downShelf.y + 0.95);

    vec2 macro = macroFrames(p);
    if (macro.x < result.x) result = macro;

    return result;
  }

  vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.0014, 0.0);
    float d = mapScene(p).x;
    return normalize(vec3(
      mapScene(p + e.xyy).x - d,
      mapScene(p + e.yxy).x - d,
      mapScene(p + e.yyx).x - d
    ));
  }

  float ambientOcclusion(vec3 p, vec3 n) {
    float ao = 0.0;
    float weight = 1.0;
    for (int i = 1; i <= 3; i++) {
      float dist = float(i) * 0.095;
      ao += (dist - mapScene(p + n * dist).x) * weight;
      weight *= 0.62;
    }
    return clamp(1.0 - ao * 1.9, 0.16, 1.0);
  }

  float softShadow(vec3 ro, vec3 rd, float maxDist) {
    float shade = 1.0;
    float t = 0.05;
    for (int i = 0; i < 10; i++) {
      float h = mapScene(ro + rd * t).x;
      shade = min(shade, 9.0 * h / t);
      t += clamp(h, 0.035, 0.45);
      if (h < 0.001 || t > maxDist) break;
    }
    return clamp(shade, 0.15, 1.0);
  }

  vec3 materialColor(float id, vec3 p, vec3 n) {
    vec3 grainWeights = pow(abs(n), vec3(4.0));
    grainWeights /= max(grainWeights.x + grainWeights.y + grainWeights.z, 0.0001);
    float grainX = 0.5 + 0.5 * sin(p.y * 17.0 + sin(p.z * 2.7) * 2.1 + sin(p.y * 3.1) * 0.7);
    float grainY = 0.5 + 0.5 * sin(p.x * 18.5 + sin(p.z * 2.4) * 2.4 + sin(p.x * 2.8) * 0.8);
    float grainZ = 0.5 + 0.5 * sin(p.x * 16.0 + sin(p.y * 3.0) * 2.0 + sin(p.x * 2.2) * 0.6);
    float grain = dot(vec3(grainX, grainY, grainZ), grainWeights);
    float fineGrain = 0.5 + 0.5 * sin((p.x + p.y * 0.8 + p.z * 0.35) * 42.0);
    grain = mix(grain, fineGrain, 0.13);
    vec3 charcoal = vec3(0.018, 0.021, 0.02);
    vec3 bronze = vec3(0.044, 0.031, 0.024);
    vec3 coldMetal = vec3(0.055, 0.068, 0.07);
    vec3 base = mix(charcoal, bronze, smoothstep(0.5, 0.96, grain) * 0.26);
    base *= 0.84 + grain * 0.24;
    base = mix(base, coldMetal, smoothstep(1.55, 2.0, id) * 0.55);
    return base;
  }

  float rectangleLine(vec2 p, vec2 halfSize, float width) {
    vec2 d = abs(p) - halfSize;
    float edge = abs(max(d.x, d.y));
    float insideCorners = 1.0 - smoothstep(0.0, width * 2.0, length(max(d, 0.0)));
    return (1.0 - smoothstep(width * 0.35, width, edge)) * insideCorners;
  }

  vec3 timeCurtains(vec3 ro, vec3 rd, float maxTravel) {
    vec3 curtainLight = vec3(0.0);
    float phaseShift = mod(uTime * 0.18 + uDepth * 0.5, 8.6);
    for (int i = 0; i < 4; i++) {
      float sliceZ = 3.0 - float(i) * 8.6 - phaseShift;
      float t = (sliceZ - ro.z) / rd.z;
      if (t > 0.0 && t < maxTravel) {
        vec3 samplePoint = ro + rd * t;
        vec2 local = samplePoint.xy;
        local *= rotate2d(-0.055 + float(i) * 0.018);
        float outer = rectangleLine(local, vec2(7.7, 4.85), 0.075);
        float middle = rectangleLine(local, vec2(5.9, 3.68), 0.058);
        float inner = rectangleLine(local, vec2(4.1, 2.5), 0.048);
        float spine = 1.0 - smoothstep(
          0.016,
          0.055,
          abs(mod(local.x + 7.5, 0.31) - 0.155)
        );
        spine *= smoothstep(3.0, 4.1, abs(local.x));
        spine *= 1.0 - smoothstep(4.55, 5.0, abs(local.y));
        float lines = max(max(outer, middle), max(inner, spine * 0.23));
        float fade = exp(-t * 0.028) * (0.72 + 0.28 * sin(uTime * 0.2 + float(i) * 1.7));
        vec3 tint = mix(vec3(0.18, 0.31, 0.33), vec3(0.38, 0.2, 0.085), mod(float(i), 2.0));
        curtainLight += tint * lines * fade * 0.17;
      }
    }
    return curtainLight;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / max(uResolution.y, 1.0);

    float drift = uTime * 0.26;
    vec3 ro = vec3(-1.8, 0.35, 12.4 - mod(drift + uDepth * 0.45, 4.4) - uDepth * 1.35);
    vec3 rd = normalize(vec3(uv.x, uv.y, -1.36));
    rd.yz *= rotate2d(-0.17 + uPointer.y * 0.075 + uDepth * 0.006 + sin(uTime * 0.07) * 0.032);
    rd.xz *= rotate2d(0.34 - uPointer.x * 0.09 + uDepth * 0.009 + sin(uTime * 0.055 + 1.2) * 0.038);
    rd.xy *= rotate2d(-0.28 + sin(uTime * 0.043) * 0.021);

    // 非欧几里得局部透视：画面四周分别朝不同轴向折叠，中央仍维持稳定消失点。
    float horizontalFold = smoothstep(0.18, 1.28, abs(uv.x)) * sign(uv.x);
    float verticalFold = smoothstep(0.16, 1.08, abs(uv.y)) * sign(uv.y);
    float foldBreath = 1.0 + sin(uTime * 0.047) * 0.11;
    rd.xz *= rotate2d(horizontalFold * 0.073 * foldBreath);
    rd.yz *= rotate2d(-verticalFold * 0.058 * foldBreath);

    float travel = 0.0;
    float materialId = 1.0;
    float nearGlow = 0.0;
    float volumeLight = 0.0;
    bool hit = false;
    vec3 p = ro;

    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= uMaxSteps) break;
      p = ro + rd * travel;
      vec2 scene = mapScene(p);
      materialId = scene.y;
      nearGlow += exp(-abs(scene.x) * 11.0) * 0.0017;
      float coolShaft = exp(-abs(p.x + 4.7) * 1.1) * exp(-abs(p.y - 1.9) * 0.42);
      float warmShaft = exp(-abs(p.x - 3.8) * 0.85) * exp(-abs(p.y + 2.7) * 0.48);
      volumeLight += (coolShaft * 0.00125 + warmShaft * 0.00082) * exp(-travel * 0.015);
      if (scene.x < 0.0015) {
        hit = true;
        break;
      }
      travel += clamp(scene.x * 0.66, 0.016, 0.62);
      if (travel > FAR_CLIP) break;
    }

    vec3 background = mix(vec3(0.006, 0.009, 0.009), vec3(0.019, 0.023, 0.022), smoothstep(-0.7, 0.8, uv.y));
    float interiorHaze = exp(-length(uv - vec2(-0.12, 0.08)) * 1.45);
    background += interiorHaze * vec3(0.012, 0.018, 0.018);
    vec3 color = background;

    if (hit) {
      vec3 n = getNormal(p);
      vec3 viewDir = -rd;
      vec3 keyPos = vec3(-2.5, 4.2, -11.0);
      vec3 rimPos = vec3(8.0, -3.0, -21.0);
      vec3 warmPos = vec3(-8.0, -5.0, -28.0);

      vec3 l1 = normalize(keyPos - p);
      vec3 l2 = normalize(rimPos - p);
      vec3 l3 = normalize(warmPos - p);
      float keyDistance = length(keyPos - p);
      float keyAttenuation = 1.0 / (1.0 + keyDistance * keyDistance * 0.0065);
      float d1 = max(dot(n, l1), 0.0) * softShadow(p + n * 0.01, l1, 18.0) * keyAttenuation;
      float d2 = max(dot(n, l2), 0.0) * 0.72;
      float d3 = max(dot(n, l3), 0.0) * 0.16;
      float ao = ambientOcclusion(p, n);

      vec3 halfDir = normalize(l1 + viewDir);
      float specular = pow(max(dot(n, halfDir), 0.0), 38.0);
      vec3 warmHalf = normalize(l3 + viewDir);
      float warmSpecular = pow(max(dot(n, warmHalf), 0.0), 28.0);
      float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
      float horizontalFace = smoothstep(0.8, 0.98, abs(n.y));
      float faceDamping = mix(1.0, 0.42, horizontalFace);
      specular *= faceDamping;
      warmSpecular *= faceDamping;
      vec3 base = materialColor(materialId, p, n);
      vec3 lighting = vec3(0.158 + d1 * 0.2);
      lighting += d2 * vec3(0.16, 0.24, 0.27);
      lighting += d3 * vec3(0.75, 0.39, 0.18);
      color = base * lighting;
      color *= faceDamping;
      color *= ao;
      color += vec3(0.72, 0.8, 0.81) * specular * 0.74;
      color += vec3(0.58, 0.3, 0.11) * warmSpecular * 0.3;
      color += vec3(0.22, 0.34, 0.37) * fresnel * 0.23;
      vec3 axisNormal = abs(n);
      float bandFlow = uTime * 0.24;
      float bandX = pow(0.5 + 0.5 * cos(p.x * 2.15 + materialId + bandFlow), 18.0);
      float bandY = pow(0.5 + 0.5 * cos(p.y * 2.35 - materialId * 0.7 - bandFlow * 0.72), 18.0);
      float bandZ = pow(0.5 + 0.5 * cos(p.z * 1.72 + materialId * 1.3 + bandFlow * 0.45), 20.0);
      float timeBands = max(
        bandX * (1.0 - axisNormal.x),
        max(bandY * (1.0 - axisNormal.y), bandZ * (1.0 - axisNormal.z))
      );
      float fineBands = pow(0.5 + 0.5 * cos((p.x + p.y - p.z) * 8.5), 34.0);
      vec3 bandColor = mix(vec3(0.48, 0.31, 0.16), vec3(0.16, 0.44, 0.5), step(1.72, materialId));
      bandColor = mix(bandColor, vec3(0.34, 0.3, 0.23), step(3.3, materialId));
      color += bandColor * (timeBands * 0.54 + fineBands * 0.04) * (0.38 + fresnel * 0.9);
      float reflectionBand = pow(0.5 + 0.5 * sin(p.z * 2.35 + p.x * 1.65 + p.y * 0.7), 10.0);
      color += mix(vec3(0.14, 0.28, 0.31), vec3(0.48, 0.23, 0.09), step(0.5, sin(p.z * 0.37)))
        * reflectionBand * fresnel * 0.42;

      float fog = 1.0 - exp(-travel * 0.027);
      color = mix(color, background * 1.35, fog);
    }

    color += vec3(0.42, 0.56, 0.57) * nearGlow;
    color += volumeLight * vec3(0.62, 0.82, 0.84) * 2.1;
    color += timeCurtains(ro, rd, travel);
    vec2 deepPoint = vec2(-0.16 + sin(uTime * 0.037) * 0.018, 0.08);
    vec2 deepDelta = uv - deepPoint;
    float deepCore = exp(-length(deepDelta * vec2(1.0, 0.78)) * 7.2);
    float coolBeam = exp(-abs(deepDelta.y - deepDelta.x * 0.22) * 21.0)
      * exp(-length(deepDelta) * 1.35);
    float warmBeam = exp(-abs(deepDelta.y + deepDelta.x * 0.34 + 0.12) * 27.0)
      * exp(-length(deepDelta * vec2(0.82, 1.0)) * 1.7);
    float corePulse = 0.92 + sin(uTime * 0.31) * 0.08;
    color += vec3(0.22, 0.35, 0.37) * deepCore * 0.105 * corePulse;
    color += vec3(0.16, 0.25, 0.27) * coolBeam * 0.028;
    color += vec3(0.36, 0.18, 0.07) * warmBeam * 0.016;

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, 0.82);
    color *= vec3(1.02, 1.0, 0.985);
    float vignette = 1.0 - smoothstep(0.3, 1.55, length(uv * vec2(0.72, 0.88)));
    color *= 0.64 + vignette * 0.36;
    color = pow(max(color, 0.0), vec3(0.93));
    gl_FragColor = vec4(color, 1.0);
  }
`;
