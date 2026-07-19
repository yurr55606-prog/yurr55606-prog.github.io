import * as THREE from 'three';
import introBlackholeDesktopVideoUrl from './assets/intro/blackhole-entry-enhanced.mp4?url';
import introBlackholeMobileVideoUrl from './assets/intro/blackhole-entry-mobile.mp4?url';
import introBlackholePosterUrl from './assets/intro/blackhole-poster-enhanced.webp?url';
import wormholeTransitionVideoUrl from './assets/intro/wormhole-passage.mp4?url';
import astronautIdleUrl from './assets/character/astronaut-idle.png?url';
import astronautWaveUrl from './assets/character/astronaut-wave.png?url';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './styles.css';
import './pluginStyles.css';
import { categories, photoAlbums, videoItems, resolveAutomationVideo } from './data.js';
import { librarySpaceVertex, librarySpaceFragment } from './shaders/librarySpace.js';
import { astronautVertex, astronautFragment } from './shaders/astronaut.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 720px)').matches;
const introBlackholeVideoUrl = isSmallScreen
  ? introBlackholeMobileVideoUrl
  : introBlackholeDesktopVideoUrl;
const blackholeDprCap = isSmallScreen ? 1.15 : 1.45;
const spaceDprCap = isSmallScreen ? 0.72 : 0.88;

const dom = {
  loading: document.querySelector('#loading'),
  loadingProgress: document.querySelector('#loading-progress'),
  blackholeCanvas: document.querySelector('#blackhole-canvas'),
  introVideoStage: document.querySelector('#intro-video-stage'),
  introVideo: document.querySelector('#intro-video'),
  wormholeVideoStage: document.querySelector('#wormhole-video-stage'),
  wormholeVideo: document.querySelector('#wormhole-video'),
  warpCanvas: document.querySelector('#warp-canvas'),
  spaceCanvas: document.querySelector('#space-canvas'),
  astronautCanvas: document.querySelector('#astronaut-canvas'),
  intro: document.querySelector('#intro'),
  enter: document.querySelector('#enter'),
  spaceUi: document.querySelector('#space-ui'),
  panel: document.querySelector('#work-panel'),
  closePanel: document.querySelector('#close-panel'),
  panelTitle: document.querySelector('#panel-title'),
  panelDescription: document.querySelector('#panel-description'),
  workList: document.querySelector('#work-list'),
  blinkOverlay: document.querySelector('#blink-overlay'),
  fallback: document.querySelector('#webgl-fallback')
};

let state = 'loading';
let travelStartedAt = 0;
let travelRaw = 0;
let travelProgress = 0;
let wormholePrimed = false;
let deferredWormholeReset = 0;
let spaceRenderResumeAt = 0;
let activeCategory = null;
let activePhotoAlbum = null;
let activePlugin = null;
let activeVideoGallery = false;
let activeVideoItem = null;
let videoLightbox = null;
let galleryScrollFrame = 0;
let scrollDepth = 0;
let nextBlinkAt = 0;
let blinkEndsAt = 0;
let arrivalBlinkActive = false;
let astronautVisible = false;
let blurBaseStrength = 1;
let blurImpulse = 0;
const pointer = new THREE.Vector2();
const smoothPointer = new THREE.Vector2();
const clock = new THREE.Clock();
let performanceWindowStartedAt = performance.now();
let performanceFrameCount = 0;
let lastSpaceRenderAt = 0;
let introVideoRetryTimer = 0;
let wormholeLoadStarted = false;
let wormholeBoosted = false;
let deferredExperiencePromise = null;
let deferredExperienceReady = false;
let travelPreparationPending = false;
let mobileWormholeStartPromise = null;
let mobileWormholeGestureTimer = 0;
let panelMediaObservers = [];
let mobileMediaPreparationTimer = 0;

function setLoadingProgress(value) {
  if (!dom.loadingProgress) return;
  dom.loadingProgress.textContent = String(Math.round(clamp(value, 0, 100)));
}

function preloadImage(url, timeout = 8000) {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, timeout);
    image.decoding = 'async';
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().catch(() => {}).finally(finish);
      else finish();
    };
    image.onerror = finish;
    image.src = url;
  });
}

function loadManagedImage(image) {
  const source = image?.dataset?.src;
  if (!source) return;
  image.removeAttribute('data-src');
  image.src = source;
}

function configureManagedImage(image, source, { immediate = false } = {}) {
  image.decoding = 'async';
  image.loading = immediate ? 'eager' : 'lazy';
  if ('fetchPriority' in image) image.fetchPriority = immediate ? 'high' : 'low';
  if (!isSmallScreen || immediate) image.src = source;
  else image.dataset.src = source;
}

function observeManagedImages(container, scrollRoot, rootMargin = '70% 0px') {
  if (!isSmallScreen || !container) return;
  const images = [...container.querySelectorAll('img[data-src]')];
  if (!images.length) return;
  if (!('IntersectionObserver' in window)) {
    images.forEach(loadManagedImage);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadManagedImage(entry.target);
      observer.unobserve(entry.target);
    });
  }, { root: scrollRoot || null, rootMargin, threshold: 0.01 });
  images.forEach((image) => observer.observe(image));
  panelMediaObservers.push(observer);
}

function disposePanelMedia() {
  panelMediaObservers.forEach((observer) => observer.disconnect());
  panelMediaObservers = [];
  dom.workList?.querySelectorAll('video').forEach((video) => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  dom.workList?.querySelectorAll('img').forEach((image) => {
    image.removeAttribute('src');
    image.removeAttribute('data-src');
  });
}

function replaceWorkList(...nodes) {
  disposePanelMedia();
  dom.workList.replaceChildren(...nodes);
}

function settleMobileMediaPreparation(container) {
  if (!isSmallScreen) return;
  window.clearTimeout(mobileMediaPreparationTimer);
  document.body.classList.add('is-mobile-media-preparing');
  const startedAt = performance.now();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    const remaining = Math.max(0, 340 - (performance.now() - startedAt));
    mobileMediaPreparationTimer = window.setTimeout(() => {
      document.body.classList.remove('is-mobile-media-preparing');
      mobileMediaPreparationTimer = 0;
    }, remaining);
  };
  const firstImage = container?.querySelector('img[src]');
  if (firstImage?.complete && firstImage.naturalWidth > 0) finish();
  else {
    firstImage?.addEventListener('load', finish, { once: true });
    firstImage?.addEventListener('error', finish, { once: true });
    mobileMediaPreparationTimer = window.setTimeout(finish, 1200);
  }
}

function releaseCompletedTravelMedia() {
  if (!isSmallScreen || state !== 'space') return;
  if (introVideoRetryTimer) {
    window.clearInterval(introVideoRetryTimer);
    introVideoRetryTimer = 0;
  }
  [dom.introVideo, dom.wormholeVideo].forEach((video) => {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  wormholePrimed = false;
  wormholeLoadStarted = false;
  wormholeBoosted = false;
  document.documentElement.dataset.travelMediaReleased = 'true';
}

function waitForVideoBuffer(video, {
  minimumSeconds = 1.5,
  timeout = 10000,
  progressStart = 0,
  progressEnd = 100
} = {}) {
  return new Promise((resolve) => {
    if (!video) {
      resolve(false);
      return;
    }
    let settled = false;
    const startedAt = performance.now();
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      video.removeEventListener('progress', inspect);
      video.removeEventListener('canplay', inspect);
      video.removeEventListener('canplaythrough', inspect);
      video.removeEventListener('error', fail);
      resolve(ready);
    };
    const fail = () => finish(false);
    const inspect = () => {
      let bufferedSeconds = 0;
      if (video.buffered.length) {
        bufferedSeconds = video.buffered.end(video.buffered.length - 1);
      }
      const target = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(minimumSeconds, Math.max(0.35, video.duration - 0.12))
        : minimumSeconds;
      const elapsedRatio = clamp((performance.now() - startedAt) / timeout, 0, 0.92);
      const bufferRatio = clamp(bufferedSeconds / Math.max(target, 0.1), 0, 1);
      setLoadingProgress(progressStart + (progressEnd - progressStart) * Math.max(bufferRatio, elapsedRatio * 0.25));
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && bufferedSeconds >= target) {
        finish(true);
      }
    };
    const pollTimer = window.setInterval(inspect, 120);
    const timeoutTimer = window.setTimeout(() => finish(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA), timeout);
    video.addEventListener('progress', inspect);
    video.addEventListener('canplay', inspect);
    video.addEventListener('canplaythrough', inspect);
    video.addEventListener('error', fail, { once: true });
    inspect();
  });
}

function recordFrameRate(now) {
  performanceFrameCount += 1;
  const elapsed = now - performanceWindowStartedAt;
  if (elapsed < 1000) return;
  document.documentElement.dataset.fps = String(Math.round((performanceFrameCount * 1000) / elapsed));
  document.documentElement.dataset.renderState = state;
  performanceFrameCount = 0;
  performanceWindowStartedAt = now;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function smoothstep(min, max, value) {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

function damp(current, target, smoothing, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

function setArrivalPhase(phase) {
  document.documentElement.dataset.arrivalPhase = phase;
  window.__arrivalTimeline ??= [];
  window.__arrivalTimeline.push({ phase, at: performance.now() });
  document.documentElement.dataset.arrivalTimeline = JSON.stringify(window.__arrivalTimeline);
}

function stopBlinking() {
  nextBlinkAt = 0;
  blinkEndsAt = 0;
  arrivalBlinkActive = false;
  document.body.classList.remove('is-blinking');
}

function keepIntroVideoPlaying() {
  const video = dom.introVideo;
  if (!video || state === 'space') return;
  if (video.paused || video.ended) {
    video.play().catch((error) => {
      document.documentElement.dataset.introVideoPlayError = error?.name || 'PlaybackError';
    });
  }
}

function wakeIntroVideo() {
  if (state === 'space') return;
  const video = dom.introVideo;
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  const promise = video.play();
  if (promise) {
    promise.catch((error) => {
      document.documentElement.dataset.introVideoPlayError = error?.name || 'PlaybackError';
    });
  }
}

function setupIntroVideo() {
  const video = dom.introVideo;
  if (!video) return;
  video.src = introBlackholeVideoUrl;
  video.poster = introBlackholePosterUrl;
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('fetchpriority', 'high');
  video.controls = false;
  video.disablePictureInPicture = true;
  video.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen');
  video.setAttribute('disableremoteplayback', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('x5-playsinline', '');
  video.setAttribute('x5-video-player-type', 'h5');
  video.setAttribute('x5-video-player-fullscreen', 'false');
  video.addEventListener('pause', keepIntroVideoPlaying);
  video.addEventListener('ended', keepIntroVideoPlaying);
  video.addEventListener('stalled', keepIntroVideoPlaying);
  video.addEventListener('contextmenu', (event) => event.preventDefault());
  const markIntroVideoReady = () => {
    dom.introVideoStage?.classList.add('is-ready');
    dom.introVideoStage?.classList.remove('has-video-error');
    video.classList.add('is-ready');
    keepIntroVideoPlaying();
  };
  video.addEventListener('loadeddata', markIntroVideoReady, { once: true });
  video.addEventListener('canplay', markIntroVideoReady, { once: true });
  video.addEventListener('playing', markIntroVideoReady);
  video.addEventListener('error', () => {
    dom.introVideoStage?.classList.add('has-video-error');
    video.classList.remove('is-ready');
    document.documentElement.dataset.introVideoLoadError = video.error?.code ? String(video.error.code) : 'MediaError';
  });
  video.addEventListener('waiting', () => {
    document.documentElement.dataset.introVideoWaiting = String(Date.now());
  });
  video.load();
  wakeIntroVideo();
  introVideoRetryTimer = window.setInterval(() => {
    if (state === 'space') {
      window.clearInterval(introVideoRetryTimer);
      introVideoRetryTimer = 0;
      return;
    }
    if (!video.classList.contains('is-ready') || video.paused) wakeIntroVideo();
  }, 1800);
}

function setupWormholeVideo() {
  const video = dom.wormholeVideo;
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.loop = false;
  video.autoplay = false;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('fetchpriority', 'high');
  video.controls = false;
  video.disablePictureInPicture = true;
  video.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen');
  video.setAttribute('disableremoteplayback', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('x5-playsinline', '');
  video.setAttribute('x5-video-player-type', 'h5');
  video.setAttribute('x5-video-player-fullscreen', 'false');
  video.setAttribute('muted', '');
  video.src = wormholeTransitionVideoUrl;
  video.addEventListener('contextmenu', (event) => event.preventDefault());
  video.addEventListener('loadeddata', () => {
    wormholePrimed = true;
    // 微信与 iOS 内嵌浏览器会拦截非手势阶段的 play/pause 预热，
    // 甚至可能让下一次真实点击也停留在黑帧。手机端只完成解码，
    // 真正播放交给 pointerdown/touchstart 的用户手势。
    if (isSmallScreen) return;
    // 预热第一帧，避免用户点击进入时才触发高分辨率视频首次解码。
    const prime = video.play();
    if (prime) {
      prime
        .then(() => {
          if (state !== 'traveling') {
            video.pause();
            if (Number.isFinite(video.duration) && video.currentTime > 0.08) video.currentTime = 0.001;
          }
        })
        .catch(() => {
          // Safari/内嵌浏览器可能拦截非手势播放；保留 loadeddata 预热结果即可。
        });
    }
  }, { once: true });
  video.load();
  wormholeLoadStarted = true;
}

function armMobileWormholePlayback() {
  if (!isSmallScreen || state !== 'intro') return Promise.resolve(false);
  if (mobileWormholeStartPromise) return mobileWormholeStartPromise;

  const video = dom.wormholeVideo;
  if (!video) return Promise.resolve(false);
  boostWormholeVideoLoading();
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('x5-playsinline', '');
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) video.load();
  if (video.ended || video.currentTime > 0.25) {
    try { video.currentTime = 0.001; } catch {}
  }

  mobileWormholeStartPromise = new Promise((resolve) => {
    let settled = false;
    const finish = (started, error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutTimer);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('error', onError);
      if (started) {
        delete document.documentElement.dataset.wormholeVideoPlayError;
        document.documentElement.dataset.mobileWormholePlayback = 'playing';
      } else {
        document.documentElement.dataset.mobileWormholePlayback = 'blocked';
        document.documentElement.dataset.wormholeVideoPlayError = error?.name || 'PlaybackTimeout';
        video.pause();
        try { video.currentTime = 0.001; } catch {}
        mobileWormholeStartPromise = null;
      }
      resolve(started);
    };
    const onPlaying = () => finish(true);
    const onTimeUpdate = () => {
      if (!video.paused && video.currentTime > 0.015) finish(true);
    };
    const onError = () => finish(false, video.error || new Error('MediaError'));
    const timeoutTimer = window.setTimeout(() => finish(false, new Error('PlaybackTimeout')), 2600);
    video.addEventListener('playing', onPlaying, { once: true });
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('error', onError, { once: true });
    const playResult = video.play();
    if (playResult) playResult.then(() => finish(true)).catch((error) => finish(false, error));
    else if (!video.paused) finish(true);
  });

  window.clearTimeout(mobileWormholeGestureTimer);
  mobileWormholeGestureTimer = window.setTimeout(() => {
    mobileWormholeGestureTimer = 0;
    if (state !== 'intro' || travelPreparationPending) return;
    video.pause();
    try { video.currentTime = 0.001; } catch {}
    mobileWormholeStartPromise = null;
  }, 1800);

  return mobileWormholeStartPromise;
}

function boostWormholeVideoLoading() {
  const video = dom.wormholeVideo;
  if (!video || wormholeBoosted) return;
  wormholeBoosted = true;
  video.preload = 'auto';
  if (!wormholeLoadStarted) {
    video.src = wormholeTransitionVideoUrl;
    wormholeLoadStarted = true;
  }
  if (video.readyState < 2) video.load();
}

function scheduleWormholeWarmup() {
  const warmup = () => {
    if (state !== 'intro') return;
    boostWormholeVideoLoading();
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmup, { timeout: isSmallScreen ? 2600 : 900 });
  } else {
    window.setTimeout(warmup, isSmallScreen ? 1800 : 500);
  }
}

// 手机端首屏只等待“可立即观看”的黑洞底图与第一帧：
// 五维空间和完整虫洞缓冲改为进入首页后在后台完成，避免 5D WebGL 编译、
// 人物贴图与第二段高码率视频共同阻塞首屏。桌面端仍沿用原来的完整预加载路径。
function prepareDeferredMobileExperience() {
  if (!isSmallScreen) return Promise.resolve();
  if (deferredExperiencePromise) return deferredExperiencePromise;

  deferredExperiencePromise = (async () => {
    setupWormholeVideo();
    const spaceTask = initSpace();
    const wormholeTask = waitForVideoBuffer(dom.wormholeVideo, {
      minimumSeconds: 3.7,
      timeout: 12000
    });
    await Promise.all([spaceTask, wormholeTask]);
    updateSpace(clock.elapsedTime, 0.016);
    deferredExperienceReady = true;
    document.documentElement.dataset.mobileExperienceReady = 'true';
  })().catch((error) => {
    document.documentElement.dataset.mobileExperienceReady = 'failed';
    console.error('手机端后台资源准备失败：', error);
    throw error;
  });

  return deferredExperiencePromise;
}

function clearWarpTransition() {
  document.documentElement.style.setProperty('--warp-canvas-opacity', '0');
}

function resetWormholeWhenIdle(delay = 5200) {
  if (deferredWormholeReset) window.clearTimeout(deferredWormholeReset);
  deferredWormholeReset = window.setTimeout(() => {
    deferredWormholeReset = 0;
    const video = dom.wormholeVideo;
    if (!video || state === 'traveling') return;
    const reset = () => {
      if (!video || state === 'traveling') return;
      try { video.currentTime = 0.001; } catch {}
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(reset, { timeout: 1200 });
    } else {
      window.setTimeout(reset, 180);
    }
  }, delay);
}

function startBlink(now, { arrival = false } = {}) {
  const wasBlinking = document.body.classList.contains('is-blinking');
  document.body.classList.remove('is-blinking');
  if (wasBlinking) void dom.blinkOverlay.offsetWidth;
  document.body.classList.add('is-blinking');
  dom.blinkOverlay.dataset.count = String(Number(dom.blinkOverlay.dataset.count || 0) + 1);
  nextBlinkAt = 0;
  blinkEndsAt = now + 260;
  arrivalBlinkActive = arrival;
  if (arrival) setArrivalPhase('blinking');
}

function scheduleBlink(now = performance.now()) {
  if (reducedMotion || state !== 'space' || activeCategory || document.hidden) return;
  nextBlinkAt = now + 5000 + Math.random() * 5000;
}

function updateBlink(now) {
  if (blinkEndsAt > 0) {
    if (now >= blinkEndsAt) {
      document.body.classList.remove('is-blinking');
      blinkEndsAt = 0;
      if (arrivalBlinkActive) {
        arrivalBlinkActive = false;
        astronautVisible = true;
        document.body.classList.add('has-arrived-character');
        setArrivalPhase('character-visible');
        nextAstronautWaveAt = 0;
      }
      scheduleBlink(now);
    }
    return;
  }
  if (reducedMotion || state !== 'space' || activeCategory || document.hidden) return;
  if (nextBlinkAt === 0) scheduleBlink(now);
  if (nextBlinkAt > 0 && now >= nextBlinkAt) {
    startBlink(now);
  }
}

function createRenderer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: options.antialias ?? true,
    alpha: options.alpha ?? false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.dprCap ?? blackholeDprCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  return renderer;
}

let spaceRenderer;
let astronautRenderer;
let spaceComposer;
let spaceScene;
let spaceCamera;
let cinematicBlurPass;
let corridor;
let dust;
let atmosphere;
let astronautScene;
let portals = [];
let archiveLights = [];
let libraryUniforms;
let astronautGroup;
let astronautMaterial;
let astronautGlow;
let nextAstronautWaveAt = 0;
let astronautWaveStartedAt = -1;
let astronautPanelTimer = 0;
const astronautBasePosition = new THREE.Vector3();
const portalMaterials = [];
const raycaster = new THREE.Raycaster();
const cameraTarget = new THREE.Vector3(0, 0, 15);
const lookTarget = new THREE.Vector3(0, 0, -18);
const tempLook = new THREE.Vector3();

function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#030709');
  gradient.addColorStop(0.48, '#172126');
  gradient.addColorStop(1, '#070e12');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // 冷银长纹与青灰反光，缩小时形成密集但不规则的莫尔纹。
  for (let i = 0; i < 360; i += 1) {
    const y = Math.random() * canvas.height;
    const width = 30 + Math.random() * 260;
    const x = Math.random() * canvas.width;
    const alpha = 0.025 + Math.random() * 0.13;
    context.strokeStyle = `rgba(${80 + Math.random() * 105}, ${105 + Math.random() * 105}, ${118 + Math.random() * 120}, ${alpha})`;
    context.lineWidth = 0.35 + Math.random() * 2.1;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + width * 0.25, y + Math.sin(i) * 3, x + width * 0.7, y - Math.cos(i * 0.7) * 2, x + width, y);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.8, 1.25);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, spaceRenderer.capabilities.getMaxAnisotropy());
  return texture;
}

function createCorridor() {
  corridor = new THREE.Group();
  const woodTexture = createWoodTexture();
  const woodMaterial = new THREE.MeshPhysicalMaterial({
    map: woodTexture,
    color: 0x2c3b42,
    vertexColors: true,
    roughness: 0.34,
    metalness: 0.72,
    emissive: 0x14262e,
    emissiveIntensity: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.2
  });
  const copperMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.72, 1.45, 1.85),
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const maxBoards = isSmallScreen ? 2400 : 5200;
  const maxEdges = isSmallScreen ? 900 : 2200;
  const boardMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), woodMaterial, maxBoards);
  const edgeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), copperMaterial, maxEdges);
  boardMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  edgeMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  const worldPosition = new THREE.Vector3();
  const baseQuaternion = new THREE.Quaternion();
  const localQuaternion = new THREE.Quaternion();
  const worldQuaternion = new THREE.Quaternion();
  let boardIndex = 0;
  let edgeIndex = 0;
  const woodColors = [0x303e44, 0x172329, 0x536064, 0x0b1216, 0x263940, 0x414f54, 0x112128].map((color) => new THREE.Color(color));

  function addInstance(mesh, index, localPosition, scale, origin, tunnelQuaternion, rotation, color) {
    worldPosition.copy(localPosition).applyQuaternion(tunnelQuaternion).add(origin);
    localQuaternion.setFromEuler(rotation);
    worldQuaternion.copy(tunnelQuaternion).multiply(localQuaternion);
    dummy.position.copy(worldPosition);
    dummy.quaternion.copy(worldQuaternion);
    dummy.scale.copy(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (color) mesh.setColorAt(index, color);
  }

  function addBoard(localPosition, scale, origin, quaternion, rotation, colorIndex) {
    if (boardIndex >= maxBoards) return;
    addInstance(boardMesh, boardIndex, localPosition, scale, origin, quaternion, rotation, woodColors[colorIndex % woodColors.length]);
    boardIndex += 1;
  }

  function addEdge(localPosition, scale, origin, quaternion, rotation) {
    if (edgeIndex >= maxEdges) return;
    addInstance(edgeMesh, edgeIndex, localPosition, scale, origin, quaternion, rotation);
    edgeIndex += 1;
  }

  function addTunnel({ layers, bands, width, height, spacing, start, rotation, taper = 0, phase = 0 }) {
    baseQuaternion.setFromEuler(rotation);
    const origin = start.clone();
    const layerCenter = new THREE.Vector3();
    const jitterQuaternion = new THREE.Quaternion();
    const tunnelQuaternion = new THREE.Quaternion();
    const horizontalRotation = new THREE.Euler(0, 0, 0);
    const verticalRotation = new THREE.Euler(0, 0, 0);

    for (let layer = 0; layer < layers; layer += 1) {
      layerCenter.set(0, 0, -layer * spacing).applyQuaternion(baseQuaternion).add(start);
      jitterQuaternion.setFromEuler(new THREE.Euler(
        Math.sin(layer * 0.37 + phase) * 0.008,
        Math.cos(layer * 0.31 + phase) * 0.009,
        Math.sin(layer * 0.23 + phase) * 0.012
      ));
      tunnelQuaternion.copy(baseQuaternion).multiply(jitterQuaternion);
      const layerScale = 1 + layer * taper;

      for (let band = 0; band < bands; band += 1) {
        const inset = band * 0.31;
        const frameWidth = Math.max(2.3, width * layerScale - inset * 2);
        const frameHeight = Math.max(1.8, height * layerScale - inset * 2);
        const thickness = 0.09 + (band % 4) * 0.023;
        const depth = 0.34 + (band % 5) * 0.085;
        const zOffset = (band - bands * 0.5) * 0.085;
        const colorIndex = layer + band + Math.floor(phase * 4);

        addBoard(new THREE.Vector3(0, frameHeight * 0.5, zOffset), new THREE.Vector3(frameWidth, thickness, depth), layerCenter, tunnelQuaternion, horizontalRotation, colorIndex);
        addBoard(new THREE.Vector3(0, -frameHeight * 0.5, zOffset), new THREE.Vector3(frameWidth, thickness, depth), layerCenter, tunnelQuaternion, horizontalRotation, colorIndex + 1);
        addBoard(new THREE.Vector3(-frameWidth * 0.5, 0, zOffset), new THREE.Vector3(thickness, frameHeight, depth), layerCenter, tunnelQuaternion, verticalRotation, colorIndex + 2);
        addBoard(new THREE.Vector3(frameWidth * 0.5, 0, zOffset), new THREE.Vector3(thickness, frameHeight, depth), layerCenter, tunnelQuaternion, verticalRotation, colorIndex + 3);

        // 稀疏铜金内沿只勾出尺度，不把空间重新画成线框。
        if ((band + layer) % 3 === 0) {
          const rail = 0.052 + (layer % 3) * 0.014;
          addEdge(new THREE.Vector3(0, frameHeight * 0.5 - thickness * 0.62, zOffset - depth * 0.48), new THREE.Vector3(frameWidth, rail, rail), layerCenter, tunnelQuaternion, horizontalRotation);
          addEdge(new THREE.Vector3(0, -frameHeight * 0.5 + thickness * 0.62, zOffset - depth * 0.48), new THREE.Vector3(frameWidth, rail, rail), layerCenter, tunnelQuaternion, horizontalRotation);
          addEdge(new THREE.Vector3(-frameWidth * 0.5 + thickness * 0.62, 0, zOffset - depth * 0.48), new THREE.Vector3(rail, frameHeight, rail), layerCenter, tunnelQuaternion, verticalRotation);
          addEdge(new THREE.Vector3(frameWidth * 0.5 - thickness * 0.62, 0, zOffset - depth * 0.48), new THREE.Vector3(rail, frameHeight, rail), layerCenter, tunnelQuaternion, verticalRotation);
        }
      }

      // 交错书架切面让多个空间在同一深度相互穿过。
      if (layer % 3 === 1) {
        const crossWidth = width * layerScale * 0.72;
        const crossHeight = height * layerScale * 0.7;
        const offsetX = (layer % 2 ? -1 : 1) * width * 0.13;
        addBoard(new THREE.Vector3(offsetX, 0, 0.35), new THREE.Vector3(0.17, crossHeight, 1.15), layerCenter, tunnelQuaternion, verticalRotation, layer + 2);
        addBoard(new THREE.Vector3(0, (layer % 4 - 1.5) * 0.82, -0.22), new THREE.Vector3(crossWidth, 0.15, 0.95), layerCenter, tunnelQuaternion, horizontalRotation, layer + 3);
      }
    }
  }

  function addJunctionCluster({ center, count, spread, rotation, seed = 1 }) {
    const clusterQuaternion = new THREE.Quaternion().setFromEuler(rotation);
    const noRotation = new THREE.Euler(0, 0, 0);
    let value = seed;
    const random = () => {
      value = Math.sin(value * 92.173 + 17.31) * 43758.5453;
      return value - Math.floor(value);
    };

    for (let i = 0; i < count; i += 1) {
      const axis = i % 5 === 0 ? 2 : i % 2;
      const length = 4.8 + random() * 9.5;
      const thickness = 0.085 + random() * 0.2;
      const depth = 0.3 + random() * 0.72;
      const localPosition = new THREE.Vector3(
        (random() - 0.5) * spread.x,
        (random() - 0.5) * spread.y,
        (random() - 0.5) * spread.z
      );
      // 轻微量化位置，让隔板像被无穷复制的建筑模数，而不是随机碎片。
      localPosition.x = Math.round(localPosition.x * 3) / 3;
      localPosition.y = Math.round(localPosition.y * 3) / 3;
      localPosition.z = Math.round(localPosition.z * 2) / 2;
      const scale = axis === 0
        ? new THREE.Vector3(length, thickness, depth)
        : axis === 1
          ? new THREE.Vector3(thickness, length, depth)
          : new THREE.Vector3(thickness, depth, length);
      addBoard(localPosition, scale, center, clusterQuaternion, noRotation, i + 2);

      if (i % 3 === 0) {
        const edgeScale = scale.clone();
        if (axis === 0) edgeScale.set(length, 0.042, 0.042);
        if (axis === 1) edgeScale.set(0.042, length, 0.042);
        if (axis === 2) edgeScale.set(0.042, 0.042, length);
        addEdge(localPosition.clone().add(new THREE.Vector3(0.03, 0.03, -0.04)), edgeScale, center, clusterQuaternion, noRotation);
      }
    }
  }

  addTunnel({
    layers: isSmallScreen ? 11 : 17,
    bands: isSmallScreen ? 5 : 7,
    width: 10.6,
    height: 7.1,
    spacing: 3.25,
    start: new THREE.Vector3(1.2, 0, 4),
    rotation: new THREE.Euler(0.02, 0.08, -0.08),
    phase: 0.2
  });
  // X−：横向无尽路径。
  addTunnel({
    layers: isSmallScreen ? 9 : 13,
    bands: isSmallScreen ? 4 : 5,
    width: 7.8,
    height: 5.8,
    spacing: 3.05,
    start: new THREE.Vector3(-4.8, 1.5, -7),
    rotation: new THREE.Euler(0.04, Math.PI * 0.5, 0.1),
    taper: -0.002,
    phase: 1.7
  });
  // Y+：通向上方的垂直井。
  addTunnel({
    layers: isSmallScreen ? 9 : 14,
    bands: isSmallScreen ? 4 : 5,
    width: 7.4,
    height: 5.6,
    spacing: 3.0,
    start: new THREE.Vector3(4.2, 4.2, -11),
    rotation: new THREE.Euler(Math.PI * 0.5, 0.06, 0.16),
    taper: 0,
    phase: 3.4
  });
  // Y−：与上方井错位的下坠路径。
  addTunnel({
    layers: isSmallScreen ? 9 : 14,
    bands: isSmallScreen ? 4 : 5,
    width: 7.6,
    height: 5.7,
    spacing: 3.0,
    start: new THREE.Vector3(-4.1, -4.1, -13),
    rotation: new THREE.Euler(-Math.PI * 0.5, -0.05, -0.14),
    taper: 0,
    phase: 5.2
  });

  boardMesh.count = boardIndex;
  edgeMesh.count = edgeIndex;
  boardMesh.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceMatrix.needsUpdate = true;
  if (boardMesh.instanceColor) boardMesh.instanceColor.needsUpdate = true;
  boardMesh.frustumCulled = false;
  edgeMesh.frustumCulled = false;
  const ghostMaterial = copperMaterial.clone();
  ghostMaterial.color = new THREE.Color(0.42, 0.72, 1.35);
  ghostMaterial.opacity = 0.085;
  const ghostEdgeMesh = edgeMesh.clone();
  ghostEdgeMesh.material = ghostMaterial;
  ghostEdgeMesh.position.set(0.035, -0.025, -0.06);
  ghostEdgeMesh.scale.setScalar(1.004);
  ghostEdgeMesh.frustumCulled = false;
  corridor.add(boardMesh, edgeMesh, ghostEdgeMesh);
  corridor.userData.woodTexture = woodTexture;
  corridor.userData.edgeMaterial = copperMaterial;

  spaceScene.add(corridor);
}

function createLibrarySpace() {
  corridor = new THREE.Group();
  const grainTexture = createWoodTexture();
  const structureMaterial = new THREE.MeshPhysicalMaterial({
    map: grainTexture,
    color: 0x665b52,
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.62,
    emissive: 0x070909,
    emissiveIntensity: 0.08,
    clearcoat: 0.78,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.42
  });
  const reflectionMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb5b6ae,
    vertexColors: true,
    roughness: 0.13,
    metalness: 0.94,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.15
  });
  const glintMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.25, 1.05, 0.78),
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const maxStructure = isSmallScreen ? 2600 : 5600;
  const maxReflection = isSmallScreen ? 700 : 1500;
  const maxGlints = isSmallScreen ? 300 : 700;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const structureMesh = new THREE.InstancedMesh(geometry, structureMaterial, maxStructure);
  const reflectionMesh = new THREE.InstancedMesh(geometry, reflectionMaterial, maxReflection);
  const glintMesh = new THREE.InstancedMesh(geometry, glintMaterial, maxGlints);
  const dummy = new THREE.Object3D();
  const worldPosition = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const worldQuaternion = new THREE.Quaternion();
  const shelfColors = [0x1a1918, 0x2a2724, 0x3d3732, 0x151a1b, 0x51473e, 0x252a29, 0x675b50].map((color) => new THREE.Color(color));
  const reflectionColors = [0x7f8583, 0xc5c1b7, 0x7d6e60, 0xa7b2b1].map((color) => new THREE.Color(color));
  let structureIndex = 0;
  let reflectionIndex = 0;
  let glintIndex = 0;

  function add(mesh, index, localPosition, scale, origin, moduleQuaternion, color) {
    worldPosition.copy(localPosition).applyQuaternion(moduleQuaternion).add(origin);
    localQuaternion.identity();
    worldQuaternion.copy(moduleQuaternion).multiply(localQuaternion);
    dummy.position.copy(worldPosition);
    dummy.quaternion.copy(worldQuaternion);
    dummy.scale.copy(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (color) mesh.setColorAt(index, color);
  }

  function addStructure(position, scale, origin, quaternion, colorIndex) {
    if (structureIndex >= maxStructure) return;
    add(structureMesh, structureIndex, position, scale, origin, quaternion, shelfColors[colorIndex % shelfColors.length]);
    structureIndex += 1;
  }

  function addReflection(position, scale, origin, quaternion, colorIndex) {
    if (reflectionIndex >= maxReflection) return;
    add(reflectionMesh, reflectionIndex, position, scale, origin, quaternion, reflectionColors[colorIndex % reflectionColors.length]);
    reflectionIndex += 1;
  }

  function addGlint(position, scale, origin, quaternion) {
    if (glintIndex >= maxGlints) return;
    add(glintMesh, glintIndex, position, scale, origin, quaternion);
    glintIndex += 1;
  }

  function addShelfBlock({ center, size, rotation, slices, rows, columns, phase = 0 }) {
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    const halfWidth = size.x * 0.5;
    const halfHeight = size.y * 0.5;
    const halfDepth = size.z * 0.5;
    const sliceStep = size.z / Math.max(1, slices - 1);

    for (let slice = 0; slice < slices; slice += 1) {
      const z = -halfDepth + slice * sliceStep;
      const wave = Math.sin(slice * 0.83 + phase) * 0.055;
      const plankDepth = 0.48 + (slice % 4) * 0.09;

      for (let row = 0; row <= rows; row += 1) {
        const y = THREE.MathUtils.lerp(-halfHeight, halfHeight, row / rows);
        if (Math.abs(y) < 1.15) continue;
        const thickness = 0.11 + (row % 4) * 0.032;
        addStructure(
          new THREE.Vector3(wave, y, z),
          new THREE.Vector3(size.x, thickness, plankDepth),
          center,
          quaternion,
          slice + row
        );
        if ((slice + row) % 9 === 0) {
          addReflection(
            new THREE.Vector3(wave, y + thickness * 0.58, z - plankDepth * 0.48),
            new THREE.Vector3(size.x * 0.96, 0.025, 0.026),
            center,
            quaternion,
            slice + row
          );
        }
      }

      for (let column = 0; column <= columns; column += 1) {
        const x = THREE.MathUtils.lerp(-halfWidth, halfWidth, column / columns);
        if (Math.abs(x) < 1.35) continue;
        const thickness = 0.12 + (column % 3) * 0.036;
        addStructure(
          new THREE.Vector3(x, 0, z + wave),
          new THREE.Vector3(thickness, size.y, plankDepth * 0.92),
          center,
          quaternion,
          slice + column + 2
        );
      }

      if (slice % 3 === 0) {
        const inset = 0.52 + (slice % 2) * 0.34;
        addStructure(new THREE.Vector3(0, halfHeight - inset, z + 0.18), new THREE.Vector3(size.x * 0.86, 0.13, 0.6), center, quaternion, slice + 4);
        addStructure(new THREE.Vector3(-halfWidth + inset, 0, z - 0.14), new THREE.Vector3(0.13, size.y * 0.82, 0.54), center, quaternion, slice + 5);
      }
    }

    // 贯穿整个模块的纵深导轨，是读出 X/Y/Z 轴向的关键。
    for (let column = 0; column <= Math.min(columns, 6); column += 1) {
      const x = THREE.MathUtils.lerp(-halfWidth, halfWidth, column / Math.min(columns, 6));
      [-halfHeight, halfHeight].forEach((y, side) => {
        addStructure(new THREE.Vector3(x, y, 0), new THREE.Vector3(0.11, 0.11, size.z), center, quaternion, column + side + 1);
        if ((column + side) % 4 === 0) {
          addGlint(new THREE.Vector3(x + 0.04, y + 0.04, 0), new THREE.Vector3(0.022, 0.022, size.z * 0.92), center, quaternion);
        }
      });
    }
    [-halfWidth, halfWidth].forEach((x, side) => {
      [-halfHeight * 0.5, 0, halfHeight * 0.5].forEach((y, row) => {
        addStructure(new THREE.Vector3(x, y, 0), new THREE.Vector3(0.12, 0.12, size.z), center, quaternion, side + row + 3);
      });
    });

    // 模块内部的纵深纤维：从相机附近贯穿到消失点，避免“空心脚手架”。
    for (let column = 0; column <= columns; column += 1) {
      const x = THREE.MathUtils.lerp(-halfWidth, halfWidth, column / columns);
      for (let row = 1; row < rows; row += 2) {
        const y = THREE.MathUtils.lerp(-halfHeight, halfHeight, row / rows);
        if (Math.abs(x) < 0.55 && Math.abs(y) < 0.55) continue;
        addStructure(
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(0.055 + (row % 3) * 0.018, 0.055 + (column % 3) * 0.018, size.z),
          center,
          quaternion,
          column + row + 4
        );
      }
    }
  }

  addShelfBlock({
    center: new THREE.Vector3(0, 0, -10),
    size: new THREE.Vector3(18, 12, 54),
    rotation: new THREE.Euler(0.02, 0.055, -0.055),
    slices: isSmallScreen ? 13 : 19,
    rows: isSmallScreen ? 11 : 17,
    columns: isSmallScreen ? 7 : 11,
    phase: 0.3
  });
  addShelfBlock({
    center: new THREE.Vector3(-1.5, 0.7, -13),
    size: new THREE.Vector3(13, 9, 46),
    rotation: new THREE.Euler(0.035, Math.PI * 0.5, 0.08),
    slices: isSmallScreen ? 10 : 15,
    rows: isSmallScreen ? 9 : 13,
    columns: isSmallScreen ? 5 : 8,
    phase: 1.8
  });
  addShelfBlock({
    center: new THREE.Vector3(1.8, 0, -15),
    size: new THREE.Vector3(13, 9, 46),
    rotation: new THREE.Euler(Math.PI * 0.5, 0.055, -0.09),
    slices: isSmallScreen ? 10 : 15,
    rows: isSmallScreen ? 9 : 13,
    columns: isSmallScreen ? 5 : 8,
    phase: 3.2
  });
  addShelfBlock({
    center: new THREE.Vector3(4.5, -3.2, -32),
    size: new THREE.Vector3(10, 7.2, 27),
    rotation: new THREE.Euler(-0.38, -0.62, 0.18),
    slices: isSmallScreen ? 7 : 10,
    rows: 9,
    columns: 6,
    phase: 6.1
  });

  [structureMesh, reflectionMesh, glintMesh].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
  });
  structureMesh.count = structureIndex;
  reflectionMesh.count = reflectionIndex;
  glintMesh.count = glintIndex;
  corridor.add(structureMesh, reflectionMesh, glintMesh);
  corridor.userData.woodTexture = grainTexture;
  corridor.userData.edgeMaterial = glintMaterial;
  spaceScene.add(corridor);
}

function createRaymarchedLibrary() {
  corridor = new THREE.Group();
  libraryUniforms = {
    uTime: { value: 0 },
    uResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(spaceRenderer.getPixelRatio())
    },
    uPointer: { value: new THREE.Vector2() },
    uMaxSteps: { value: window.innerWidth < 720 ? 38 : 48 },
    uDepth: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: librarySpaceVertex,
    fragmentShader: librarySpaceFragment,
    uniforms: libraryUniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  plane.frustumCulled = false;
  plane.renderOrder = -1000;
  corridor.add(plane);
  corridor.userData.raymarched = true;
  spaceScene.add(corridor);
}

function createAtmosphere() {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(96, 96, 0, 96, 96, 96);
  gradient.addColorStop(0, 'rgba(222,248,255,.9)');
  gradient.addColorStop(0.12, 'rgba(116,211,255,.38)');
  gradient.addColorStop(0.45, 'rgba(48,122,158,.12)');
  gradient.addColorStop(1, 'rgba(0,18,28,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 192, 192);
  const texture = new THREE.CanvasTexture(canvas);

  atmosphere = new THREE.Group();
  const hazePoints = [
    { p: [0.8, 0.4, -5], s: 8.5, o: 0.075 },
    { p: [-8.5, 1.5, -7], s: 6.2, o: 0.045 },
    { p: [4.2, 9.5, -11], s: 6.8, o: 0.04 },
    { p: [-4.1, -9.5, -13], s: 7.2, o: 0.038 },
    { p: [1.2, 0, -38], s: 9.6, o: 0.03 }
  ];
  hazePoints.forEach((settings, index) => {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: index === 2 ? 0xbfd9ff : 0x92ddff,
      transparent: true,
      opacity: settings.o,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...settings.p);
    sprite.scale.set(settings.s, settings.s, 1);
    sprite.userData.baseOpacity = settings.o;
    atmosphere.add(sprite);
  });
  atmosphere.userData.texture = texture;
  spaceScene.add(atmosphere);
}

function createGlassVolumes() {
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x476978,
    transparent: true,
    opacity: 0.075,
    transmission: 0.42,
    thickness: 0.65,
    ior: 1.36,
    roughness: 0.12,
    metalness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.15,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const settings = [
    { p: [-3.8, 1.7, -6], s: [5.8, 0.055, 3.8], r: [0.1, 0.25, 0.62] },
    { p: [4.7, -1.9, -10], s: [0.06, 6.4, 4.1], r: [-0.18, -0.42, 0.08] },
    { p: [0.2, 3.9, -15], s: [6.5, 0.05, 4.8], r: [0.42, 0.08, -0.24] },
    { p: [-5.4, -2.8, -19], s: [0.055, 7.2, 3.6], r: [0.08, 0.58, 0.32] },
    { p: [3.2, 1.2, -25], s: [6.8, 4.6, 0.055], r: [-0.1, 0.32, -0.38] },
    { p: [-1.3, -4.4, -32], s: [7.4, 0.05, 4.2], r: [0.46, -0.18, 0.52] }
  ];
  settings.forEach((item, index) => {
    const panel = new THREE.Mesh(geometry, material.clone());
    panel.position.set(...item.p);
    panel.scale.set(...item.s);
    panel.rotation.set(...item.r);
    panel.material.opacity *= 0.8 + index * 0.05;
    group.add(panel);
  });
  spaceScene.add(group);
}

function createChamberShell() {
  const shell = new THREE.Group();
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0c1519,
    roughness: 0.6,
    metalness: 0.34,
    emissive: 0x071218,
    emissiveIntensity: 0.12,
    clearcoat: 0.48,
    clearcoatRoughness: 0.36,
    envMapIntensity: 0.08,
    side: THREE.DoubleSide
  });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const walls = [
    { p: [-15, 0, -22], s: [0.25, 18.4, 84] },
    { p: [15, 0, -22], s: [0.25, 18.4, 84] },
    { p: [0, 0, -64], s: [30, 18.4, 0.25] }
  ];
  walls.forEach((item, index) => {
    const wall = new THREE.Mesh(geometry, wallMaterial.clone());
    wall.position.set(...item.p);
    wall.scale.set(...item.s);
    wall.material.color.offsetHSL(index % 2 ? 0.01 : -0.01, 0, index === 4 ? -0.035 : 0);
    shell.add(wall);
  });

  // 内壁上的少量连续导光槽，填补空洞但不重新制造视觉噪声。
  const stripMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.42, 1.08, 1.35),
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  for (let i = 0; i < 8; i += 1) {
    const strip = new THREE.Mesh(geometry, stripMaterial);
    strip.position.set(-10.5 + i * 3, i % 2 ? 9.02 : -9.02, -22);
    strip.scale.set(0.035, 0.035, 76);
    shell.add(strip);
  }

  const ribMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x26363d,
    roughness: 0.3,
    metalness: 0.68,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.28
  });
  for (let i = -5; i <= 5; i += 1) {
    [-8.92, 8.92].forEach((y) => {
      const rib = new THREE.Mesh(geometry, ribMaterial);
      rib.position.set(i * 2.45, y, -22);
      rib.scale.set(0.11, 0.18, 80);
      shell.add(rib);
    });
  }
  for (let i = 0; i < 9; i += 1) {
    [-8.88, 8.88].forEach((y) => {
      const crossRib = new THREE.Mesh(geometry, ribMaterial);
      crossRib.position.set(0, y, 10 - i * 9);
      crossRib.scale.set(29, 0.16, 0.14);
      shell.add(crossRib);
    });
  }
  spaceScene.add(shell);
}

function createDust() {
  const count = reducedMotion ? 800 : (isSmallScreen ? 1800 : 3600);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const gold = new THREE.Color(0xd5a56a);
  const pale = new THREE.Color(0xe9f2ff);
  for (let i = 0; i < count; i += 1) {
    const radius = 1.5 + Math.pow(Math.random(), 0.48) * 15;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius * 0.72;
    positions[i * 3 + 2] = 12 - Math.random() * 125;
    const color = gold.clone().lerp(pale, Math.random());
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: isSmallScreen ? 0.026 : 0.038,
    transparent: true,
    opacity: 0.72,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  dust = new THREE.Points(geometry, material);
  spaceScene.add(dust);
}

function createLightBeams() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, 'rgba(255,183,85,0)');
  gradient.addColorStop(0.18, 'rgba(255,188,92,.12)');
  gradient.addColorStop(0.5, 'rgba(255,236,184,.72)');
  gradient.addColorStop(0.82, 'rgba(255,188,92,.12)');
  gradient.addColorStop(1, 'rgba(255,183,85,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);

  const beamGroup = new THREE.Group();
  const beams = [
    { p: [-4.5, 2.8, -7], s: [26, 2.2], r: -0.3, o: 0.022 },
    { p: [5.6, -1.2, -22], s: [32, 1.8], r: 0.43, o: 0.016 },
    { p: [-2.0, -3.4, -39], s: [30, 2.4], r: 1.08, o: 0.012 },
    { p: [1.8, 4.6, -58], s: [36, 1.9], r: -0.72, o: 0.01 }
  ];
  beams.forEach((settings) => {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color(1.6, 0.72, 0.24),
      transparent: true,
      opacity: settings.o,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    beam.position.set(...settings.p);
    beam.scale.set(...settings.s, 1);
    beam.rotation.z = settings.r;
    beam.rotation.y = -0.12;
    beamGroup.add(beam);
  });
  beamGroup.userData.texture = texture;
  spaceScene.add(beamGroup);
}

function createPortalMaterial(seed) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uHover: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uSeed;
      uniform float uHover;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float edge = 1.0 - smoothstep(0.82, 1.0, max(abs(p.x), abs(p.y)));
        float scan = pow(max(0.0, sin((vUv.y + uTime * .045 + uSeed) * 48.0)), 20.0);
        float pulse = .5 + .5 * sin(uTime * 1.2 + uSeed * 9.0);
        vec3 color = mix(vec3(.08, .32, .42), vec3(.72, 1.35, 1.55), vUv.y + scan);
        float alpha = edge * (uHover * (.018 + scan * .055 + pulse * .012));
        gl_FragColor = vec4(color, alpha);
      }
    `
  });
}

function createPortal(category, position, seed) {
  const group = new THREE.Group();
  const material = createPortalMaterial(seed);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.2), material);
  plane.userData.category = category;
  group.add(plane);

  group.position.copy(position);
  group.userData.baseY = position.y;
  group.userData.category = category;
  group.userData.plane = plane;
  spaceScene.add(group);
  portals.push(group);
  portalMaterials.push(material);
}

function positionAstronautForViewport() {
  if (!astronautGroup) return;
  if (window.innerWidth < 720) {
    astronautBasePosition.set(-0.9, 0.85, 0.65);
    astronautGroup.scale.setScalar(1.08);
  } else {
    astronautBasePosition.set(-4.0, 1.08, 0.55);
    astronautGroup.scale.setScalar(1.78);
  }
  astronautGroup.position.copy(astronautBasePosition);
}

async function createAstronaut() {
  const loader = new THREE.TextureLoader();
  const [idleMap, waveMap] = await Promise.all([
    loader.loadAsync(astronautIdleUrl),
    loader.loadAsync(astronautWaveUrl)
  ]);
  [idleMap, waveMap].forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(4, spaceRenderer.capabilities.getMaxAnisotropy());
  });

  astronautMaterial = new THREE.ShaderMaterial({
    vertexShader: astronautVertex,
    fragmentShader: astronautFragment,
    uniforms: {
      uIdleMap: { value: idleMap },
      uWaveMap: { value: waveMap },
      uTime: { value: 0 },
      uWaveBlend: { value: 0 },
      uWaveMotion: { value: 0 },
      uReveal: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / 1023, 1 / 1537) }
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const character = new THREE.Mesh(new THREE.PlaneGeometry(5.55, 8.35, 28, 42), astronautMaterial);
  character.frustumCulled = false;
  character.renderOrder = 20;

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(128, 128, 5, 128, 128, 128);
  glowGradient.addColorStop(0, 'rgba(124,210,220,.24)');
  glowGradient.addColorStop(0.42, 'rgba(75,151,163,.09)');
  glowGradient.addColorStop(1, 'rgba(0,22,28,0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 256, 256);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x9fcfd2,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  astronautGlow = new THREE.Sprite(glowMaterial);
  astronautGlow.scale.set(7.4, 9.2, 1);
  astronautGlow.position.z = -0.12;
  astronautGlow.renderOrder = 19;

  astronautGroup = new THREE.Group();
  astronautGroup.add(astronautGlow, character);
  astronautGroup.rotation.set(-0.025, 0.035, -0.015);
  astronautGroup.userData.character = character;
  astronautGroup.userData.glowTexture = glowTexture;
  positionAstronautForViewport();
  astronautScene.add(astronautGroup);
}

function updateAstronaut(time, delta) {
  if (!astronautGroup || !astronautMaterial) return;

  const travelReveal = astronautVisible && !activeCategory ? 1 : 0;
  astronautMaterial.uniforms.uReveal.value = damp(
    astronautMaterial.uniforms.uReveal.value,
    travelReveal,
    activeCategory ? 18 : 4.2,
    delta
  );
  astronautGlow.material.opacity = 0.24 * astronautMaterial.uniforms.uReveal.value;

  const sceneSway = reducedMotion
    ? 0
    : Math.sin(time * 0.34 + 0.35) * 0.24 + smoothPointer.x * 0.22;
  astronautGroup.position.set(
    astronautBasePosition.x + sceneSway,
    astronautBasePosition.y + (reducedMotion ? 0 : Math.sin(time * 0.47) * 0.19),
    astronautBasePosition.z + (reducedMotion ? 0 : Math.cos(time * 0.26) * 0.12)
  );
  if (!reducedMotion) {
    // 以参考姿态为中心来回翻滚，避免首次进入时因累计角度随机倒置。
    astronautGroup.rotation.x = -0.025 + Math.sin(time * 0.27) * 0.075;
    astronautGroup.rotation.y = 0.035 + Math.sin(time * 0.21 + 1.2) * 0.13;
    astronautGroup.rotation.z = -0.035 + Math.sin(time * 0.13 + 0.6) * 0.14;
  }

  if (state === 'space' && astronautVisible && !activeCategory && !reducedMotion) {
    if (nextAstronautWaveAt === 0) nextAstronautWaveAt = time + 5 + Math.random() * 5;
    if (astronautWaveStartedAt < 0 && time >= nextAstronautWaveAt) astronautWaveStartedAt = time;
  }

  let waveBlend = 0;
  let waveMotion = 0;
  if (astronautWaveStartedAt >= 0) {
    const phase = time - astronautWaveStartedAt;
    if (phase < 0.5) waveBlend = smoothstep(0, 0.5, phase);
    else if (phase < 2.55) waveBlend = 1;
    else if (phase < 3.1) waveBlend = 1 - smoothstep(2.55, 3.1, phase);
    else {
      astronautWaveStartedAt = -1;
      nextAstronautWaveAt = time + 5 + Math.random() * 5;
    }
    waveMotion = waveBlend * smoothstep(0.45, 0.8, phase) * (1 - smoothstep(2.3, 2.8, phase));
  }

  astronautMaterial.uniforms.uTime.value = time;
  astronautMaterial.uniforms.uWaveBlend.value = damp(
    astronautMaterial.uniforms.uWaveBlend.value,
    waveBlend,
    9,
    delta
  );
  astronautMaterial.uniforms.uWaveMotion.value = waveMotion;
  document.documentElement.dataset.astronautPose = waveBlend > 0.55 ? 'wave' : 'rest';
}

async function initSpace() {
  spaceRenderer = createRenderer(dom.spaceCanvas, { dprCap: spaceDprCap });
  spaceRenderer.toneMappingExposure = 0.82;
  astronautRenderer = createRenderer(dom.astronautCanvas, {
    antialias: true,
    alpha: true,
    dprCap: isSmallScreen ? 1 : 1.4
  });
  astronautRenderer.setClearColor(0x000000, 0);
  astronautRenderer.toneMappingExposure = 1.02;
  spaceScene = new THREE.Scene();
  astronautScene = new THREE.Scene();
  spaceScene.background = new THREE.Color(0x010202);
  spaceScene.fog = new THREE.FogExp2(0x060707, 0.0068);
  spaceCamera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 320);
  spaceCamera.position.set(0, 0, 15);

  // 程序化摄影棚反射，专门用于把枪灰金属从纯黑中拉出来。
  const pmremGenerator = new THREE.PMREMGenerator(spaceRenderer);
  const roomEnvironment = new RoomEnvironment();
  spaceScene.environment = pmremGenerator.fromScene(roomEnvironment, 0.035).texture;
  roomEnvironment.dispose();
  pmremGenerator.dispose();

  spaceScene.add(new THREE.HemisphereLight(0x91a6ac, 0x010202, 0.28));
  const lightSettings = [
    { p: [-7, 8, 5], t: [0, 0, -16], c: 0xe9f4f3, i: 56, d: 105, a: 0.4 },
    { p: [10, -4, -7], t: [0, 0, -30], c: 0x9fcbd1, i: 46, d: 96, a: 0.44 },
    { p: [-9, 2, -35], t: [1, 0, -58], c: 0xffd2a3, i: 34, d: 90, a: 0.34 }
  ];
  lightSettings.forEach((settings) => {
    const light = new THREE.SpotLight(settings.c, settings.i, settings.d, settings.a, 0.82, 1.55);
    light.position.set(...settings.p);
    light.target.position.set(...settings.t);
    light.userData.baseIntensity = settings.i;
    spaceScene.add(light, light.target);
    archiveLights.push(light);
  });
  const nearLight = new THREE.PointLight(0xb9d7d7, 38, 62, 1.75);
  nearLight.position.set(-1, 2, 12);
  nearLight.userData.baseIntensity = 38;
  spaceScene.add(nearLight);
  archiveLights.push(nearLight);

  const fillLights = [
    { p: [-11, 3, 8], c: 0xeaf3f2, i: 18, d: 42 },
    { p: [12, -5, 1], c: 0x89bfc7, i: 15, d: 48 },
    { p: [-3, -8, -12], c: 0xa8c6c7, i: 13, d: 55 },
    { p: [4, 7, -22], c: 0xffbc7d, i: 16, d: 46 }
  ];
  fillLights.forEach((settings) => {
    const light = new THREE.PointLight(settings.c, settings.i, settings.d, 1.7);
    light.position.set(...settings.p);
    light.userData.baseIntensity = settings.i;
    spaceScene.add(light);
    archiveLights.push(light);
  });

  const axisBeacons = [
    { p: [1.2, 0, -48], c: 0xb7dcdd, i: 25, d: 44 },
    { p: [-30, 1.5, -7], c: 0x82b8c0, i: 22, d: 40 },
    { p: [4.2, 29, -11], c: 0xdbe9e7, i: 24, d: 43 },
    { p: [-4.1, -29, -13], c: 0x79aeb5, i: 22, d: 43 }
  ];
  axisBeacons.forEach((settings) => {
    const beacon = new THREE.PointLight(settings.c, settings.i, settings.d, 1.5);
    beacon.position.set(...settings.p);
    beacon.userData.baseIntensity = settings.i;
    spaceScene.add(beacon);
    archiveLights.push(beacon);
  });

  createRaymarchedLibrary();

  await createAstronaut();

  createPortal('plugin', new THREE.Vector3(-5.3, -0.15, -10), 0.17);
  createPortal('photo', new THREE.Vector3(0, 0.45, -14), 0.51);
  createPortal('video', new THREE.Vector3(5.3, -0.15, -10), 0.83);

  spaceComposer = new EffectComposer(spaceRenderer);
  spaceComposer.addPass(new RenderPass(spaceScene, spaceCamera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isSmallScreen ? 0.14 : 0.18,
    0.52,
    0.68
  );
  spaceComposer.addPass(bloom);
  cinematicBlurPass = null;
  blurBaseStrength = 0;
  spaceComposer.addPass(new OutputPass());
  spaceRenderer.compile(spaceScene, spaceCamera);
  updateSpace(0, 1 / 60);
}

function updateSpace(time, delta) {
  smoothPointer.lerp(pointer, reducedMotion ? 0.02 : 0.055);
  const depth = state === 'space' && !activeCategory ? scrollDepth : 0;
  const entryAlignment = state === 'traveling'
    ? smoothstep(0.68, 1, travelProgress)
    : 1;

  if (cinematicBlurPass) {
    blurImpulse = reducedMotion ? 0 : damp(blurImpulse, 0, 3.4, delta);
    cinematicBlurPass.uniforms.uDirection.value.set(
      1,
      -0.16 + smoothPointer.x * 0.2 + smoothPointer.y * 0.045
    );
    cinematicBlurPass.uniforms.uStrength.value = blurBaseStrength + Math.abs(blurImpulse) * 1.35;
  }

  if (!activeCategory) {
    const axialDriftX = reducedMotion ? 0 : Math.sin(time * 0.085) * 0.72;
    const axialDriftY = reducedMotion ? 0 : Math.sin(time * 0.11 + 0.8) * 0.88;
    if (state === 'traveling') {
      // 入场阶段先锁住正前方消失点，随后才展开五维空间原有的倾斜与漂移。
      cameraTarget.set(0, 0, THREE.MathUtils.lerp(23, 15, entryAlignment));
      lookTarget.set(0, 0, -24);
    } else {
      cameraTarget.set(
        smoothPointer.x * 0.42 + axialDriftX * 0.18,
        smoothPointer.y * 0.28 + axialDriftY * 0.12,
        15 + depth
      );
      lookTarget.set(
        smoothPointer.x * 1.6 + axialDriftX,
        smoothPointer.y * 1.05 + axialDriftY,
        -23 + depth * 0.45
      );
    }
  }

  spaceCamera.position.x = damp(spaceCamera.position.x, cameraTarget.x, 2.2, delta);
  spaceCamera.position.y = damp(spaceCamera.position.y, cameraTarget.y, 2.2, delta);
  spaceCamera.position.z = damp(spaceCamera.position.z, cameraTarget.z, 2.0, delta);
  tempLook.lerp(lookTarget, 1 - Math.exp(-2.2 * delta));
  spaceCamera.lookAt(tempLook);
  spaceCamera.rotation.z += (smoothPointer.x * -0.012 - spaceCamera.rotation.z) * 0.035;

  if (!reducedMotion) {
    corridor.rotation.z = THREE.MathUtils.lerp(0, -0.142, entryAlignment)
      + Math.sin(time * 0.062) * 0.017 * entryAlignment;
    corridor.rotation.y = THREE.MathUtils.lerp(0, -0.065, entryAlignment)
      + Math.sin(time * 0.048) * 0.022 * entryAlignment;
    corridor.position.x = Math.sin(time * 0.09) * 0.11 * entryAlignment;
    corridor.position.y = THREE.MathUtils.lerp(0, -0.9, entryAlignment)
      + Math.cos(time * 0.073) * 0.09 * entryAlignment;
    if (corridor.userData.woodTexture) corridor.userData.woodTexture.offset.x = (time * 0.0018) % 1;
    if (corridor.userData.edgeMaterial) corridor.userData.edgeMaterial.opacity = 0.14 + Math.sin(time * 0.74) * 0.028;
    if (dust) {
      dust.rotation.z = Math.sin(time * 0.065) * 0.026;
      dust.position.z = (time * 0.22) % 4.2;
    }
    archiveLights.forEach((light, index) => {
      light.intensity = light.userData.baseIntensity * (1 + Math.sin(time * (0.31 + index * 0.04) + index * 1.7) * 0.045);
    });
    atmosphere?.children.forEach((sprite, index) => {
      sprite.material.opacity = sprite.userData.baseOpacity * (0.88 + Math.sin(time * 0.22 + index * 1.4) * 0.12);
      sprite.position.y += Math.sin(time * 0.09 + index) * 0.0008;
    });
  }

  if (libraryUniforms) {
    libraryUniforms.uTime.value = reducedMotion ? 0.5 : time;
    libraryUniforms.uPointer.value.copy(smoothPointer);
    libraryUniforms.uDepth.value = depth;
    // 作品内容位于磨砂层后方时，减少不可见的光线步进；正常五维空间保持完整精度。
    libraryUniforms.uMaxSteps.value = activeCategory
      ? (isSmallScreen ? 20 : 28)
      : (isSmallScreen ? 38 : 48);
  }

  portals.forEach((portal, index) => {
    portal.position.y = portal.userData.baseY + (reducedMotion ? 0 : Math.sin(time * 0.62 + index * 2.1) * 0.18);
    portal.rotation.y = Math.sin(time * 0.24 + index) * 0.06;
    const material = portal.userData.plane.material;
    material.uniforms.uTime.value = time;
    material.uniforms.uHover.value = damp(material.uniforms.uHover.value, portal.userData.hovered ? 1 : 0, 5, delta);
  });

  spaceComposer.render(delta);

  if (state === 'space') {
    updateAstronaut(time, delta);
    // 人物使用独立高清透明画布，避免五维空间的低分辨率与运动模糊抹掉脸部细节。
    if (astronautScene && astronautMaterial.uniforms.uReveal.value > 0.002) {
      astronautRenderer.render(astronautScene, spaceCamera);
    } else if (astronautRenderer) {
      astronautRenderer.clear();
    }
  }
}

function startTravelTimeline({ wormholeAlreadyPlaying = false } = {}) {
  if (state !== 'intro') return;
  if (deferredWormholeReset) {
    window.clearTimeout(deferredWormholeReset);
    deferredWormholeReset = 0;
  }
  state = 'traveling';
  spaceRenderResumeAt = Number.POSITIVE_INFINITY;
  astronautVisible = false;
  arrivalBlinkActive = false;
  nextAstronautWaveAt = 0;
  astronautWaveStartedAt = -1;
  travelProgress = 0;
  travelRaw = 0;
  document.body.classList.remove('has-arrived-character', 'is-blinking');
  window.__arrivalTimeline = [];
  setArrivalPhase('traveling-character-hidden');
  document.documentElement.dataset.travelRaw = '0';
  document.documentElement.dataset.travelProgress = '0';
  if (astronautMaterial) astronautMaterial.uniforms.uReveal.value = 0;
  travelStartedAt = performance.now();
  document.body.classList.add('is-traveling');
  document.documentElement.style.setProperty('--travel-progress', '0');
  document.documentElement.style.setProperty('--wormhole-opacity', '0');
  document.documentElement.style.setProperty('--space-entry-opacity', '0');
  document.documentElement.style.setProperty('--warp-intensity', '0');
  document.documentElement.style.setProperty('--warp-canvas-opacity', '0');
  clearWarpTransition();
  boostWormholeVideoLoading();
  [dom.wormholeVideo].filter(Boolean).forEach((video) => {
    if (!wormholeAlreadyPlaying && (!wormholePrimed || video.ended || video.currentTime > 0.25)) {
      try { video.currentTime = 0.001; } catch {}
    }
    if (!wormholeAlreadyPlaying) {
      video.play().catch((error) => {
        document.documentElement.dataset.wormholeVideoPlayError = error?.name || 'PlaybackError';
      });
    }
  });
  dom.spaceCanvas.style.clipPath = '';
  dom.enter.disabled = true;
  keepIntroVideoPlaying();
}

function beginTravel() {
  if (state !== 'intro') return;
  // 用户很快点击时，留在已经显示的高清黑洞画面中等待后台资源就绪，
  // 而不是用未解码的虫洞视频直接开始转场并造成中途卡顿。
  if (isSmallScreen && !deferredExperienceReady) {
    if (travelPreparationPending) return;
    travelPreparationPending = true;
    dom.enter.disabled = true;
    dom.enter.setAttribute('aria-busy', 'true');
    prepareDeferredMobileExperience()
      .catch(() => {})
      .finally(() => {
        travelPreparationPending = false;
        dom.enter.disabled = false;
        dom.enter.removeAttribute('aria-busy');
        if (state === 'intro' && deferredExperienceReady) beginTravel();
      });
    return;
  }

  if (!isSmallScreen) {
    startTravelTimeline();
    return;
  }

  // 手机端必须先确认虫洞视频真正进入播放状态，再开始淡出黑洞。
  // 这样即使微信浏览器拒绝播放或网络仍未就绪，也只会停留在首页，
  // 不会把用户带进一个无法恢复的黑屏转场。
  if (travelPreparationPending) return;
  travelPreparationPending = true;
  dom.enter.disabled = true;
  dom.enter.setAttribute('aria-busy', 'true');
  window.clearTimeout(mobileWormholeGestureTimer);
  mobileWormholeGestureTimer = 0;
  armMobileWormholePlayback().then((started) => {
    travelPreparationPending = false;
    dom.enter.removeAttribute('aria-busy');
    if (state !== 'intro') return;
    if (!started) {
      dom.enter.disabled = false;
      return;
    }
    requestAnimationFrame(() => startTravelTimeline({ wormholeAlreadyPlaying: true }));
  });
}

function finishTravel() {
  const now = performance.now();
  state = 'space';
  spaceRenderResumeAt = now + (reducedMotion ? 0 : 2800);
  document.documentElement.dataset.travelRaw = '1';
  document.documentElement.dataset.travelProgress = '1';
  travelRaw = 1;
  document.body.classList.remove('is-traveling');
  document.body.classList.add('is-in-space');
  document.documentElement.style.setProperty('--travel-progress', '1');
  document.documentElement.style.setProperty('--wormhole-opacity', '0');
  document.documentElement.style.setProperty('--space-entry-opacity', '1');
  document.documentElement.style.setProperty('--warp-intensity', '0');
  document.documentElement.style.setProperty('--warp-canvas-opacity', '0');
  dom.introVideo.pause();
  if (dom.wormholeVideo) {
    dom.wormholeVideo.pause();
    resetWormholeWhenIdle();
  }
  dom.blackholeCanvas.style.opacity = '';
  dom.introVideoStage.style.opacity = '';
  dom.wormholeVideoStage.style.opacity = '';
  clearWarpTransition();
  dom.spaceCanvas.style.opacity = '';
  dom.spaceCanvas.style.clipPath = '';
  dom.spaceUi.setAttribute('aria-hidden', 'false');
  setArrivalPhase('space-complete');
  // 手机完成转场后不再保留两套高分辨率视频解码器，给摄影与影像页面腾出内存。
  if (isSmallScreen) window.setTimeout(releaseCompletedTravelMedia, 420);
  // 先让五维空间稳定接管，再触发眨眼；避免在转场结束帧强制重启动画造成卡顿。
  window.setTimeout(() => requestAnimationFrame(() => {
    if (state !== 'space' || activeCategory || astronautVisible) return;
    startBlink(performance.now(), { arrival: true });
  }), reducedMotion ? 0 : 1200);
}

function updateTravel(now) {
  const duration = reducedMotion ? 1500 : 4120;
  const raw = clamp((now - travelStartedAt) / duration, 0, 1);
  const progress = easeInOutCubic(raw);
  travelRaw = raw;
  travelProgress = progress;
  document.documentElement.dataset.travelRaw = raw.toFixed(4);
  document.documentElement.dataset.travelProgress = progress.toFixed(4);
  document.documentElement.style.setProperty('--travel-progress', raw.toFixed(4));

  // 0-1 秒：沿首页黑洞视频推进；1-3 秒：高清虫洞视频接管；最后淡入五维空间。
  const wormholeFadeIn = smoothstep(0.1, 0.26, raw);
  const wormholeFadeOut = 1 - smoothstep(0.8, 0.97, raw);
  const wormholeOpacity = wormholeFadeIn * wormholeFadeOut;
  const spaceFade = smoothstep(0.78, 0.97, raw);
  const blackFade = 1 - smoothstep(0.16, 0.42, raw);
  document.documentElement.style.setProperty('--wormhole-opacity', wormholeOpacity.toFixed(4));
  document.documentElement.style.setProperty('--space-entry-opacity', spaceFade.toFixed(4));
  document.documentElement.style.setProperty('--warp-intensity', (wormholeOpacity * smoothstep(0.12, 0.72, raw)).toFixed(4));
  document.documentElement.style.setProperty('--warp-canvas-opacity', '0');
  dom.spaceCanvas.style.opacity = String(spaceFade);
  dom.blackholeCanvas.style.opacity = String(blackFade);
  dom.introVideoStage.style.opacity = String(blackFade);
  dom.wormholeVideoStage.style.opacity = String(wormholeOpacity);

  if (raw >= 1) finishTravel();
}

function openCategory(key) {
  const category = categories[key];
  const portal = portals.find((item) => item.userData.category === key);
  if (!category || !portal || state !== 'space' || !astronautVisible) return;

  activeCategory = key;
  if (astronautPanelTimer) {
    window.clearTimeout(astronautPanelTimer);
    astronautPanelTimer = 0;
  }
  document.body.classList.add('is-character-exiting');
  stopBlinking();
  dom.panelTitle.textContent = category.title;
  dom.panelDescription.textContent = category.description;
  document.body.classList.toggle('has-photo-panel', key === 'photo' || key === 'video');
  document.body.classList.toggle('has-plugin-panel', key === 'plugin');
  document.body.classList.remove('has-photo-album', 'has-video-gallery', 'has-video-player');
  document.body.classList.remove('has-plugin-detail');
  activePhotoAlbum = null;
  activePlugin = null;
  activeVideoGallery = false;
  activeVideoItem = null;

  if (key === 'photo') {
    renderPhotoFolders();
  } else if (key === 'plugin') {
    renderPluginGrid();
  } else if (key === 'video') {
    renderVideoGallery();
  } else {
    dom.closePanel.innerHTML = '<span>×</span> 返回五维空间';
    replaceWorkList(...category.works.map((work) => {
      const article = document.createElement('article');
      article.className = 'work-card';
      const year = document.createElement('span');
      year.className = 'work-year';
      year.textContent = work.year;
      const content = document.createElement('div');
      const type = document.createElement('p');
      type.className = 'work-type';
      type.textContent = work.type;
      const title = document.createElement('h3');
      title.textContent = work.title;
      const text = document.createElement('p');
      text.textContent = work.text;
      content.append(type, title, text);
      article.append(year, content);
      return article;
    }));
  }

  document.body.classList.add('has-panel');
  dom.panel.setAttribute('aria-hidden', 'false');
  const moveCameraAfterCharacterExit = () => {
    astronautPanelTimer = 0;
    if (activeCategory !== key) return;
    cameraTarget.set(portal.position.x * 0.55 - 1.8, portal.position.y * 0.5, portal.position.z + 6.8);
    lookTarget.copy(portal.position);
  };
  if (reducedMotion) moveCameraAfterCharacterExit();
  else astronautPanelTimer = window.setTimeout(moveCameraAfterCharacterExit, 140);
  window.setTimeout(() => dom.closePanel.focus({ preventScroll: true }), 700);
}

function renderPluginGrid() {
  const pluginOrder = [
    'evehut-ai-wardrobe',
    'evaluation-radar',
    'video-description',
    'vision-annotation',
    'video-preclassification',
    'video-batch-download',
    'video-timestamp',
    'blobstore-key'
  ];
  const orderIndex = new Map(pluginOrder.map((id, index) => [id, index]));
  const plugins = [...categories.plugin.works].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
  dom.closePanel.innerHTML = '<span>×</span> 返回五维空间';
  dom.workList.className = 'work-list plugin-work-list';

  const grid = document.createElement('section');
  grid.className = 'plugin-grid';
  grid.setAttribute('aria-label', '自动化工具列表');

  plugins.forEach((plugin, index) => {
    const card = document.createElement('button');
    card.className = 'plugin-card';
    card.type = 'button';
    card.style.setProperty('--plugin-index', index);
    card.style.setProperty('--plugin-accent', plugin.accent);
    card.dataset.plugin = plugin.id;
    card.setAttribute('aria-label', `查看${plugin.title}`);

    const top = document.createElement('span');
    top.className = 'plugin-card-top';
    const mark = document.createElement('b');
    mark.className = 'plugin-mark';
    mark.textContent = plugin.code;
    const meta = document.createElement('span');
    meta.innerHTML = `<small>${plugin.type}</small><em>V ${plugin.version}</em>`;
    top.append(mark, meta);

    const copy = document.createElement('span');
    copy.className = 'plugin-card-copy';
    const title = document.createElement('strong');
    title.textContent = plugin.shortTitle;
    const tagline = document.createElement('span');
    tagline.textContent = plugin.tagline;
    copy.append(title, tagline);

    const foot = document.createElement('span');
    foot.className = 'plugin-card-foot';
    foot.innerHTML = '<small>展开工作流</small><i aria-hidden="true"></i>';
    card.append(top, copy, foot);

    let tiltFrame = 0;
    card.addEventListener('pointermove', (event) => {
      if (tiltFrame) return;
      tiltFrame = requestAnimationFrame(() => {
        tiltFrame = 0;
        const rect = card.getBoundingClientRect();
        const x = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        const y = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
        card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        card.style.setProperty('--rx', `${((0.5 - y) * 2.4).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${((x - 0.5) * 3.4).toFixed(2)}deg`);
      });
    });
    card.addEventListener('pointerleave', () => {
      if (tiltFrame) {
        cancelAnimationFrame(tiltFrame);
        tiltFrame = 0;
      }
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });

    card.addEventListener('click', () => openPluginDetail(plugin.id));
    grid.append(card);
  });

  replaceWorkList(grid);
}

function openPluginDetail(pluginId) {
  const plugin = categories.plugin.works.find((item) => item.id === pluginId);
  if (!plugin || activeCategory !== 'plugin') return;
  activePlugin = pluginId;
  document.body.classList.add('has-plugin-detail');
  dom.closePanel.innerHTML = '<span>‹</span> 返回自动化';
  dom.panelTitle.textContent = plugin.shortTitle;
  dom.panelDescription.textContent = plugin.tagline;
  dom.workList.className = 'work-list plugin-detail-view';

  const detail = document.createElement('article');
  detail.className = 'plugin-detail';
  detail.style.setProperty('--plugin-accent', plugin.accent);

  const identity = document.createElement('header');
  identity.className = 'plugin-detail-identity';
  identity.innerHTML = `
    <span class="plugin-detail-orbit" aria-hidden="true"><i>${plugin.code}</i></span>
    <p>${plugin.type} · V ${plugin.version}</p>
    <h3>${plugin.title}</h3>
    <strong>${plugin.tagline}</strong>
  `;
  if (plugin.website) {
    const liveLink = document.createElement('a');
    liveLink.className = 'plugin-live-link';
    liveLink.href = plugin.website;
    liveLink.target = '_blank';
    liveLink.rel = 'noopener noreferrer';
    liveLink.innerHTML = '<span>访问线上产品</span><i aria-hidden="true">↗</i>';
    identity.append(liveLink);
  }

  const content = document.createElement('div');
  content.className = 'plugin-detail-content';

  const visual = document.createElement('figure');
  visual.className = 'plugin-detail-visual';
  if (plugin.preview) {
    const image = document.createElement('img');
    image.src = plugin.preview;
    image.alt = `${plugin.title}界面截图`;
    image.loading = 'eager';
    image.decoding = 'async';
    visual.append(image);
  }
  const caption = document.createElement('figcaption');
  caption.textContent = '界面截图 / Chrome 扩展与本地工作台';
  visual.append(caption);

  const introduction = document.createElement('section');
  introduction.innerHTML = `<small>01 / PRODUCT</small><h4>它是什么</h4><p>${plugin.what}</p>`;

  const problem = document.createElement('section');
  problem.innerHTML = `<small>02 / PROBLEM</small><h4>解决什么问题</h4><p>${plugin.problem}</p><blockquote>${plugin.result}</blockquote>`;

  const featureSection = document.createElement('section');
  const featureLabel = document.createElement('small');
  featureLabel.textContent = '03 / MODULES';
  const featureTitle = document.createElement('h4');
  featureTitle.textContent = '核心能力';
  const featureList = document.createElement('div');
  featureList.className = 'plugin-feature-list';
  (plugin.features || []).forEach((feature) => {
    const item = document.createElement('span');
    item.textContent = feature;
    featureList.append(item);
  });
  featureSection.append(featureLabel, featureTitle, featureList);

  const usage = document.createElement('section');
  const usageLabel = document.createElement('small');
  usageLabel.textContent = '04 / WORKFLOW';
  const usageTitle = document.createElement('h4');
  usageTitle.textContent = '如何使用';
  const steps = document.createElement('ol');
  plugin.steps.forEach((step, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>${step}</p>`;
    steps.append(item);
  });
  usage.append(usageLabel, usageTitle, steps);

  content.append(visual, introduction, problem, featureSection, usage);

  if (plugin.knowledgeBase) {
    const knowledgeSection = document.createElement('section');
    knowledgeSection.className = 'plugin-knowledge-section';
    const knowledgeLabel = document.createElement('small');
    knowledgeLabel.textContent = '05 / KNOWLEDGE';
    const knowledgeTitle = document.createElement('h4');
    knowledgeTitle.textContent = 'Obsidian 本地知识库';
    const knowledgeContent = document.createElement('div');
    knowledgeContent.className = 'plugin-knowledge-content';
    const knowledgeSummary = document.createElement('p');
    knowledgeSummary.textContent = plugin.knowledgeBase.summary;
    const knowledgeFacts = document.createElement('ul');
    plugin.knowledgeBase.facts.forEach((fact) => {
      const item = document.createElement('li');
      item.textContent = fact;
      knowledgeFacts.append(item);
    });
    knowledgeContent.append(knowledgeSummary, knowledgeFacts);
    knowledgeSection.append(knowledgeLabel, knowledgeTitle, knowledgeContent);
    content.append(knowledgeSection);
  }

  if (plugin.videos?.length) {
    const videoSection = document.createElement('section');
    videoSection.className = 'plugin-video-section';
    const videoLabel = document.createElement('small');
    videoLabel.textContent = plugin.knowledgeBase ? '06 / DEMO' : '05 / DEMO';
    const videoTitle = document.createElement('h4');
    videoTitle.textContent = '演示视频';
    const videoGrid = document.createElement('div');
    videoGrid.className = 'plugin-video-grid';
    plugin.videos.forEach((item) => {
      const frame = document.createElement('article');
      frame.className = 'plugin-video-card';
      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'none';
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('controlsList', 'nodownload');
      video.dataset.videoPath = item.path;
      video.setAttribute('aria-label', item.label);
      const loader = document.createElement('button');
      loader.className = 'plugin-video-load';
      loader.type = 'button';
      loader.innerHTML = '<span>加载演示</span><small>按需加载视频</small>';
      loader.addEventListener('click', async () => {
        if (frame.classList.contains('is-loading')) return;
        frame.classList.add('is-loading');
        loader.disabled = true;
        loader.innerHTML = '<span>加载中…</span><small>正在读取演示视频</small>';
        try {
          const url = await resolveAutomationVideo(item.path);
          video.src = url;
          video.load();
          frame.classList.add('is-ready');
          await video.play().catch(() => {});
        } catch (error) {
          frame.classList.add('has-error');
          loader.innerHTML = '<span>加载失败</span><small>请稍后重试</small>';
          loader.disabled = false;
          console.error('演示视频加载失败：', error);
        } finally {
          frame.classList.remove('is-loading');
        }
      });
      const label = document.createElement('p');
      label.textContent = item.label;
      frame.append(video, loader, label);
      videoGrid.append(frame);
    });
    videoSection.append(videoLabel, videoTitle, videoGrid);
    content.append(videoSection);
  }

  detail.append(identity, content);
  replaceWorkList(detail);
  dom.panel.scrollTo({ top: 0, behavior: 'auto' });
}

function closePluginDetail() {
  if (!activePlugin) return false;
  activePlugin = null;
  document.body.classList.remove('has-plugin-detail');
  dom.panelTitle.textContent = categories.plugin.title;
  dom.panelDescription.textContent = categories.plugin.description;
  renderPluginGrid();
  return true;
}

function renderPhotoFolders() {
  dom.closePanel.innerHTML = '<span>×</span> 返回五维空间';
  const grid = document.createElement('section');
  grid.className = 'photo-folder-grid';
  grid.setAttribute('aria-label', '摄影作品相册');

  photoAlbums.forEach((album, albumIndex) => {
    const button = document.createElement('button');
    button.className = 'photo-folder';
    button.type = 'button';
    button.style.setProperty('--album-index', albumIndex);
    button.setAttribute('aria-label', `打开${album.title}`);

    const stack = document.createElement('span');
    stack.className = 'photo-folder-stack';
    album.covers.forEach((coverIndex, coverOrder) => {
      const image = document.createElement('img');
      image.alt = '';
      configureManagedImage(image, album.items[coverIndex - 1].src, {
        immediate: !isSmallScreen || coverOrder === 0
      });
      image.style.setProperty('--cover-order', coverOrder);
      stack.append(image);
    });

    const copy = document.createElement('span');
    copy.className = 'photo-folder-copy';
    const eyebrow = document.createElement('small');
    eyebrow.textContent = album.eyebrow;
    const title = document.createElement('strong');
    title.textContent = album.title;
    const description = document.createElement('span');
    description.textContent = album.description;
    copy.append(eyebrow, title, description);

    const arrow = document.createElement('i');
    arrow.setAttribute('aria-hidden', 'true');
    button.append(stack, copy, arrow);
    button.addEventListener('click', () => openPhotoAlbum(album.id));
    grid.append(button);
  });

  dom.workList.className = 'work-list photo-folders';
  replaceWorkList(grid);
  observeManagedImages(grid, grid, '65% 0px');
  settleMobileMediaPreparation(grid);
}

function openPhotoAlbum(albumId) {
  const album = photoAlbums.find((item) => item.id === albumId);
  if (!album || activeCategory !== 'photo') return;
  activePhotoAlbum = albumId;
  document.body.classList.add('has-photo-album');
  dom.closePanel.innerHTML = '<span>‹</span> 返回摄影作品';
  dom.panelTitle.textContent = album.title;
  dom.panelDescription.textContent = album.description;

  const gallery = document.createElement('section');
  gallery.className = 'fold-gallery';
  gallery.setAttribute('aria-label', `${album.title}图片浏览`);

  const status = document.createElement('div');
  status.className = 'gallery-status';
  status.innerHTML = `<span>SCROLL TO EXPLORE</span><b><em>01</em> / ${String(album.items.length).padStart(2, '0')}</b>`;

  const track = document.createElement('div');
  track.className = 'fold-gallery-track';
  const overview = document.createElement('aside');
  overview.className = 'gallery-overview';
  overview.setAttribute('aria-label', '全部照片预览');
  const overviewThumbs = [];
  album.items.forEach((item, index) => {
    const frame = document.createElement('button');
    frame.className = 'fold-photo';
    frame.type = 'button';
    frame.dataset.index = String(index);
    frame.setAttribute('aria-label', `查看第 ${index + 1} 张作品`);
    const image = document.createElement('img');
    image.alt = '';
    image.className = 'photo-image';
    configureManagedImage(image, item.src, { immediate: !isSmallScreen || index === 0 });
    if (!isSmallScreen) {
      const backdrop = image.cloneNode();
      backdrop.className = 'photo-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      frame.append(backdrop);
    }
    frame.append(image);
    frame.addEventListener('click', () => frame.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' }));
    track.append(frame);

    const thumbnail = document.createElement('button');
    thumbnail.className = 'gallery-overview-thumb';
    thumbnail.type = 'button';
    thumbnail.dataset.index = String(index);
    thumbnail.setAttribute('aria-label', `跳转到第 ${index + 1} 张照片`);
    const thumbnailImage = document.createElement('img');
    thumbnailImage.alt = '';
    configureManagedImage(thumbnailImage, isSmallScreen ? item.thumbnail : item.src, {
      immediate: !isSmallScreen || index < 3
    });
    thumbnail.append(thumbnailImage);
    thumbnail.addEventListener('click', () => {
      frame.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
    overviewThumbs.push(thumbnail);
    overview.append(thumbnail);
  });

  const rail = document.createElement('span');
  rail.className = 'gallery-rail';
  rail.setAttribute('aria-hidden', 'true');
  gallery.append(status, rail, track, overview);
  dom.workList.className = 'work-list photo-gallery-view';
  replaceWorkList(gallery);
  observeManagedImages(track, track, '75% 0px');
  observeManagedImages(overview, overview, '0px 80%');
  settleMobileMediaPreparation(gallery);

  const update = () => {
    galleryScrollFrame = 0;
    const frames = [...track.querySelectorAll('.fold-photo')];
    const viewportCenter = track.getBoundingClientRect().top + track.clientHeight * 0.5;
    let nearest = null;
    let nearestDistance = Infinity;
    frames.forEach((frame) => {
      const rect = frame.getBoundingClientRect();
      const distance = (rect.top + rect.height * 0.5 - viewportCenter) / Math.max(track.clientHeight * 0.46, 1);
      const clamped = clamp(distance, -1.45, 1.45);
      frame.style.setProperty('--distance', clamped.toFixed(4));
      const absoluteDistance = Math.abs(distance);
      const proximity = 1 - clamp(absoluteDistance, 0, 1);
      frame.style.setProperty('--proximity', proximity.toFixed(4));
      frame.style.setProperty('--depth', ((proximity - 1) * 120).toFixed(2));
      if (absoluteDistance < nearestDistance) {
        nearestDistance = absoluteDistance;
        nearest = frame;
      }
    });
    frames.forEach((frame) => frame.classList.toggle('is-active', frame === nearest));
    if (nearest) {
      const activeIndex = Number(nearest.dataset.index);
      status.querySelector('em').textContent = String(activeIndex + 1).padStart(2, '0');
      overviewThumbs.forEach((thumbnail, index) => thumbnail.classList.toggle('is-active', index === activeIndex));
      overviewThumbs[activeIndex]?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  };
  track.addEventListener('scroll', () => {
    if (!galleryScrollFrame) galleryScrollFrame = requestAnimationFrame(update);
  }, { passive: true });
  requestAnimationFrame(() => {
    track.querySelector('.fold-photo')?.scrollIntoView({ block: 'center' });
    update();
  });
}

function closePhotoAlbum() {
  if (!activePhotoAlbum) return false;
  activePhotoAlbum = null;
  document.body.classList.remove('has-photo-album');
  dom.panelTitle.textContent = categories.photo.title;
  dom.panelDescription.textContent = categories.photo.description;
  dom.closePanel.innerHTML = '<span>×</span> 返回五维空间';
  renderPhotoFolders();
  return true;
}

function renderVideoGallery() {
  activeVideoGallery = true;
  document.body.classList.add('has-photo-album', 'has-video-gallery');
  dom.closePanel.innerHTML = '<span>×</span> 返回五维空间';

  const gallery = document.createElement('section');
  gallery.className = 'fold-gallery video-fold-gallery';
  gallery.setAttribute('aria-label', '影像作品浏览');

  const status = document.createElement('div');
  status.className = 'gallery-status video-gallery-status';
  status.innerHTML = `<span>SCROLL TO WATCH</span><b><em>01</em> / ${String(videoItems.length).padStart(2, '0')}</b>`;

  const track = document.createElement('div');
  track.className = 'fold-gallery-track video-gallery-track';
  const overview = document.createElement('aside');
  overview.className = 'gallery-overview video-gallery-overview';
  overview.setAttribute('aria-label', '全部影像预览');
  const overviewThumbs = [];

  videoItems.forEach((item, index) => {
    const frame = document.createElement('button');
    frame.className = 'fold-photo video-slide';
    frame.type = 'button';
    frame.dataset.index = String(index);
    frame.setAttribute('aria-label', `放大播放第 ${index + 1} 段影像`);

    const poster = document.createElement('img');
    poster.alt = '';
    poster.className = 'photo-image';
    configureManagedImage(poster, item.poster, { immediate: !isSmallScreen || index === 0 });
    const play = document.createElement('span');
    play.className = 'video-slide-play';
    play.setAttribute('aria-hidden', 'true');
    if (!isSmallScreen) {
      const backdrop = poster.cloneNode();
      backdrop.className = 'photo-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      frame.append(backdrop);
    }
    frame.append(poster, play);
    frame.addEventListener('click', () => openVideoPlayer(item, index));
    track.append(frame);

    const thumbnail = document.createElement('button');
    thumbnail.className = 'gallery-overview-thumb video-overview-thumb';
    thumbnail.type = 'button';
    thumbnail.dataset.index = String(index);
    thumbnail.setAttribute('aria-label', `跳转到第 ${index + 1} 段影像`);
    const thumbnailImage = document.createElement('img');
    thumbnailImage.alt = '';
    configureManagedImage(thumbnailImage, isSmallScreen ? item.thumbnail : item.poster, {
      immediate: !isSmallScreen || index < 2
    });
    thumbnail.append(thumbnailImage);
    thumbnail.addEventListener('click', () => {
      frame.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
    overviewThumbs.push(thumbnail);
    overview.append(thumbnail);
  });

  const rail = document.createElement('span');
  rail.className = 'gallery-rail';
  rail.setAttribute('aria-hidden', 'true');
  gallery.append(status, rail, track, overview);
  dom.workList.className = 'work-list photo-gallery-view video-gallery-view';
  replaceWorkList(gallery);
  observeManagedImages(track, track, '75% 0px');
  observeManagedImages(overview, overview, '0px 80%');
  settleMobileMediaPreparation(gallery);

  const update = () => {
    galleryScrollFrame = 0;
    const frames = [...track.querySelectorAll('.video-slide')];
    const viewportCenter = track.getBoundingClientRect().top + track.clientHeight * 0.5;
    let nearest = null;
    let nearestDistance = Infinity;
    frames.forEach((frame) => {
      const rect = frame.getBoundingClientRect();
      const distance = (rect.top + rect.height * 0.5 - viewportCenter) / Math.max(track.clientHeight * 0.46, 1);
      const clamped = clamp(distance, -1.45, 1.45);
      frame.style.setProperty('--distance', clamped.toFixed(4));
      const absoluteDistance = Math.abs(distance);
      const proximity = 1 - clamp(absoluteDistance, 0, 1);
      frame.style.setProperty('--proximity', proximity.toFixed(4));
      frame.style.setProperty('--depth', ((proximity - 1) * 120).toFixed(2));
      if (absoluteDistance < nearestDistance) {
        nearestDistance = absoluteDistance;
        nearest = frame;
      }
    });
    frames.forEach((frame) => frame.classList.toggle('is-active', frame === nearest));
    if (nearest) {
      const activeIndex = Number(nearest.dataset.index);
      status.querySelector('em').textContent = String(activeIndex + 1).padStart(2, '0');
      overviewThumbs.forEach((thumbnail, index) => thumbnail.classList.toggle('is-active', index === activeIndex));
    }
  };
  track.addEventListener('scroll', () => {
    if (!galleryScrollFrame) galleryScrollFrame = requestAnimationFrame(update);
  }, { passive: true });
  requestAnimationFrame(() => {
    track.querySelector('.video-slide')?.scrollIntoView({ block: 'center' });
    update();
  });
}

function openVideoPlayer(item, index) {
  if (!activeVideoGallery || videoLightbox) return;
  activeVideoItem = index;
  document.body.classList.add('has-video-player');

  videoLightbox = document.createElement('div');
  videoLightbox.className = 'video-lightbox';
  videoLightbox.setAttribute('role', 'dialog');
  videoLightbox.setAttribute('aria-modal', 'true');
  videoLightbox.setAttribute('aria-label', `第 ${index + 1} 段影像播放`);

  const shell = document.createElement('div');
  shell.className = 'video-player-shell';
  const video = document.createElement('video');
  if (isSmallScreen) video.dataset.src = item.src;
  else video.src = item.src;
  video.poster = item.poster;
  video.controls = false;
  video.autoplay = false;
  video.playsInline = true;
  video.preload = isSmallScreen ? 'none' : 'metadata';
  video.disablePictureInPicture = true;
  video.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen');
  video.setAttribute('disableremoteplayback', '');
  video.addEventListener('contextmenu', (event) => event.preventDefault());

  const start = document.createElement('button');
  start.className = 'video-player-start';
  start.type = 'button';
  start.setAttribute('aria-label', '开始播放');
  start.innerHTML = '<span aria-hidden="true"></span>';
  const toggle = document.createElement('button');
  toggle.className = 'video-player-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '开始播放');
  const controls = document.createElement('div');
  controls.className = 'video-player-controls';
  const progress = document.createElement('input');
  progress.className = 'video-player-progress';
  progress.type = 'range';
  progress.min = '0';
  progress.max = '1000';
  progress.step = '1';
  progress.value = '0';
  progress.disabled = true;
  progress.setAttribute('aria-label', '播放进度');

  const syncPlaybackState = () => {
    const isPlaying = !video.paused && !video.ended;
    shell.classList.toggle('is-playing', isPlaying);
    toggle.textContent = isPlaying ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', isPlaying ? '暂停播放' : '开始播放');
  };
  const syncProgress = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const ratio = clamp(video.currentTime / video.duration, 0, 1);
    const value = Math.round(ratio * 1000);
    progress.disabled = false;
    progress.value = String(value);
    progress.style.setProperty('--video-progress', `${(ratio * 100).toFixed(3)}%`);
    progress.setAttribute('aria-valuetext', `${Math.floor(video.currentTime)} 秒 / ${Math.floor(video.duration)} 秒`);
  };
  const togglePlayback = () => {
    if (!video.paused && !video.ended) {
      video.pause();
      return;
    }
    if (!video.getAttribute('src') && video.dataset.src) {
      video.src = video.dataset.src;
      video.removeAttribute('data-src');
      video.load();
      shell.classList.add('is-buffering');
    }
    // 仅在用户主动点击播放时开启原声；自动播放失败时仍可保持静音继续播放。
    video.muted = navigator.userActivation?.isActive !== true;
    video.play().catch((error) => {
      shell.dataset.playError = error?.name || 'PlaybackError';
    });
  };
  start.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePlayback();
  });
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePlayback();
  });
  progress.addEventListener('input', () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = (Number(progress.value) / 1000) * video.duration;
    syncProgress();
  });
  video.addEventListener('click', togglePlayback);
  video.addEventListener('playing', syncPlaybackState);
  video.addEventListener('playing', () => shell.classList.remove('is-buffering'));
  video.addEventListener('canplay', () => shell.classList.remove('is-buffering'));
  video.addEventListener('pause', syncPlaybackState);
  video.addEventListener('ended', syncPlaybackState);
  video.addEventListener('loadedmetadata', syncProgress);
  video.addEventListener('durationchange', syncProgress);
  video.addEventListener('timeupdate', syncProgress);
  syncPlaybackState();
  const close = document.createElement('button');
  close.className = 'video-player-close';
  close.type = 'button';
  close.setAttribute('aria-label', '关闭视频播放');
  close.innerHTML = '<span>×</span>';
  close.addEventListener('click', closeVideoPlayer);
  videoLightbox.addEventListener('click', (event) => {
    if (event.target === videoLightbox) closeVideoPlayer();
  });
  controls.append(toggle, progress);
  shell.append(video, start, controls);
  videoLightbox.append(close, shell);
  dom.panel.append(videoLightbox);
  close.focus({ preventScroll: true });
}

function closeVideoPlayer() {
  if (!videoLightbox) return false;
  const video = videoLightbox.querySelector('video');
  video?.pause();
  video?.removeAttribute('src');
  video?.load();
  videoLightbox.remove();
  videoLightbox = null;
  activeVideoItem = null;
  document.body.classList.remove('has-video-player');
  return true;
}

function closeCategory() {
  if (closeVideoPlayer()) return;
  if (closePhotoAlbum()) return;
  if (closePluginDetail()) return;
  if (!activeCategory) return;
  if (astronautPanelTimer) {
    window.clearTimeout(astronautPanelTimer);
    astronautPanelTimer = 0;
  }
  activeCategory = null;
  activeVideoGallery = false;
  cameraTarget.set(0, 0, 15 + scrollDepth);
  lookTarget.set(0, 0, -18);
  document.body.classList.remove('has-panel');
  document.body.classList.remove('has-photo-panel', 'has-photo-album', 'has-video-gallery', 'has-video-player', 'has-plugin-panel', 'has-plugin-detail');
  document.body.classList.remove('is-mobile-media-preparing');
  window.clearTimeout(mobileMediaPreparationTimer);
  mobileMediaPreparationTimer = 0;
  disposePanelMedia();
  dom.workList.className = 'work-list';
  dom.workList.replaceChildren();
  dom.panel.setAttribute('aria-hidden', 'true');
  const restoreCharacter = () => {
    astronautPanelTimer = 0;
    if (state !== 'space' || activeCategory) return;
    document.body.classList.remove('is-character-exiting');
  };
  if (reducedMotion) restoreCharacter();
  else astronautPanelTimer = window.setTimeout(restoreCharacter, 560);
  scheduleBlink();
}

function updatePortalHover(event) {
  if (state !== 'space' || activeCategory) return;
  raycaster.setFromCamera(pointer, spaceCamera);
  const hits = raycaster.intersectObjects(portals.map((portal) => portal.userData.plane), false);
  const hovered = hits[0]?.object?.userData?.category;
  portals.forEach((portal) => { portal.userData.hovered = portal.userData.category === hovered; });
  dom.spaceCanvas.style.cursor = hovered ? 'pointer' : 'default';
  if (event?.type === 'click' && hovered) openCategory(hovered);
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  updatePortalHover(event);
}

function onWheel(event) {
  if (state !== 'space' || activeCategory) return;
  scrollDepth = clamp(scrollDepth + event.deltaY * 0.004, -5.5, 4.5);
  if (!reducedMotion) blurImpulse = clamp(blurImpulse + event.deltaY * 0.0018, -1, 1);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const spaceDpr = Math.min(window.devicePixelRatio, spaceDprCap);
  spaceRenderer?.setPixelRatio(spaceDpr);
  spaceRenderer?.setSize(width, height, false);
  astronautRenderer?.setPixelRatio(Math.min(window.devicePixelRatio, width < 720 ? 1 : 1.4));
  astronautRenderer?.setSize(width, height, false);
  libraryUniforms?.uResolution.value.set(width * spaceDpr, height * spaceDpr);
  if (libraryUniforms?.uMaxSteps) libraryUniforms.uMaxSteps.value = width < 720 ? 38 : 48;
  cinematicBlurPass?.uniforms.uTexelSize.value.set(1 / (width * spaceDpr), 1 / (height * spaceDpr));
  blurBaseStrength = 0;
  spaceComposer?.setPixelRatio(spaceDpr);
  spaceComposer?.setSize(width, height);
  if (spaceCamera) {
    spaceCamera.aspect = width / height;
    spaceCamera.updateProjectionMatrix();
  }
  positionAstronautForViewport();
}

function animate(now) {
  recordFrameRate(now);
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  smoothPointer.lerp(pointer, 0.04);

  if (state === 'traveling') updateTravel(now);
  else if (state === 'intro') clearWarpTransition();
  updateBlink(now);
  const mobileMediaPanelOpen = isSmallScreen && (activeCategory === 'photo' || activeCategory === 'video');
  const shouldRenderSpace = state === 'space' && now >= spaceRenderResumeAt && !mobileMediaPanelOpen;
  if (spaceRenderer && shouldRenderSpace) {
    // 全屏磨砂作品面板打开时，以稳定的电影帧率继续呈现动态背景，
    // 避免 WebGL、图片解码和 backdrop-filter 同时争抢每一个刷新帧。
    const panelFrameInterval = activeCategory
      ? 1000 / (videoLightbox ? (isSmallScreen ? 12 : 16) : (isSmallScreen ? 20 : 24))
      : 0;
    if (!panelFrameInterval || now - lastSpaceRenderAt >= panelFrameInterval) {
      updateSpace(time, delta);
      lastSpaceRenderAt = now;
    }
  }
  requestAnimationFrame(animate);
}

function bindEvents() {
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', () => {
    if (state === 'intro' && isSmallScreen) armMobileWormholePlayback();
    else wakeIntroVideo();
    if (state === 'intro') boostWormholeVideoLoading();
  }, { passive: true });
  window.addEventListener('pointerdown', () => {
    if (state === 'intro' && isSmallScreen) armMobileWormholePlayback();
    else wakeIntroVideo();
    if (state === 'intro') boostWormholeVideoLoading();
  }, { passive: true });
  dom.intro.addEventListener('click', beginTravel);
  dom.spaceCanvas.addEventListener('click', updatePortalHover);
  dom.closePanel.addEventListener('click', closeCategory);
  document.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => openCategory(button.dataset.category));
    button.addEventListener('pointermove', (event) => {
      const rect = button.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      const y = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
      button.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      button.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
    button.addEventListener('pointerenter', () => {
      const portal = portals.find((item) => item.userData.category === button.dataset.category);
      if (portal) portal.userData.hovered = true;
    });
    button.addEventListener('pointerleave', () => {
      button.style.removeProperty('--mx');
      button.style.removeProperty('--my');
      const portal = portals.find((item) => item.userData.category === button.dataset.category);
      if (portal) portal.userData.hovered = false;
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCategory();
    if (activePhotoAlbum && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const frames = [...document.querySelectorAll('.fold-photo')];
      const current = frames.findIndex((frame) => frame.classList.contains('is-active'));
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      frames[clamp(current + direction, 0, frames.length - 1)]?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
    if (activeVideoGallery && !videoLightbox && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const frames = [...document.querySelectorAll('.video-slide')];
      const current = frames.findIndex((frame) => frame.classList.contains('is-active'));
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      frames[clamp(current + direction, 0, frames.length - 1)]?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
    if ((event.key === 'Enter' || event.key === ' ') && state === 'intro') beginTravel();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !arrivalBlinkActive) stopBlinking();
    else {
      scheduleBlink();
      wakeIntroVideo();
    }
  });
}

async function init() {
  try {
    setLoadingProgress(6);
    setupIntroVideo();
    setLoadingProgress(12);

    if (isSmallScreen) {
      const mobileBootStartedAt = performance.now();
      // 手机端先把黑洞视频准备到可稳定播放。相比只等一帧会稍慢一点，
      // 但加载层消失后不会再被视频首次解码打断。
      await Promise.all([
        preloadImage(introBlackholePosterUrl, 3600),
        waitForVideoBuffer(dom.introVideo, {
          minimumSeconds: 0.9,
          timeout: 3600,
          progressStart: 12,
          progressEnd: 38
        })
      ]);
      setLoadingProgress(42);
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // 3D 场景的创建与 GPU 编译是之前黑洞首页“卡住”的根因。
      // 现在让它在加载层后方完成，页面出现后不再执行整段同步重任务。
      await initSpace();
      updateSpace(clock.elapsedTime, 0.016);
      setLoadingProgress(72);
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // 虫洞只等待足以覆盖转场前半段的连续缓冲，剩余内容继续由浏览器缓存；
      // 避免恢复到原先必须等待整段视频的漫长加载。
      setupWormholeVideo();
      await waitForVideoBuffer(dom.wormholeVideo, {
        minimumSeconds: 2.2,
        timeout: 6200,
        progressStart: 72,
        progressEnd: 94
      });
      deferredExperienceReady = true;
      deferredExperiencePromise = Promise.resolve();
      document.documentElement.dataset.mobileExperienceReady = 'true';

      bindEvents();
      onResize();
      state = 'intro';
      const minimumLoaderDuration = 1800;
      const remainingLoaderTime = Math.max(0, minimumLoaderDuration - (performance.now() - mobileBootStartedAt));
      if (remainingLoaderTime > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingLoaderTime));
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      setLoadingProgress(100);
      dom.loading.classList.add('is-hidden');
      document.documentElement.dataset.mobileBootDuration = String(Math.round(performance.now() - mobileBootStartedAt));
      requestAnimationFrame(animate);
      return;
    }

    setupWormholeVideo();

    // 首屏先准备高清底图和足够的黑洞视频缓冲，避免加载页消失后仍然黑屏或突然变糊。
    await Promise.all([
      preloadImage(introBlackholePosterUrl),
      waitForVideoBuffer(dom.introVideo, {
        minimumSeconds: 3.9,
        timeout: isSmallScreen ? 12000 : 10000,
        progressStart: 12,
        progressEnd: 42
      })
    ]);
    setLoadingProgress(44);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // 五维空间、人物贴图和材质全部在加载页后方完成创建与 GPU 编译。
    await initSpace();
    updateSpace(clock.elapsedTime, 0.016);
    setLoadingProgress(78);

    // 虫洞必须在用户点击前拥有连续缓冲；手机端也不再只加载 metadata。
    boostWormholeVideoLoading();
    await waitForVideoBuffer(dom.wormholeVideo, {
      minimumSeconds: 3.7,
      timeout: isSmallScreen ? 12000 : 9000,
      progressStart: 78,
      progressEnd: 95
    });
    setLoadingProgress(96);

    bindEvents();
    onResize();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    setLoadingProgress(100);
    state = 'intro';
    dom.loading.classList.add('is-hidden');
    requestAnimationFrame(animate);
  } catch (error) {
    console.error('WebGL 初始化失败：', error);
    dom.loading.hidden = true;
    dom.blackholeCanvas.hidden = true;
    dom.spaceCanvas.hidden = true;
    dom.intro.hidden = true;
    dom.fallback.hidden = false;
  }
}

init();
