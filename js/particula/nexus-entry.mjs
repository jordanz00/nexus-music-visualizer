/**
 * NEXUS Particula embed — MIT port from github.com/Humprt/particula (ESM, no CDN at runtime).
 * Mounts Three.js r136 to #nx-particula-host; audio from NX.S via nexus-audio.mjs; GUI in #nx-particula-gui-host.
 * Do not use the name "Particula" for NEXUS product branding (per upstream README).
 */

import * as THREE from '../../vendor/particula/three.module.r136.js';
import dat from '../../vendor/particula/dat.gui.module.js';
import { noise, beatManager } from './noise-beat.mjs';
import { createSphereVisualization } from './nexus-spheres-factory.mjs';
import {
  fillFrequencyBufferFromNXS,
  getAudioData,
  getSmoothVolumeNXS
} from './nexus-audio.mjs';
import { tickSpheres, reinitializeParticlesForSphere } from './nexus-spheres-core.mjs';

const PRESETS_STORAGE_KEY = 'nexusParticulaPresets';
const PRESETS_JSON_URL = new URL('./data/particula_presets.json', import.meta.url);

/** Old NEXUS ping-pong preset names → bundled Particula preset keys. */
const LEGACY_PRESET_MAP = {
  Default: 'Mixed',
  FluidShowcase: 'Color chaos',
  Trance: 'Animus Vox',
  Techno: 'Electronic funk',
  Ambient: 'Blue',
  EDM: 'Kilo Herz 2',
  Glitch: 'Color chaos',
  Club: 'Enter',
  Psychedelic: 'Purple',
  Tornado: 'Sand wind',
  Ocean: 'Blue green',
  Gravity: 'Core green',
  Vortex: 'Outer pulse'
};

function mergePresets(filePresets) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) || '{}') || {};
  } catch (e) {
    saved = {};
  }
  return Object.assign({}, filePresets, saved);
}

function readUserPresetLayer() {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function writeUserPresetLayer(user) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('[NEXUS Particula] preset save failed', e);
  }
}

function rebuildPresetsFromSources(filePresets, presets) {
  const user = readUserPresetLayer();
  Object.keys(presets).forEach((k) => delete presets[k]);
  Object.assign(presets, filePresets, user);
}

function buildPresetToolbar(presetHost, filePresets, presets, spheres, mainGui, defaultParams) {
  while (presetHost.firstChild) presetHost.removeChild(presetHost.firstChild);

  const strip = document.createElement('div');
  strip.className = 'nx-particula-preset-strip';

  const presetInput = document.createElement('input');
  presetInput.type = 'text';
  presetInput.placeholder = 'Preset name';
  presetInput.setAttribute('maxlength', '120');

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = 'Reset';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export';

  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.textContent = 'Import';

  const presetSelect = document.createElement('select');
  presetSelect.setAttribute('aria-label', 'Particula preset');

  function updatePresetOptions() {
    while (presetSelect.firstChild) presetSelect.removeChild(presetSelect.firstChild);
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Select preset';
    presetSelect.appendChild(opt0);
    Object.keys(presets).sort().forEach((name) => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      presetSelect.appendChild(o);
    });
  }

  function applyPresetArray(preset) {
    if (!preset || !Array.isArray(preset)) return;
    spheres.forEach((sphere, index) => {
      const slice = preset[index];
      if (!slice) return;
      const previousParticleCount = sphere.params.particleCount;
      Object.assign(sphere.params, JSON.parse(JSON.stringify(slice)));
      if (!('minFrequencyBeat' in sphere.params)) {
        sphere.params.minFrequencyBeat = sphere.params.minFrequency;
      }
      if (!('maxFrequencyBeat' in sphere.params)) {
        sphere.params.maxFrequencyBeat = sphere.params.maxFrequency;
      }
      if (sphere.params.minNoiseScale >= sphere.params.maxNoiseScale) {
        sphere.params.maxNoiseScale = sphere.params.minNoiseScale + 0.1;
      }
      if (sphere.params.particleCount !== previousParticleCount) {
        const {
          newPositions,
          newColors,
          newVelocities,
          newBasePositions,
          newLifetimes,
          newMaxLifetimes,
          newBeatEffects
        } = reinitializeParticlesForSphere(THREE, sphere, sphere.params, sphere.geometry);
        sphere.positions = newPositions;
        sphere.colors = newColors;
        sphere.velocities = newVelocities;
        sphere.basePositions = newBasePositions;
        sphere.lifetimes = newLifetimes;
        sphere.maxLifetimes = newMaxLifetimes;
        sphere.beatEffects = newBeatEffects;
        sphere.geometry.attributes.position.needsUpdate = true;
        sphere.geometry.attributes.color.needsUpdate = true;
      }
      sphere.particleSystem.visible = sphere.params.enabled;
      const sphereFolder = mainGui.__folders[`Sphere ${index + 1}`];
      if (sphereFolder) sphereFolder.__controllers.forEach((c) => c.updateDisplay());
    });
    mainGui.updateDisplay();
  }

  saveButton.addEventListener('click', () => {
    const presetName = presetInput.value.trim();
    if (!presetName) return;
    const data = spheres.map((s) => JSON.parse(JSON.stringify(s.params)));
    presets[presetName] = data;
    const user = readUserPresetLayer();
    user[presetName] = data;
    writeUserPresetLayer(user);
    updatePresetOptions();
  });

  resetButton.addEventListener('click', () => {
    spheres.forEach((sphere, index) => {
      const previousParticleCount = sphere.params.particleCount;
      Object.assign(sphere.params, JSON.parse(JSON.stringify(defaultParams[index])));
      sphere.particleSystem.visible = sphere.params.enabled;
      if (sphere.params.particleCount !== previousParticleCount) {
        const {
          newPositions,
          newColors,
          newVelocities,
          newBasePositions,
          newLifetimes,
          newMaxLifetimes,
          newBeatEffects
        } = reinitializeParticlesForSphere(THREE, sphere, sphere.params, sphere.geometry);
        sphere.positions = newPositions;
        sphere.colors = newColors;
        sphere.velocities = newVelocities;
        sphere.basePositions = newBasePositions;
        sphere.lifetimes = newLifetimes;
        sphere.maxLifetimes = newMaxLifetimes;
        sphere.beatEffects = newBeatEffects;
        sphere.geometry.attributes.position.needsUpdate = true;
        sphere.geometry.attributes.color.needsUpdate = true;
      }
      const sphereFolder = mainGui.__folders[`Sphere ${index + 1}`];
      if (sphereFolder) sphereFolder.__controllers.forEach((c) => c.updateDisplay());
    });
    mainGui.updateDisplay();
  });

  deleteButton.addEventListener('click', () => {
    const presetName = presetSelect.value;
    if (!presetName) return;
    if (!window.confirm(`Delete preset "${presetName}"?`)) return;
    const user = readUserPresetLayer();
    delete user[presetName];
    writeUserPresetLayer(user);
    rebuildPresetsFromSources(filePresets, presets);
    updatePresetOptions();
    presetSelect.value = '';
    presetInput.value = '';
  });

  exportButton.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'particula_presets_export.json';
    a.rel = 'noopener';
    a.click();
    URL.revokeObjectURL(url);
  });

  importButton.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.addEventListener('change', () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(String(reader.result || '{}'));
          if (!imported || typeof imported !== 'object') return;
          writeUserPresetLayer(imported);
          rebuildPresetsFromSources(filePresets, presets);
          updatePresetOptions();
        } catch (e) {
          console.warn('[NEXUS Particula] import failed', e);
        }
      };
      reader.readAsText(file);
    });
    inp.click();
  });

  presetSelect.addEventListener('change', () => {
    const presetName = presetSelect.value;
    if (!presetName) return;
    applyPresetArray(presets[presetName]);
  });

  strip.appendChild(presetInput);
  strip.appendChild(saveButton);
  strip.appendChild(resetButton);
  strip.appendChild(deleteButton);
  strip.appendChild(exportButton);
  strip.appendChild(importButton);
  strip.appendChild(presetSelect);
  presetHost.appendChild(strip);

  updatePresetOptions();
  return { updatePresetOptions, applyPresetArray };
}

async function boot() {
  const host = document.getElementById('nx-particula-host');
  const guiHost = document.getElementById('nx-particula-gui-host');
  const presetHost = document.getElementById('nx-particula-preset-host');
  if (!host || !guiHost || !presetHost) {
    console.warn('[NEXUS Particula] missing host nodes');
    return;
  }

  let filePresets = {};
  try {
    const res = await fetch(PRESETS_JSON_URL.href);
    filePresets = await res.json();
  } catch (e) {
    console.warn('[NEXUS Particula] preset JSON fetch failed', e);
  }
  const presets = mergePresets(filePresets);

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.z = 2.5;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false
  });
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);

  const mainGui = new dat.GUI({ autoPlace: false });
  guiHost.appendChild(mainGui.domElement);

  const fogParams = {
    enabled: true,
    color: '#000000',
    near: 2.7,
    far: 3.7
  };
  function updateFog() {
    if (!fogParams.enabled) {
      scene.fog = null;
    } else {
      const color = new THREE.Color(fogParams.color);
      scene.fog = new THREE.Fog(color, fogParams.near, fogParams.far);
    }
  }
  updateFog();

  mainGui.add(fogParams, 'enabled').name('Fog Enabled').onChange(updateFog);
  mainGui.addColor(fogParams, 'color').name('Fog Color').onChange(updateFog);
  mainGui.add(fogParams, 'near', 0.1, 5, 0.1).name('Fog Near').onChange(updateFog);
  mainGui.add(fogParams, 'far', 0.1, 5, 0.1).name('Fog Far').onChange(updateFog);

  const camParams = {
    roam: 1,
    distance: 2.52,
    swayAmp: 0.28,
    pitchWiggle: 0.15,
    beatNod: 0.18
  };
  const cameraFolder = mainGui.addFolder('Camera (overlay)');
  cameraFolder.add(camParams, 'roam', 0, 2.2).step(0.05).name('Roam rate');
  cameraFolder.add(camParams, 'distance', 1.2, 4.5).step(0.02).name('Distance');
  cameraFolder.add(camParams, 'swayAmp', 0, 0.55).step(0.01).name('Sway');
  cameraFolder.add(camParams, 'pitchWiggle', 0, 0.45).step(0.01).name('Pitch wiggle');
  cameraFolder.add(camParams, 'beatNod', 0, 0.45).step(0.01).name('Beat nod');
  cameraFolder.close();

  function updateCamera(nowMs, S) {
    const t = nowMs * 0.001;
    const bp = typeof S.beatPhase === 'number' ? S.beatPhase : 0;
    const bc = typeof S.bpmConfidence === 'number' ? S.bpmConfidence : 0;
    const beatLift = bp * camParams.beatNod * (0.22 + bc * 0.78);
    const ang = t * 0.1 * camParams.roam;
    const sway = camParams.swayAmp;
    camera.position.x = Math.sin(ang) * sway + Math.sin(t * 0.31 + bp * 6.28318) * 0.045;
    camera.position.y = camParams.pitchWiggle * Math.sin(t * 0.17) + beatLift * 0.11;
    camera.position.z = camParams.distance + Math.cos(ang * 0.92) * (sway * 0.38);
    const lookY = -0.02 + beatLift * 0.07;
    camera.lookAt(0, lookY, 0);
  }

  function tickFloatOrigins(dt) {
    for (let si = 0; si < spheres.length; si++) {
      const s = spheres[si];
      if (!s.params.enabled) continue;
      const spread = typeof s.params.floatSpread === 'number' ? s.params.floatSpread : 0.75;
      const spd = typeof s.params.floatSpeed === 'number' ? s.params.floatSpeed : 0.11;
      s.floatPhase = (s.floatPhase || 0) + dt * spd * 0.9;
      const ph = s.floatPhase0 || 0;
      const ox = Math.sin(s.floatPhase + ph) * spread;
      const oy = Math.sin(s.floatPhase * 0.71 + ph * 1.4) * spread * 0.48;
      const oz = Math.cos(s.floatPhase * 0.87 + ph * 0.9) * spread * 0.62;
      s.particleSystem.position.set(ox, oy, oz);
    }
  }

  const spheres = [];
  for (let i = 0; i < 5; i++) {
    spheres.push(createSphereVisualization(THREE, scene, mainGui, spheres, i));
  }

  const defaultParams = spheres.map((s) => JSON.parse(JSON.stringify(s.params)));

  mainGui
    .add({ globalParticleCount: 20000 }, 'globalParticleCount', 1000, 100000)
    .step(1000)
    .onChange((value) => {
      spheres.forEach((sphere, index) => {
        sphere.params.particleCount = value;
        const {
          newPositions,
          newColors,
          newVelocities,
          newBasePositions,
          newLifetimes,
          newMaxLifetimes,
          newBeatEffects
        } = reinitializeParticlesForSphere(THREE, sphere, sphere.params, sphere.geometry);
        sphere.positions = newPositions;
        sphere.colors = newColors;
        sphere.velocities = newVelocities;
        sphere.basePositions = newBasePositions;
        sphere.lifetimes = newLifetimes;
        sphere.maxLifetimes = newMaxLifetimes;
        sphere.beatEffects = newBeatEffects;
        sphere.geometry.attributes.position.needsUpdate = true;
        sphere.geometry.attributes.color.needsUpdate = true;
        const sphereFolder = mainGui.__folders[`Sphere ${index + 1}`];
        if (sphereFolder) {
          const particleCountController = sphereFolder.__controllers.find(
            (controller) => controller.property === 'particleCount'
          );
          if (particleCountController) particleCountController.updateDisplay();
        }
      });
    });

  const { applyPresetArray } = buildPresetToolbar(
    presetHost,
    filePresets,
    presets,
    spheres,
    mainGui,
    defaultParams
  );

  let lastT = performance.now();
  let lastCssW = 1;
  let lastCssH = 1;

  function syncRendererSize(rw0, rh0, cssW, cssH) {
    const w = Math.max(1, cssW | 0);
    const h = Math.max(1, cssH | 0);
    lastCssW = w;
    lastCssH = h;
    const pr = Math.max(1, rw0) / Math.max(1, w);
    const cap = window.NX && NX.S && NX.S._iosCoarsePointer ? 1.35 : 2;
    const dpr = Math.min(pr, cap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function tickResizeRender() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const S = window.NX && window.NX.S ? window.NX.S : {};
    updateCamera(now, S);
    tickSpheres({
      THREE,
      noise,
      beatManager,
      spheres,
      getAudioData,
      fillFrequencyBufferFromNXS,
      getSmoothVolumeNXS,
      currentTime: now,
      deltaTime: dt
    });
    tickFloatOrigins(dt);
    renderer.render(scene, camera);
  }
  tickResizeRender._nxParticula = true;

  function applyPresetByName(name) {
    const key =
      LEGACY_PRESET_MAP[name] ||
      (presets[name] ? name : null) ||
      Object.keys(presets)[0];
    if (key && presets[key]) applyPresetArray(presets[key]);
  }

  window.NX = window.NX || {};
  NX.GpuParticles = NX.GpuParticles || {};
  NX.GpuParticles.renderOverlay = tickResizeRender;
  NX.GpuParticles.isReady = () => true;

  NX.particles = {
    _ready: true,
    onHostResize(rw0, rh0, cssW, cssH) {
      syncRendererSize(rw0 | 0, rh0 | 0, cssW | 0, cssH | 0);
    },
    applyPreset(name) {
      applyPresetByName(name || 'Default');
    }
  };

  if (typeof NX.resize === 'function') {
    try {
      NX.resize();
    } catch (eRz) { /* ignore */ }
  }

  try {
    if (
      NX.SceneManager &&
      NX.S &&
      (NX.S.visualMode || '') === 'particles_showcase' &&
      typeof NX.particles.applyPreset === 'function'
    ) {
      NX.particles.applyPreset('FluidShowcase');
    }
  } catch (eShow) { /* ignore */ }

  if (typeof NX.FxChain !== 'undefined' && NX.FxChain && typeof NX.FxChain.updateGpuParticlesStatus === 'function') {
    try {
      NX.FxChain.updateGpuParticlesStatus();
    } catch (e) { /* ignore */ }
  }

  try {
    if (typeof window.__NX_BOOT_PHASE__ === 'function') {
      window.__NX_BOOT_PHASE__('Particula overlay ready', 0.99);
    }
  } catch (e) { /* ignore */ }
}

boot().catch((e) => {
  console.warn('[NEXUS Particula] boot failed', e);
});
