import * as THREE from 'three';
import automationWatchVideoUrl from './assets/first-person/automation-watch-2k.mp4';
import videoDslrVideoUrl from './assets/first-person/video-dslr-2k.mp4';
import photographyFilmVideoUrl from './assets/first-person/photography-film-1080.mp4';
import productCubeVideoUrl from './assets/first-person/product-cube-1080.mp4';

const SECTION_VIDEOS = {
  plugin: {
    url: automationWatchVideoUrl, revealAt: 4.05, width: 2560, height: 1440,
    exposure: 0.90, saturation: 0.92, warm: 1.0, cool: 1.0
  },
  video: {
    url: videoDslrVideoUrl, revealAt: 4.0, width: 2560, height: 1440,
    exposure: 1.02, saturation: 0.88, warm: 0.62, cool: 1.12
  },
  photo: {
    url: photographyFilmVideoUrl, revealAt: 3.92, width: 1920, height: 1080,
    exposure: 1.0, saturation: 0.86, warm: 0.88, cool: 0.94
  },
  product: {
    url: productCubeVideoUrl, revealAt: 4.08, width: 1920, height: 1080,
    exposure: 0.95, saturation: 0.78, warm: 1.08, cool: 0.74
  }
};
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const easeOutBack = (value) => {
  const t = clamp01(value) - 1;
  return 1 + 2.35 * t * t * t + 1.35 * t * t;
};

function makeMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: options.metalness ?? 0.64,
    roughness: options.roughness ?? 0.28,
    clearcoat: options.clearcoat ?? 0.5,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.18,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    transmission: options.transmission ?? 0,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    depthWrite: options.depthWrite ?? true
  });
}

function mesh(geometry, material, parent, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function createGlove(side, materials, compact) {
  const sign = side === 'left' ? -1 : 1;
  const group = new THREE.Group();
  const segmentScale = compact ? 0.88 : 1;
  mesh(new THREE.CylinderGeometry(0.42, 0.54, 2.8, compact ? 12 : 18), materials.fabric, group,
    [sign * 1.68, -1.52, 0.18], [0.08, 0, sign * -0.36], [segmentScale, 1, segmentScale]);
  mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.42, compact ? 12 : 20), materials.darkMetal, group,
    [sign * 1.18, -0.34, 0.12], [0.02, 0, sign * -0.36]);
  mesh(new THREE.SphereGeometry(0.64, compact ? 14 : 22, compact ? 10 : 16), materials.glove, group,
    [sign * 0.9, 0.12, 0.1], [0, 0, sign * 0.05], [0.86, 0.62, 0.52]);
  const fingerGeometry = new THREE.CapsuleGeometry(0.105, 0.48, compact ? 3 : 5, compact ? 7 : 10);
  for (let index = 0; index < 4; index += 1) {
    mesh(fingerGeometry, materials.glove, group,
      [sign * (0.55 - index * 0.015), 0.26 - index * 0.13, 0.14 + index * 0.055],
      [0.08 + index * 0.035, 0, sign * (1.14 + index * 0.035)], [1, 0.92 - index * 0.04, 1]);
  }
  mesh(new THREE.CapsuleGeometry(0.12, 0.42, compact ? 3 : 5, compact ? 7 : 10), materials.glove, group,
    [sign * 0.76, -0.06, 0.35], [0.48, sign * -0.18, sign * 0.78]);
  return group;
}

function createWatch(materials, compact) {
  const group = new THREE.Group();
  const segments = compact ? 28 : 48;
  mesh(new THREE.TorusGeometry(0.78, 0.105, compact ? 10 : 16, segments), materials.silver, group);
  mesh(new THREE.CircleGeometry(0.71, segments), materials.watchFace, group, [0, 0, 0.025]);
  mesh(new THREE.CircleGeometry(0.66, segments), materials.glass, group, [0, 0, 0.055]);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    mesh(new THREE.BoxGeometry(0.025, 0.12, 0.025), materials.light, group,
      [Math.sin(angle) * 0.57, Math.cos(angle) * 0.57, 0.075], [0, 0, -angle]);
  }
  const minuteHand = mesh(new THREE.BoxGeometry(0.035, 0.48, 0.03), materials.light, group, [0, 0.21, 0.1]);
  const hourHand = mesh(new THREE.BoxGeometry(0.05, 0.32, 0.035), materials.warm, group, [0, 0.14, 0.11]);
  mesh(new THREE.SphereGeometry(0.075, 16, 10), materials.silver, group, [0, 0, 0.14]);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.82, 0.08);
  const lid = mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.075, segments), materials.silver, lidPivot,
    [0, -0.82, 0], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CircleGeometry(0.67, segments), materials.darkMetal, lid, [0, 0.039, 0], [-Math.PI / 2, 0, 0]);
  group.add(lidPivot);
  const crown = new THREE.Group();
  crown.position.set(0.95, 0.1, 0);
  mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 14), materials.silver, crown, [0, 0, 0], [0, 0, Math.PI / 2]);
  group.add(crown);
  mesh(new THREE.TorusGeometry(0.22, 0.045, 9, 20), materials.silver, group, [0, 1.03, 0]);
  group.scale.setScalar(compact ? 0.92 : 1.06);
  group.userData = { lidPivot, crown, minuteHand, hourHand };
  return group;
}

function createDslr(materials, compact) {
  const group = new THREE.Group();
  mesh(new THREE.BoxGeometry(1.85, 1.12, 0.68), materials.cameraBody, group);
  mesh(new THREE.BoxGeometry(0.72, 0.34, 0.58), materials.darkMetal, group, [0.08, 0.69, -0.02]);
  mesh(new THREE.BoxGeometry(0.4, 0.88, 0.82), materials.cameraGrip, group, [0.98, -0.08, -0.02]);
  const lens = new THREE.Group();
  lens.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.58, 0.5, 0.76, compact ? 20 : 38), materials.darkMetal, lens, [0, 0.48, 0]);
  const focusRing = mesh(new THREE.TorusGeometry(0.535, 0.07, 10, compact ? 20 : 40), materials.silver, lens,
    [0, 0.78, 0], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CircleGeometry(0.45, compact ? 22 : 40), materials.lensGlass, lens,
    [0, 0.87, 0], [-Math.PI / 2, 0, 0]);
  group.add(lens);
  const recordLight = mesh(new THREE.SphereGeometry(0.055, 12, 8), materials.record, group, [0.75, 0.43, 0.37]);
  group.scale.setScalar(compact ? 0.82 : 0.94);
  group.userData = { lens, focusRing, recordLight };
  return group;
}

function createFilmCamera(materials, compact) {
  const group = new THREE.Group();
  mesh(new THREE.BoxGeometry(1.9, 1.05, 0.62), materials.cameraBody, group);
  mesh(new THREE.BoxGeometry(1.92, 0.3, 0.64), materials.silver, group, [0, 0.54, 0]);
  mesh(new THREE.BoxGeometry(1.6, 0.58, 0.66), materials.leather, group, [0, -0.2, 0]);
  const lens = new THREE.Group();
  lens.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.49, 0.43, 0.55, compact ? 20 : 36), materials.darkMetal, lens, [0, 0.39, 0]);
  mesh(new THREE.CircleGeometry(0.38, compact ? 22 : 40), materials.lensGlass, lens,
    [0, 0.7, 0], [-Math.PI / 2, 0, 0]);
  group.add(lens);
  const lever = new THREE.Group();
  lever.position.set(0.67, 0.77, 0.02);
  mesh(new THREE.BoxGeometry(0.66, 0.08, 0.09), materials.silver, lever, [0.28, 0, 0]);
  group.add(lever);
  const dial = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.11, 20), materials.silver, group,
    [-0.62, 0.76, 0], [Math.PI / 2, 0, 0]);
  group.scale.setScalar(compact ? 0.84 : 0.96);
  group.userData = { lens, lever, dial };
  return group;
}

function createCube(materials, compact) {
  const group = new THREE.Group();
  const layers = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  layers.forEach((layer) => group.add(layer));
  const size = 0.45;
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const material = (x + y + z) % 3 === 0 ? materials.cubeGlass : materials.silver;
        mesh(new THREE.BoxGeometry(size, size, size), material, layers[y + 1],
          [x * 0.49, y * 0.49, z * 0.49], [0, 0, 0], [0.92, 0.92, 0.92]);
      }
    }
  }
  const core = mesh(new THREE.SphereGeometry(0.22, 20, 14), materials.core, group);
  group.scale.setScalar(compact ? 0.8 : 0.92);
  group.rotation.set(-0.34, 0.52, 0.1);
  group.userData = { layers, core };
  return group;
}

export function createFirstPersonExperience(canvas, options = {}) {
  const compact = Boolean(options.isSmallScreen);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !compact, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 0.9 : 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(compact ? 48 : 44, window.innerWidth / window.innerHeight, 0.1, 30);
  camera.position.set(0, 0.1, compact ? 7.4 : 6.4);
  camera.lookAt(0, -0.2, 0);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xd9eef5, 0x050608, 1.8));
  const key = new THREE.DirectionalLight(0xe8f7ff, 5.2); key.position.set(-4, 6, 7); scene.add(key);
  const rim = new THREE.PointLight(0x67cce8, 16, 18, 1.8); rim.position.set(4, 1, 4); scene.add(rim);
  const warm = new THREE.PointLight(0xd89558, 10, 14, 1.8); warm.position.set(-4, -2, 3); scene.add(warm);

  // Each section uses an authored first-person plate. The green screen is
  // removed here so the live tesseract remains the real background rather
  // than being baked into four separate transition movies.
  const interactionVideo = document.createElement('video');
  interactionVideo.muted = true;
  interactionVideo.defaultMuted = true;
  interactionVideo.playbackRate = 1.4;
  interactionVideo.defaultPlaybackRate = 1.4;
  interactionVideo.playsInline = true;
  interactionVideo.preload = compact ? 'metadata' : 'auto';
  interactionVideo.disablePictureInPicture = true;
  interactionVideo.setAttribute('playsinline', '');
  interactionVideo.setAttribute('webkit-playsinline', '');
  interactionVideo.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen');
  const interactionVideoTexture = new THREE.VideoTexture(interactionVideo);
  interactionVideoTexture.colorSpace = THREE.SRGBColorSpace;
  interactionVideoTexture.minFilter = THREE.LinearFilter;
  interactionVideoTexture.magFilter = THREE.LinearFilter;
  interactionVideoTexture.generateMipmaps = false;
  const interactionVideoMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: interactionVideoTexture },
      uOpacity: { value: 0 },
      uTexelSize: { value: new THREE.Vector2(1 / 2560, 1 / 1440) },
      uExposure: { value: 0.9 },
      uSaturation: { value: 0.92 },
      uWarm: { value: 1 },
      uCool: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec2 uTexelSize;
      uniform float uExposure;
      uniform float uSaturation;
      uniform float uWarm;
      uniform float uCool;
      varying vec2 vUv;

      float greenKey(vec3 sampleColor) {
        float other = max(sampleColor.r, sampleColor.b);
        float dominance = sampleColor.g - other;
        return smoothstep(0.028, 0.175, dominance)
          * smoothstep(0.17, 0.48, sampleColor.g);
      }

      void main() {
        vec3 source = texture2D(uMap, vUv).rgb;
        float strongestOther = max(source.r, source.b);
        float greenDominance = source.g - strongestOther;
        vec2 texel = uTexelSize;
        float centerSubject = 1.0 - greenKey(source);
        float neighborSubject = min(
          min(1.0 - greenKey(texture2D(uMap, vUv + vec2(texel.x, 0.0)).rgb),
              1.0 - greenKey(texture2D(uMap, vUv - vec2(texel.x, 0.0)).rgb)),
          min(1.0 - greenKey(texture2D(uMap, vUv + vec2(0.0, texel.y)).rgb),
              1.0 - greenKey(texture2D(uMap, vUv - vec2(0.0, texel.y)).rgb))
        );
        float subjectAlpha = smoothstep(0.03, 0.94, mix(centerSubject, neighborSubject, 0.68));
        float alpha = subjectAlpha * uOpacity;
        if (alpha < 0.012) discard;

        // Suppress the green spill only around keyed edges; this preserves the
        // cyan accents in the suit and the blue light inside the watch.
        float spill = smoothstep(0.012, 0.15, greenDominance)
          * smoothstep(0.16, 0.64, source.g);
        vec3 color = source;
        color.g = mix(color.g, min(color.g, strongestOther * 1.015), spill * 0.98);

        // Match the tesseract lighting: restrained exposure, cool silver
        // highlights and a faint bronze bounce in the lower shadows.
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color *= mix(0.80, 0.94, smoothstep(0.12, 0.82, luma)) * uExposure;
        color += vec3(0.030, 0.012, -0.006) * (1.0 - luma) * uWarm;
        color += vec3(-0.012, 0.018, 0.036) * luma * uCool;
        color = mix(vec3(luma), color, uSaturation);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const interactionVideoPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), interactionVideoMaterial);
  interactionVideoPlane.name = 'first_person_video_plate';
  interactionVideoPlane.position.set(0, 0, -5);
  interactionVideoPlane.renderOrder = 40;
  interactionVideoPlane.frustumCulled = false;
  interactionVideoPlane.visible = false;
  camera.add(interactionVideoPlane);

  const resizeInteractionVideoPlane = (width, height) => {
    const viewAspect = width / Math.max(1, height);
    const distance = Math.abs(interactionVideoPlane.position.z);
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
    const viewWidth = viewHeight * viewAspect;
    const sourceAspect = 16 / 9;
    let planeWidth = viewWidth;
    let planeHeight = viewHeight;
    if (viewAspect > sourceAspect) planeHeight = viewWidth / sourceAspect;
    else planeWidth = viewHeight * sourceAspect;
    interactionVideoPlane.scale.set(planeWidth * 0.5, planeHeight * 0.5, 1);
  };
  resizeInteractionVideoPlane(window.innerWidth, window.innerHeight);

  let phase = 'idle';
  let section = null;
  let activeVideoConfig = null;
  let startedAt = 0;
  let resolvePhase = null;
  let lastRenderAt = 0;

  const setProp = (nextSection) => {
    interactionVideo.pause();
    interactionVideoPlane.visible = false;
    interactionVideoMaterial.uniforms.uOpacity.value = 0;
    section = nextSection;
    activeVideoConfig = SECTION_VIDEOS[nextSection] || null;
    if (!activeVideoConfig) return;

    if (interactionVideo.dataset.section !== nextSection) {
      interactionVideo.dataset.section = nextSection;
      interactionVideo.src = activeVideoConfig.url;
      interactionVideo.load();
    }
    interactionVideo.playbackRate = 1.4;
    interactionVideo.defaultPlaybackRate = 1.4;
    interactionVideoMaterial.uniforms.uTexelSize.value.set(
      1 / activeVideoConfig.width,
      1 / activeVideoConfig.height
    );
    interactionVideoMaterial.uniforms.uExposure.value = activeVideoConfig.exposure;
    interactionVideoMaterial.uniforms.uSaturation.value = activeVideoConfig.saturation;
    interactionVideoMaterial.uniforms.uWarm.value = activeVideoConfig.warm;
    interactionVideoMaterial.uniforms.uCool.value = activeVideoConfig.cool;
    interactionVideoPlane.visible = true;
  };
  const open = (nextSection) => {
    if (phase !== 'idle') return Promise.reject(new Error('First-person experience is busy'));
    setProp(nextSection); phase = 'opening'; startedAt = performance.now(); canvas.dataset.visible = 'true';
    try { interactionVideo.currentTime = 0.001; } catch {}
    interactionVideo.play().catch((error) => console.warn('第一人称道具视频播放失败，将使用直接展开兜底。', error));
    return new Promise((resolve) => { resolvePhase = resolve; });
  };
  const close = () => {
    if (phase !== 'holding') return Promise.resolve();
    phase = 'closing'; startedAt = performance.now();
    return new Promise((resolve) => { resolvePhase = resolve; });
  };
  const update = (now) => {
    if (phase === 'idle') { renderer.clear(); return; }
    const closingDuration = compact ? 760 : 980;
    const elapsed = now - startedAt;
    if (phase === 'opening') {
      interactionVideoMaterial.uniforms.uOpacity.value = smoothstep(elapsed / 320);
      const reachedRevealPose = activeVideoConfig
        && interactionVideo.currentTime >= activeVideoConfig.revealAt;
      const playbackFallback = elapsed >= (compact ? 7600 : 9000);
      if (options.reducedMotion || reachedRevealPose || playbackFallback) {
        // Freeze on the authored hero pose before the liquid-glass panel
        // appears. This keeps the first-person plate visually stable and
        // stops video decoding while the user browses project content.
        interactionVideo.pause();
        phase = 'holding'; resolvePhase?.(); resolvePhase = null;
      }
    } else if (phase === 'closing') {
      const closeProgress = smoothstep(elapsed / closingDuration);
      interactionVideoMaterial.uniforms.uOpacity.value = 1 - closeProgress;
      if (elapsed >= closingDuration) {
        phase = 'idle';
        interactionVideo.pause();
        interactionVideoPlane.visible = false;
        interactionVideoMaterial.uniforms.uOpacity.value = 0;
        canvas.dataset.visible = 'false';
        resolvePhase?.(); resolvePhase = null; renderer.clear(); return;
      }
    }
    const minimumFrameInterval = compact && phase === 'holding' ? 1000 / 24 : 0;
    if (!minimumFrameInterval || now - lastRenderAt >= minimumFrameInterval) {
      renderer.render(scene, camera); lastRenderAt = now;
    }
  };
  const resize = (width, height) => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 0.9 : 1.25));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    resizeInteractionVideoPlane(width, height);
  };
  const preload = (nextSection) => {
    if (phase !== 'idle') return;
    const config = SECTION_VIDEOS[nextSection];
    if (!config || interactionVideo.dataset.section === nextSection) return;
    interactionVideo.dataset.section = nextSection;
    interactionVideo.src = config.url;
    interactionVideo.preload = 'auto';
    interactionVideo.load();
  };
  return { open, close, update, resize, preload,
    get phase() { return phase; }, get activeSection() { return section; } };
}
