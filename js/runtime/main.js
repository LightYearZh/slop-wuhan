import {yieldLoadingStage} from './startup-yield.js';
import {teleportMenuDestinations} from './destination-order.js';
import {buildTunnels} from './tunnels.js';
import {GEO} from './wuhan-geodata.js';
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, positionView, metalness, roughness, vec2, smoothstep } from 'three/tsl';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { createPostProcessing } from './post-processing.js';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';
import { TUNNELS, getLocationLabel, isTypingInField, TELEPORT_LOCATIONS } from './city-config.js';
import { buildGround } from './ground.js';
import { buildCityBlocks } from './buildings.js';
import { buildRoadPaint } from './road-paint.js';
import { buildElevated } from './elevated.js';
import { buildStreetProps } from './street-props.js';
import { buildLandmarks } from './landmarks.js';
import { createTrafficSystem } from './traffic.js';
import { ThirdPersonControllerManager } from './controllers.js';
import {createTaxiService} from './taxi-fare.js';
import { TouchControls } from './touch-controls.js';
import { GamepadControls } from './gamepad-controls.js';
import { CameraSystem, CAMERA_PRESETS } from './cameras.js';
import {TRAVEL_MODES,travelMode,travelAltitude} from './travel-state.js';
import { LightingSystem } from './lighting.js';
import { WuhanMapSystem } from './wuhan-map.js';
import { setupSceneCulling, updateSceneCulling } from './scene-culling.js';
import { CityAudioSystem } from './audio-system.js';
import { GarbageTruckMusic } from './garbage-truck.js';

// js/main.js
// Main entry point for Wuhan (武汉) in Three.js WebGPURenderer & TSL (three.js r186, see index.html)

async function initApp() {
  const container = document.getElementById('canvas-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStatus = document.getElementById('loading-status');
  const loadingTrack = loadingOverlay ? loadingOverlay.querySelector('.loader-track') : null;
  const loadingFill = document.getElementById('loading-progress');
  // The loading bar sweeps while the city is being built (the main thread is busy) and fills as the shaders compile
  const setLoadingProgress = (p) => {
    if (!loadingFill) return;
    if (loadingTrack) loadingTrack.classList.remove('is-indeterminate');
    loadingFill.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
  };
  const setStatus = async (text) => {
    if (loadingStatus) loadingStatus.textContent = text;
    if (loadingTrack) loadingTrack.classList.add('is-indeterminate');
    await yieldLoadingStage();
  };

  await setStatus(`正在初始化 Three.js r${THREE.REVISION} WebGPURenderer 与 TSL 着色器…`);

  // 1. Initialize Three.js WebGPURenderer with 32-bit float reversedDepthBuffer
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    powerPreference: 'high-performance',
    reversedDepthBuffer: true
  });
  renderer.setPixelRatio(1.0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.lighting = new ClusteredLighting(256, 32, 28, 48);
  container.appendChild(renderer.domElement);

  // Start-up phase timings (logged once as "[init] ...") to keep load-time regressions traceable
  let initTimings = [];
  let initMark = performance.now();
  const markInit = (label) => {
    const now = performance.now();
    initTimings.push(`${label} ${Math.round(now - initMark)}ms`);
    initMark = now;
  };

  await renderer.init();
  markInit('renderer');

  // 2. Scene, physical sky, PMREM image-based lighting & the sun's cascaded shadows
  const scene = new THREE.Scene();
  const lightingSystem = new LightingSystem(scene, renderer);
  markInit('lighting');

  // 3. Wuhan: ground & streets, buildings, viaducts, street furniture, landmarks, traffic
  // ?skip=landmarks,props,traffic,elevated,paint leaves parts of the city out (debugging, profiling)
  const skip = new Set((new URLSearchParams(location.search).get('skip') || '').split(','));
  await setStatus('正在铺设街道、河川与山坡…');
  buildGround(scene);
  markInit('ground');
  await setStatus('正在生成两江三镇建筑与屋顶细节…');
  const cityBlocks = buildCityBlocks(scene);
  markInit('buildings');
  await setStatus('正在准备武汉道路系统…');
  const elevated = skip.has('elevated') ? { colliders: [], update() {} } : buildElevated(scene);
  buildTunnels(scene,TUNNELS);
  markInit('elevated');
  if (!skip.has('paint')) buildRoadPaint(scene);
  markInit('roadPaint');
  await setStatus('正在构建江汉关、黄鹤楼与龟山电视塔…');
  const { colliders: landmarkColliders, system: wuhanLandmarkSystem } = skip.has('landmarks') ? { colliders: [] } : buildLandmarks(scene);
  markInit('landmarks');
  await setStatus('正在种行道树、挂招牌、装红绿灯…');
  const streetProps = skip.has('props') ? { colliders: [], audioSignals: [], update() {} } : buildStreetProps(scene, skip);
  markInit('streetProps');
  const allColliders = [...landmarkColliders, ...cityBlocks.colliders, ...elevated.colliders, ...(streetProps.colliders || [])];

  await setStatus('正在生成出租车、两轮车与公交车…');
  const trafficSystem = skip.has('traffic') ? { cars: [], buses: [], scooters: [], peds: [], vehicles: [], update() {} } : createTrafficSystem(scene, streetProps);
  markInit('traffic');

  // 4. Third-person controllers (person, taxi, scooter, helicopter) & the camera system
  const controllerManager = new ThirdPersonControllerManager(scene, allColliders);
  controllerManager.trafficVehicles = trafficSystem.vehicles;
  const taxiService=createTaxiService(scene,{controllers:controllerManager,getMap:()=>mapSystem,goToStand:spot=>{selectMode('car');teleportTo(spot.x,spot.z,spot.heading,spot.y);}});
  // Reuse teleport placement so saved players return at rest, close to their last positions.
  try {
    const saved = JSON.parse(localStorage.getItem('wuhan-taipei-runtime-player-v1'));
    if (saved?.version === 1) {
      for (const mode of Object.keys(controllerManager.entities)) {
        const p = saved.entities?.[mode];
        if (!p || ![p.x, p.y, p.z, p.heading].every(Number.isFinite)) continue;
        controllerManager.setMode(mode);
        controllerManager.teleportActiveTo(p.x, p.z, p.heading, p.y);
      }
      controllerManager.setMode(Object.hasOwn(controllerManager.entities, saved.activeMode) ? saved.activeMode : 'car');
    }
  } catch { /* Missing or unavailable storage does not prevent playing. */ }

  function savePlayerState() {
    try {
      const entities = Object.fromEntries(Object.entries(controllerManager.entities).map(([mode, entity]) => [mode, {
        x: entity.position.x, y: entity.position.y, z: entity.position.z, heading: entity.heading
      }]));
      localStorage.setItem('wuhan-taipei-runtime-player-v1', JSON.stringify({ version: 1, activeMode: controllerManager.activeMode, entities }));
    } catch { /* Storage may be disabled or full. */ }
  }

  const cameraSystem = new CameraSystem(renderer.domElement, controllerManager);
  const touchControls = new TouchControls(controllerManager);
  const soundButton = document.getElementById('btn-sound');
  const audioSystem = new CityAudioSystem({ controllerManager, trafficSystem, streetDetails: streetProps }, {
    onStateChange: updateSoundButton
  });
  function updateSoundButton() {
    if (!soundButton) return;
    soundButton.disabled = !audioSystem.supported;
    soundButton.setAttribute('aria-pressed', String(audioSystem.enabled));
    soundButton.setAttribute('aria-label', audioSystem.enabled ? '静音' : '开启声音');
    soundButton.title = audioSystem.supported ? `${audioSystem.enabled ? '静音' : '开启声音'} [N]` : '这个浏览器不支援 Web Audio';
    soundButton.querySelector('use').setAttribute('href', audioSystem.enabled ? '#i-sound' : '#i-sound-off');
  }
  soundButton?.addEventListener('click', () => audioSystem.setEnabled(!audioSystem.enabled));
  const garbageMusic = {update(){}};
  updateSoundButton();
  // pagehide also covers navigation away on mobile; preserve the context across back-forward cache restores.
  window.addEventListener('pagehide', (event) => {
    savePlayerState();
    if (!event.persisted) audioSystem.dispose();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePlayerState(); });
  markInit('controllers');

  // City-wide static geometry: chunk & distance-cull the small props, shadow stand-ins for the big casters
  // (scene-culling.js)
  const cullingRoots = ['WuhanGround', 'WuhanBuildings', 'WuhanElevated', 'WuhanStreetProps', 'WuhanLandmarks', 'WuhanRoadPaint']
    .map((name) => scene.getObjectByName(name))
    .filter(Boolean);
  setupSceneCulling(scene, cullingRoots, lightingSystem.sunLight.shadow);
  markInit('culling');

  // Small InstancedMeshes (<= 1000 instances) keep their matrices in uniform buffers that three.js
  // re-uploads on every draw of every pass (~2.5 MB/frame with the shadow cascades, stalling the GPU queue).
  // Storage attributes are only uploaded when instanceMatrix.needsUpdate is set.
  scene.traverse((object) => {
    if (object.isInstancedMesh) {
      object.instanceMatrix = new THREE.StorageInstancedBufferAttribute(object.instanceMatrix.array, 16);
    }
  });

  // 5. TSL RenderPipeline with Half-Res Screen Space Reflections (SSRNode), Bloom & Filmic Toning
  //    Fade out distant and matte surfaces so SSR spends its rays on visible glossy reflections.
  const scenePass = pass(scene, cameraSystem.camera);
  // The multisampled colour attachments (output, normal, metalRough) only need resolving, never storing: discarding
  // them spares the GPU writing 3 x 4 samples per pixel to memory every frame (transient, memoryless attachments where
  // the browser supports them). The multisampled depth stays stored: SSR reads it.
  scenePass.renderTarget.storeMultisampledColorBuffer = false;
  const ssrFade = smoothstep(360.0, 180.0, positionView.z.negate());
  const maxSSRRoughness = 0.75;
  const sceneMRT = mrt({
    output: output,
    normal: normalView,
    metalRough: vec2(roughness.lessThan(maxSSRRoughness).select(metalness.mul(ssrFade), 0), roughness)
  });
  sceneMRT.setBlendMode('normal', new THREE.BlendMode(THREE.MaterialBlending));
  sceneMRT.setBlendMode('metalRough', new THREE.BlendMode(THREE.MaterialBlending));
  scenePass.setMRT(sceneMRT);

  const scenePassColor = scenePass.getTextureNode('output');
  const scenePassDepth = scenePass.getTextureNode('depth');
  const scenePassNormal = scenePass.getTextureNode('normal');
  const scenePassMetalRough = scenePass.getTextureNode('metalRough');

  const ssrPass = ssr(scenePassColor, scenePassDepth, scenePassNormal, {
    metalnessNode: scenePassMetalRough.r,
    roughnessNode: scenePassMetalRough.g,
    camera: cameraSystem.camera
  });
  ssrPass.resolutionScale = 0.5;
  ssrPass.blurQuality = 1;
  ssrPass.maxDistance.value = 42;
  ssrPass.thickness.value = 0.85;
  // Fewer coarse steps, then refine detected hits to keep reflection edges precise.
  ssrPass.quality.value = 0.25;
  ssrPass.binaryRefine = true;
  ssrPass.intensity.value = 0.50;
  ssrPass.screenEdgeFadeBlack = true;

  // Roughness mip blur must not spread reflections back onto matte or nonreflective surfaces.
  const reflectionMask = scenePassMetalRough.r.greaterThan(0).select(smoothstep(maxSSRRoughness, 0.55, scenePassMetalRough.g), 0);
  const reflections = ssrPass.mul(reflectionMask);
  const colorGrade = createPostProcessing(renderer, scenePassColor, reflections);
  const renderPipeline = new THREE.RenderPipeline(renderer, colorGrade.outputNode);

  // 6. Wire UI Controls (Strictly using safe DOM APIs: textContent, classList, addEventListener)
  const MODES = TRAVEL_MODES;
  const modeButtons = document.querySelectorAll('.mode-btn[data-mode]');
  const timeButtons = document.querySelectorAll('[data-time]');
  const hudToggleBtn = document.getElementById('btn-toggle-hud');

  // Teleport destinations & the camera list come from city-config.js & cameras.js
  const teleportPopover = document.getElementById('teleport-popover');
  for (const loc of teleportMenuDestinations(GEO.coreDestinations||[],TELEPORT_LOCATIONS)) {
    const btn = document.createElement('button');
    btn.className = 'pop-item tp-btn';
    btn.type = 'button';
    btn.dataset.teleport = loc.id;
    const name = document.createElement('span');
    name.className = 'pop-name';
    name.textContent = loc.name;
    const sub = document.createElement('span');
    sub.className = 'pop-sub';
    sub.textContent = loc.sub || [loc.district,loc.category].filter(Boolean).join(' · ') || loc.road || '';
    btn.append(name, sub);
    teleportPopover.appendChild(btn);
  }
  const cameraPopover = document.getElementById('camera-popover');
  const cameraKeys = { chase: '5', action: '6', pov: '7', elephant: '8', zhongxiao: '9', cks: '0' };
  let lastCategory = '';
  for (const preset of CAMERA_PRESETS) {
    if (preset.category !== lastCategory) {
      const title = document.createElement('div');
      title.className = 'pop-title';
      title.textContent = preset.category === 'follow' ? '跟随' : '景点';
      cameraPopover.appendChild(title);
      lastCategory = preset.category;
    }
    const btn = document.createElement('button');
    btn.className = 'pop-item cam-btn';
    btn.type = 'button';
    btn.dataset.camera = preset.id;
    const name = document.createElement('span');
    name.className = 'pop-name';
    name.textContent = preset.name;
    btn.appendChild(name);
    if (cameraKeys[preset.id]) {
      const kbd = document.createElement('kbd');
      kbd.textContent = cameraKeys[preset.id];
      btn.appendChild(kbd);
    }
    cameraPopover.appendChild(btn);
  }
  const cameraButtons = document.querySelectorAll('[data-camera]');
  const teleportButtons = document.querySelectorAll('[data-teleport]');

  const elFps = document.getElementById('hud-fps');
  const elMode = document.getElementById('hud-active-mode');
  const elCamera = document.getElementById('hud-active-camera');
  const elSpeed = document.getElementById('hud-speed');
  const elSpeedMeter = document.getElementById('hud-speed-meter');
  const elAltitude = document.getElementById('hud-altitude');
  const elLocation = document.getElementById('hud-location');
  const elControlsHint = document.getElementById('hud-controls-hint');
  const gamepadControls = new GamepadControls(controllerManager, cameraSystem, {
    onCycleMode: (step) => {
      selectMode(MODES[(MODES.indexOf(controllerManager.activeMode) + step + MODES.length) % MODES.length]);
    },
    onCycleCamera: cycleCamera,
    onToggleMap: () => mapSystem.toggleFullMap(!mapSystem.isFullMapOpen),
    onCloseMap: () => mapSystem.toggleFullMap(false)
  });

  // Keyboard guide for each mode: [keys, action]
  const controlHints = {
    person: [[['W', 'S'], '前进 / 后退'], [['A', 'D'], '转向'], [['Shift'], '奔跑'], [['Space'], '跳跃'], [['拖动'], '环顾']],
    car: [[['W', 'S'], '油门 / 倒车'], [['A', 'D'], '方向盘'], [['Shift'], '加速'], [['B'], '喇叭'], [['拖动'], '环顾']],
    scooter: [[['W', 'S'], '油门 / 刹车'], [['A', 'D'], '倾斜转弯'], [['Shift'], '全油门'], [['B'], '喇叭'], [['拖动'], '环顾']],
    helicopter: [[['W', 'S'], '前倾 / 后仰'], [['A', 'D'], '偏航'], [['Space', 'E'], '上升'], [['Q', 'C'], '下降'], [['Shift'], '加速']]
  };
  // Boosted top speeds in km/h (controllers.js caps them at 8.2, 36, 23.5 & 52 m/s): full scale of the speed meter
  const topSpeedKmh = { person: 30, car: 130, scooter: 85, helicopter: 187 };

  function renderControlHints(mode) {
    if (!elControlsHint) return;
    const items = (controlHints[mode] || []).map(([keys, action]) => {
      const item = document.createElement('span');
      item.className = 'hint';
      for (const key of keys) {
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        item.appendChild(kbd);
      }
      const label = document.createElement('span');
      label.className = 'hint-label';
      label.textContent = action;
      item.appendChild(label);
      return item;
    });
    elControlsHint.replaceChildren(...items);
  }

  function selectMode(mode) {
    if(mode!=='car')taxiService.cancelForTravel('已结束本单：切换了移动方式');
    controllerManager.setMode(mode);
    mode=controllerManager.activeMode;
    touchControls.setMode(controllerManager.activeMode);
    gamepadControls.reset();
    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
      btn.setAttribute('aria-pressed',String(btn.getAttribute('data-mode')===mode));
    });
    document.body.dataset.mode = mode;
    const ent = controllerManager.getActiveEntity();
    if (elMode) elMode.textContent = ent.label;
    renderControlHints(mode);

    // If currently on a static scenic camera, switch to the chase camera so the user sees their character / vehicle
    const currentCam = cameraSystem.getActivePreset();
    if (currentCam.category !== 'follow') {
      selectCamera('chase', false);
    }
  }

  function selectCamera(camId, snap = false) {
    cameraSystem.setCameraPreset(camId, snap);
    cameraButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-camera') === camId);
    });
    const preset = cameraSystem.getActivePreset();
    if (elCamera) elCamera.textContent = preset.name;
    const returnFollow=document.getElementById('btn-return-follow');
    if(returnFollow)returnFollow.hidden=preset.category==='follow';
  }

  // Steps through CAMERA_PRESETS (V / Shift+V, and the arrows either side of the camera name)
  function cycleCamera(step) {
    const n = CAMERA_PRESETS.length;
    const idx = CAMERA_PRESETS.findIndex((p) => p.id === cameraSystem.activePresetId);
    selectCamera(CAMERA_PRESETS[(idx + step + n) % n].id, true);
  }

  function selectTime(timeId) {
    lightingSystem.applyPreset(timeId);
    colorGrade.applyPreset(lightingSystem.activePresetId);
    timeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-time') === timeId);
    });
  }

  // Popovers (native [popover]: light dismiss & Esc for free) open against the control that toggles them: data-anchor
  // names the element they sit above / below, data-align the one whose right edge they line up with
  const popovers = document.querySelectorAll('.popover[popover]');
  const supportsPopover = typeof HTMLElement.prototype.togglePopover === 'function';
  function closePopovers() {
    if (!supportsPopover) return;
    popovers.forEach((pop) => {
      if (pop.matches(':popover-open')) pop.hidePopover();
    });
  }
  popovers.forEach((pop) => {
    const invoker = document.querySelector(`[popovertarget="${pop.id}"]`);
    pop.addEventListener('beforetoggle', (e) => {
      const open = e.newState === 'open';
      if (invoker) invoker.classList.toggle('is-open', open);
      if (!open) return;
      const anchor = document.getElementById(pop.dataset.anchor) || invoker;
      const align = document.getElementById(pop.dataset.align) || invoker;
      if (!anchor || !align) return;
      const r = anchor.getBoundingClientRect();
      const spaceAbove = Math.max(0, r.top - 20);
      const spaceBelow = Math.max(0, window.innerHeight - r.bottom - 20);
      let above = pop.dataset.side === 'above';
      // The camera control moves to the top on touch screens; open toward the available space.
      if ((above ? spaceAbove : spaceBelow) < 160) above = spaceAbove > spaceBelow;
      const popWidth = parseFloat(getComputedStyle(pop).width) || 264;
      const maxRight = Math.max(8, window.innerWidth - popWidth - 8);
      pop.style.right = `${Math.min(maxRight, Math.max(8, window.innerWidth - align.getBoundingClientRect().right))}px`;
      if (above) {
        pop.style.top = 'auto';
        pop.style.bottom = `${window.innerHeight - r.top + 8}px`;
        pop.style.maxHeight = `${spaceAbove}px`;
      } else {
        pop.style.bottom = 'auto';
        pop.style.top = `${r.bottom + 8}px`;
        pop.style.maxHeight = `${spaceBelow}px`;
      }
    });
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectMode(btn.getAttribute('data-mode'));
    });
  });

  cameraButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectCamera(btn.getAttribute('data-camera'), true);
      closePopovers();
    });
  });

  const camPrevBtn = document.getElementById('cam-prev');
  const camNextBtn = document.getElementById('cam-next');
  if (camPrevBtn) camPrevBtn.addEventListener('click', () => cycleCamera(-1));
  if (camNextBtn) camNextBtn.addEventListener('click', () => cycleCamera(1));

  timeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectTime(btn.getAttribute('data-time'));
    });
  });

  // A mouse click mustn't leave the focus on a HUD button, or Space (jump / ascend) and Enter would press it again
  document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('button') : null;
    if (btn && e.detail > 0) btn.blur();
  });

  // Where you are: district & place over the road-name plates of the corner (city-config.js getLocationLabel:
  // "district place · road & cross road")
  let locationText = '';
  function renderLocation(label) {
    if (!elLocation || label === locationText) return;
    locationText = label;
    let place = '';
    let streets = label;
    const split = label.indexOf(' · ');
    if (split >= 0) {
      place = label.slice(0, split);
      streets = label.slice(split + 3);
    } else if (!label.includes(' & ') && !/[路街道巷弄段]/.test(label)) {
      place = label;
      streets = '';
    }
    const nodes = [];
    if (place) {
      const el = document.createElement('div');
      el.className = 'location-place';
      el.textContent = place;
      nodes.push(el);
    }
    if (streets) {
      const row = document.createElement('div');
      row.className = 'location-signs';
      for (const name of streets.split(' & ')) {
        const sign = document.createElement('span');
        sign.className = 'street-sign';
        sign.textContent = name;
        row.appendChild(sign);
      }
      nodes.push(row);
    }
    elLocation.replaceChildren(...nodes);
  }

  function teleportTo(x, z, heading = Math.PI, y = null) {
    taxiService.cancelForTravel('已结束本单：传送不计入接送行程');
    const destination = controllerManager.teleportActiveTo(x, z, heading,travelAltitude(controllerManager.activeMode,y));
    touchControls.reset();
    gamepadControls.reset();
    cameraSystem.resetForTeleport();
    selectCamera('chase', true);
    mapSystem.waypoint = {
      x: destination.x,
      z: destination.z,
      name: getLocationLabel(destination.x, destination.z)
    };
    return destination;
  }
  function visitDestination(destination,explicitMode=null){
    selectMode(travelMode(controllerManager.activeMode,explicitMode));
    const a=destination.arrival||destination;
    return teleportTo(a.x,a.z,a.heading??destination.heading??0,a.y??null);
  }
  document.getElementById('btn-return-follow')?.addEventListener('click',()=>selectCamera('chase',true));

  const mapSystem = new WuhanMapSystem({
    controllerManager,
    cameraSystem,
    trafficSystem,
    onToggle: (open) => {
      controllerManager.resetInput();
      touchControls.setEnabled(!open);
      gamepadControls.setEnabled(!open);
      const mapHint = document.getElementById('fullmap-hover-info');
      if (open && touchControls.available && mapHint) {
        mapHint.textContent = '点一下传送 · 拖动平移 · 用 + / − 缩放';
      }
    },
    onTeleport: teleportTo,
    onVisit:d=>visitDestination(d)
  });

  teleportButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const loc = TELEPORT_LOCATIONS[btn.getAttribute('data-teleport')];
      if (loc) visitDestination(loc);
      closePopovers();
    });
  });

  const openMapBtn = document.getElementById('btn-open-map');
  if (openMapBtn) openMapBtn.addEventListener('click', () => mapSystem.toggleFullMap(true));

  if (hudToggleBtn) {
    hudToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('hud-minimized');
      const isMin = document.body.classList.contains('hud-minimized');
      hudToggleBtn.setAttribute('aria-pressed', String(isMin));
      hudToggleBtn.setAttribute('aria-label', isMin ? '显示介面' : '隐藏介面');
      hudToggleBtn.title = isMin ? '显示介面 [H]' : '纯净画面：隐藏介面 [H]';
      if (isMin) closePopovers();
    });
  }

  // Global keyboard shortcuts for modes (1-4), cameras (V / 5-0), and HUD (H)
  window.addEventListener('keydown', (e) => {
    if (isTypingInField(e)) return;
    const camByKey = Object.fromEntries(Object.entries(cameraKeys).map(([id, k]) => [`Digit${k}`, id]));
    if (camByKey[e.code]) {
      selectCamera(camByKey[e.code], true);
      return;
    }
    switch (e.code) {
      case 'Digit1':
        selectMode('person');
        break;
      case 'Digit2':
        selectMode('car');
        break;
      case 'Digit3':
        selectMode('scooter');
        break;
      case 'Digit4':
        selectMode('helicopter');
        break;
      case 'KeyV':
        cycleCamera(e.shiftKey ? -1 : 1);
        break;
      case 'KeyH':
        if (hudToggleBtn) hudToggleBtn.click();
        break;
      case 'KeyN':
        if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) audioSystem.setEnabled(!audioSystem.enabled);
        break;
      case 'KeyB':
        if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !mapSystem.isFullMapOpen) audioSystem.honk(controllerManager.getActiveEntity());
        break;
    }
  });

  window.addEventListener('resize', () => {
    cameraSystem.onResize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (mapSystem.isFullMapOpen) {
      mapSystem.resizeFullCanvas();
      mapSystem.renderFullMap();
    }
  });

  // Initialize the UI and chase camera around the restored player, or the default taxi on a first visit.
  // ?mode=, ?camera= & ?time= (and ?at=<teleport id>) pick the start (handy for sharing a view)
  const params = new URLSearchParams(location.search);
  // A new visit opens a playable interface; screenshot-only HUD state is not a launch preference.
  document.body.classList.remove('hud-minimized');
  hudToggleBtn?.setAttribute('aria-pressed','false');
  if (params.get('at') && TELEPORT_LOCATIONS[params.get('at')]) {
    const loc = TELEPORT_LOCATIONS[params.get('at')];
    controllerManager.setMode(travelMode(controllerManager.activeMode,params.get('mode')));
    controllerManager.teleportActiveTo(loc.x, loc.z, loc.heading,travelAltitude(controllerManager.activeMode,loc.y));
  }
  selectMode(MODES.includes(params.get('mode')) ? params.get('mode') : controllerManager.activeMode);
  selectCamera(CAMERA_PRESETS.some((p) => p.id === params.get('camera')) ? params.get('camera') : 'chase', true);
  selectTime(['golden', 'midday', 'twilight', 'midnight'].includes(params.get('time')) ? params.get('time') : 'golden');
  markInit('ui');

  // The loading screen stays up while the shaders compile (precompileShaders() & the warm-up frame, see the loop) and
  // until the first frame is on screen
  await setStatus('正在编译着色器与渲染管线…');

  // 6b. Shader pre-compilation behind the loading screen. compileAsync() builds the node graphs in slices and has the GPU
  //     process compile the pipelines in parallel, but after every 8 ms slice it waits for a rendered frame, which
  //     leaves the main thread idle about half the time while nothing else animates; several calls side by side keep
  //     it busy.
  const COMPILE_POOL = 16;
  const nextTask = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((resolve) => setTimeout(resolve, 0)));
  async function precompileShaders() {
    // An empty frame first: it sets up the post-processing chain, which configures the scene pass's render target
    // (MSAA samples, depth format), so the pipelines compiled below are the very ones the scene pass asks for
    scene.visible = false;
    renderPipeline.render();
    scene.visible = true;
    markInit('postFX');

    // Every visible object with frustum culling off (like the warm-up frame, see the loop). Plain meshes that share
    // a material share its shader, so one job compiles them in turn (the first build serves the rest); every
    // instanced mesh gets a build of its own
    const culled = [];
    const jobs = [];
    const jobByMaterial = new Map();
    scene.traverseVisible((o) => {
      if (o.frustumCulled) {
        culled.push(o);
        o.frustumCulled = false;
      }
      if (!o.isMesh && !o.isLine && !o.isPoints && !o.isSprite) return;
      // chunks of one mesh share its pipeline (the first one compiles it) and the shadow stand-ins only ever draw in
      // the shadow maps (the warm-up frame compiles those)
      if (o.userData.sharesPipelineWith || o.userData.shadowProxy) return;
      if (o.isInstancedMesh || Array.isArray(o.material)) {
        jobs.push([o]);
        return;
      }
      let job = jobByMaterial.get(o.material);
      if (!job) {
        job = [];
        jobByMaterial.set(o.material, job);
        jobs.push(job);
      }
      job.push(o);
    });

    renderer.setRenderTarget(scenePass.renderTarget);
    renderer.setMRT(sceneMRT);
    const compile = async (object) => {
      // Each compile starts in a task of its own: compileAsync() keeps one precompilation state on the renderer,
      // which must not be mid-step for two of them in the same microtask checkpoint
      await nextTask();
      try {
        await renderer.compileAsync(object, cameraSystem.camera, scene);
      } catch (e) {
        console.warn('[compile]', e); // the warm-up frame compiles it instead
      }
    };
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        for (const object of job) await compile(object);
        done++;
        if (loadingStatus) {
          loadingStatus.textContent = `正在编译着色器与渲染管线… ${Math.round((done / jobs.length) * 100)}%`;
        }
        setLoadingProgress(done / jobs.length);
      }
    };
    await Promise.all(Array.from({ length: COMPILE_POOL }, worker));
    renderer.setMRT(null);
    renderer.setRenderTarget(null);
    for (const o of culled) o.frustumCulled = true;
  }

  const frameTimes=[];const runtimeErrors=[];
  window.addEventListener('error',e=>runtimeErrors.push(e.message));
  window.addEventListener('unhandledrejection',e=>runtimeErrors.push(String(e.reason)));
  window.wuhan={ready:false,base:'slop-taipei',data:GEO,scene,renderer,controllers:controllerManager,cameraSystem,map:mapSystem,
    placement:streetProps.placement,stats:{...streetProps.stats,buildings:cityBlocks.stats},taxi:taxiService,setMode:mode=>selectMode(mode),
    setView:id=>selectCamera(typeof id==='number'?CAMERA_PRESETS[id].id:id,true),
    gotoLandmark:(id,{mode=null}={})=>{const l=TELEPORT_LOCATIONS[id]||GEO.landmarks[id];if(!l)return false;visitDestination(l,mode);return true},
    metrics:()=>({errors:runtimeErrors,frames:frameTimes.slice(-180),render:renderer.info.render,base:'slop-taipei'})};
  await precompileShaders();
  markInit('compile');

  // 7. Animation Loop
  let lastTime = performance.now();
  let elapsed = 0;
  let frameCount = 0;
  let fpsTimer = 0;
  let nextPlayerSave = 0;
  let warmedUp = false; // see the first frame below

  if (elFps) elFps.textContent = '60';

  // At most two frames in flight: when the GPU falls behind (a slow or software adapter), skip drawing rather than
  // queue up command buffers & uploads without bound (the simulation keeps running)
  const device = renderer.backend.device;
  let framesInFlight = 0;

  renderer.setAnimationLoop((now) => {
    const rawDt = (now - lastTime) * 0.001;
    lastTime = now;
    frameTimes.push(rawDt*1000);if(frameTimes.length>360)frameTimes.shift();
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    elapsed += dt;

    // Update 3rd-person controllers, camera, signals, traffic, building LODs, and dynamic shadow focus
    gamepadControls.update(dt);
    controllerManager.update(dt, elapsed);
    cameraSystem.update(dt, elapsed);
    taxiService.update(dt,elapsed);
    const tunnelCamera=controllerManager.activeMode==='car'&&TUNNELS.camera(cameraSystem.camera.position,controllerManager.entities.car);
    if(tunnelCamera){cameraSystem.camera.position.set(tunnelCamera.x,tunnelCamera.y,tunnelCamera.z);cameraSystem.currentPos.copy(cameraSystem.camera.position);cameraSystem.camera.lookAt(controllerManager.entities.car.position.clone().add(new THREE.Vector3(Math.sin(controllerManager.entities.car.heading)*6,1.4,Math.cos(controllerManager.entities.car.heading)*6)));}
    streetProps.update(dt, elapsed, cameraSystem.camera);
    trafficSystem.update(dt, elapsed, cameraSystem.currentPos, controllerManager.getActiveEntity(), controllerManager.activeMode, cameraSystem.camera);
    elevated.update(dt, elapsed);
    const landmarkNight=lightingSystem.activePresetId==='midnight'?1:lightingSystem.activePresetId==='twilight'?0.55:0;
    wuhanLandmarkSystem?.update(landmarkNight);
    if (!document.hidden && now >= nextPlayerSave) {
      savePlayerState();
      nextPlayerSave = now + 5000;
    }
    lightingSystem.update(cameraSystem.currentPos);
    mapSystem.update();
    audioSystem.update(dt, elapsed, cameraSystem.camera, lightingSystem.activePresetId === 'midnight');
    garbageMusic.update(trafficSystem.garbageTruck);
    if (warmedUp) updateSceneCulling(cameraSystem.camera.position); // the warm-up frame draws every chunk

    // Render frame via TSL RenderPipeline (SSR + Bloom)
    if (warmedUp && device && framesInFlight >= 2) return;
    if (!warmedUp) {
      // First frame = pipeline warm-up behind the loading screen, for what precompileShaders() can't reach (the shadow
      // map passes): with frustum culling off, every visible material's pipelines compile now instead of stalling the
      // first time the camera turns towards it (one chunk / shadow stand-in per shared pipeline is enough)
      const culled = [];
      scene.traverse((o) => {
        if (o.frustumCulled && !o.userData.sharesPipelineWith) {
          culled.push(o);
          o.frustumCulled = false;
        }
      });
      renderPipeline.render();
      for (const o of culled) o.frustumCulled = true;
      markInit('warmup');
    }
    renderPipeline.render();
    if (device) {
      framesInFlight++;
      device.queue.onSubmittedWorkDone().catch(() => {}).then(() => framesInFlight--);
    }
    if (!warmedUp) {
      warmedUp = true;
      markInit('firstFrame');
      // The loading screen stays up until the GPU has got through the first frame (and the pipelines its warm-up
      // compiled), i.e. until the city is actually on screen
      const device = renderer.backend.device;
      Promise.resolve(device && device.queue.onSubmittedWorkDone()).catch(() => {}).then(() => {
        markInit('gpu');
        console.log(`[init] ${initTimings.join(', ')}`);
        initTimings = null;
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        audioSystem.ready = true;
        window.wuhan.ready=true;
        setLoadingProgress(1);
      });
    }

    // Telemetry uses wall time, not the clamped simulation step, so slow frames and high-refresh displays report
    // their actual frame rate (updates DOM every 250ms).
    frameCount++;
    fpsTimer += Math.max(0, rawDt);
    if (fpsTimer >= 0.25) {
      const currentFps = Math.round(frameCount / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;

      const activeEnt = controllerManager.getActiveEntity();
      const mode = controllerManager.activeMode;
      const kmh = Math.round(Math.abs(activeEnt.speed) * 3.6);
      const altM = Math.max(0, Math.round(activeEnt.position.y));

      if (elFps) {
        elFps.textContent = String(currentFps);
        elFps.className = currentFps >= 50 ? 'fps-ok' : currentFps >= 30 ? 'fps-warn' : 'fps-bad';
      }
      if (elSpeed) elSpeed.textContent = String(kmh);
      if (elSpeedMeter) elSpeedMeter.style.transform = `scaleX(${Math.min(1, kmh / (topSpeedKmh[mode] || 120))})`;
      document.body.classList.toggle('is-boosting', controllerManager.keys.boost && kmh > 0);
      if (elAltitude) elAltitude.textContent = altM.toLocaleString('zh-CN');
      // The street corner of the player on the follow cameras, of the camera itself on the scenic ones
      const where = cameraSystem.getActivePreset().category === 'follow' ? activeEnt.position : cameraSystem.currentPos;
      renderLocation(activeEnt.tunnelId?'武汉长江隧道':getLocationLabel(where.x, where.z));
    }
  });
}

initApp().catch(error=>{console.error(error);const status=document.getElementById('loading-status');if(status)status.textContent='加载失败：'+error.message;});
