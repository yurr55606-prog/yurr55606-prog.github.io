export const astronautVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vRelief;
  uniform float uTime;

  void main() {
    vUv = uv;
    float silhouette = sin(uv.x * 3.14159265) * sin(uv.y * 3.14159265);
    float breathing = sin(uTime * 0.82 + uv.y * 2.2) * 0.018;
    float lowerBody = 1.0 - smoothstep(0.20, 0.61, uv.y);
    float legSide = smoothstep(0.60, 0.69, uv.x) * 2.0 - 1.0;
    float legSwing = sin(uTime * 1.18) * 0.085 * lowerBody;
    vRelief = silhouette;
    vec3 transformed = position;
    transformed.z += silhouette * (0.12 + breathing);
    transformed.y += legSwing * legSide;
    transformed.x += cos(uTime * 1.18 + 0.4) * 0.026 * lowerBody * legSide;
    transformed.z += sin(uTime * 1.18 + legSide) * 0.045 * lowerBody;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

export const astronautFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying float vRelief;
  uniform sampler2D uIdleMap;
  uniform sampler2D uWaveMap;
  uniform float uTime;
  uniform float uWaveBlend;
  uniform float uWaveMotion;
  uniform float uReveal;
  uniform vec2 uTexel;

  float subjectLuma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    vec2 waveUv = vUv;
    float handRegion = smoothstep(0.58, 0.82, vUv.y)
      * (1.0 - smoothstep(0.24, 0.54, vUv.x));
    waveUv.x += sin(uTime * 7.2) * 0.009 * uWaveMotion * handRegion;
    waveUv.y += cos(uTime * 6.1) * 0.004 * uWaveMotion * handRegion;

    vec4 idle = texture2D(uIdleMap, vUv);
    vec4 wave = texture2D(uWaveMap, waveUv);
    vec4 subject = mix(idle, wave, uWaveBlend);
    if (subject.a < 0.025) discard;

    float alphaLeft = mix(
      texture2D(uIdleMap, vUv - vec2(uTexel.x * 2.0, 0.0)).a,
      texture2D(uWaveMap, waveUv - vec2(uTexel.x * 2.0, 0.0)).a,
      uWaveBlend
    );
    float alphaRight = mix(
      texture2D(uIdleMap, vUv + vec2(uTexel.x * 2.0, 0.0)).a,
      texture2D(uWaveMap, waveUv + vec2(uTexel.x * 2.0, 0.0)).a,
      uWaveBlend
    );
    float alphaUp = mix(
      texture2D(uIdleMap, vUv + vec2(0.0, uTexel.y * 2.0)).a,
      texture2D(uWaveMap, waveUv + vec2(0.0, uTexel.y * 2.0)).a,
      uWaveBlend
    );

    float leftRim = clamp(subject.a - alphaLeft, 0.0, 1.0);
    float rightRim = clamp(subject.a - alphaRight, 0.0, 1.0);
    float topRim = clamp(subject.a - alphaUp, 0.0, 1.0);
    float cloth = smoothstep(0.50, 0.96, subjectLuma(subject.rgb));
    float slowPulse = 0.94 + sin(uTime * 0.45) * 0.06;

    vec3 color = subject.rgb;
    color *= mix(vec3(0.76, 0.91, 0.95), vec3(1.08, 0.92, 0.79), vUv.x * 0.58 + 0.16);
    color += vec3(0.08, 0.34, 0.39) * leftRim * 1.35;
    color += vec3(0.74, 0.38, 0.18) * rightRim * 0.72;
    color += vec3(0.34, 0.54, 0.58) * topRim * 0.42;
    color += cloth * vRelief * vec3(0.028, 0.045, 0.048) * slowPulse;
    color *= 0.90 + vRelief * 0.10;

    gl_FragColor = vec4(color, subject.a * uReveal);
  }
`;
