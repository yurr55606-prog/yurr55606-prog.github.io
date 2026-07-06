export const cinematicBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexelSize: { value: null },
    uDirection: { value: null },
    uStrength: { value: 1.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uTexelSize;
    uniform vec2 uDirection;
    uniform float uStrength;
    varying vec2 vUv;

    void main() {
      vec2 direction = normalize(uDirection) * uTexelSize * uStrength;
      vec4 color = texture2D(tDiffuse, vUv) * 0.32;
      color += texture2D(tDiffuse, vUv + direction) * 0.22;
      color += texture2D(tDiffuse, vUv - direction) * 0.22;
      color += texture2D(tDiffuse, vUv + direction * 2.0) * 0.12;
      color += texture2D(tDiffuse, vUv - direction * 2.0) * 0.12;
      gl_FragColor = color;
    }
  `
};
