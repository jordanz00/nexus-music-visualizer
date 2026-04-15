/**
 * Particula sphere factory + dat.GUI folders (ported from Humprt/particula MIT).
 */
import { reinitializeParticlesForSphere, updateColorsForSphere } from "./nexus-spheres-core.mjs";
import { sampleShapeLocalPosition, SHAPES } from "./nexus-shapes.mjs";

const _tmpShape = { x: 0, y: 0, z: 0 };

function reinitFromParams(THREE, sphere) {
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

export function createSphereVisualization(THREE, scene, mainGui, spheres, index) {
// Spheres default frequencies 
const defaultFrequencies = [ 
{ minFrequency: 20, maxFrequency: 80 }, // Sub-bass 
{ minFrequency: 120, maxFrequency: 250 }, // Bass 
{ minFrequency: 250, maxFrequency: 800 }, // Mid 
{ minFrequency: 1000, maxFrequency: 4000 }, // High mid 
{ minFrequency: 5000, maxFrequency: 10000 } // High 
]; 

const sphereParams = { 
enabled: index === 0, 
sphereRadius: 1.52, 
innerSphereRadius: 0.18, 
rotationSpeed: 0.001, 
rotationSpeedMin: 0, 
rotationSpeedMax: 0.065, 
rotationSmoothness: 0.3, 
particleCount: index === 0 ? 68000 : 42000, 
particleSize: 0.0058, 
particleLifetime: 3.0, 
minFrequency: defaultFrequencies[index]?.minFrequency || 0, 
maxFrequency: defaultFrequencies[index]?.maxFrequency || 22050, 
minFrequencyBeat: defaultFrequencies[index]?.minFrequency || 0, 
maxFrequencyBeat: defaultFrequencies[index]?.maxFrequency || 22050, 
noiseScale: 4.0, 
dynamicNoiseScale: true, 
minNoiseScale: 0.5, 
maxNoiseScale: 5.0, 
noiseStep: 0.2, 
noiseSpeed: 0.1, 
turbulenceStrength: 0.005, 
colorStart: '#ff3366', 
colorEnd: '#3366ff', 
volumeChangeThreshold: 0.1, 
peakSensitivity: 1.1, 
beatThreshold: 200, 
baseWaveStrength: 20.0, 
beatStrength: 0.01, 
gainMultiplier: 1,
shape: "sphere",
ellipsoidEx: 1,
ellipsoidEy: 0.65,
ellipsoidEz: 0.5,
torusMajorRatio: 0.72,
torusTubeRatio: 0.22,
ringThickness: 0.04,
floatSpread: 1.05,
floatSpeed: 0.11,
noiseTempoSync: 0.48,
noiseBpmSlow: 0.36,
colorCycleSpeed: 0.62,
colorCycleSpread: 0.4,
colorCycleAudio: 0.58
}; 

const sphereGeometry = new THREE.BufferGeometry(); 
const spherePositions = new Float32Array(sphereParams.particleCount * 3); 
const sphereColors = new Float32Array(sphereParams.particleCount * 3); 
const velocities = new Float32Array(sphereParams.particleCount * 3); 
const basePositions = new Float32Array(sphereParams.particleCount * 3); 
const lifetimes = new Float32Array(sphereParams.particleCount); 
const maxLifetimes = new Float32Array(sphereParams.particleCount); 
const beatEffects = new Float32Array(sphereParams.particleCount); 

// Init particles (shape-aware local distribution)
for (let i = 0; i < sphereParams.particleCount; i++) {
const i3 = i * 3;
sampleShapeLocalPosition(sphereParams, _tmpShape);
const x = _tmpShape.x;
const y = _tmpShape.y;
const z = _tmpShape.z;

spherePositions[i3] = x; 
spherePositions[i3 + 1] = y; 
spherePositions[i3 + 2] = z; 

basePositions[i3] = x; 
basePositions[i3 + 1] = y; 
basePositions[i3 + 2] = z; 

velocities[i3] = 0; 
velocities[i3 + 1] = 0; 
velocities[i3 + 2] = 0; 

const lt = Math.random() * sphereParams.particleLifetime; 
lifetimes[i] = lt; 
maxLifetimes[i] = lt; 

beatEffects[i] = 0; 
} 

sphereGeometry.setAttribute('position', new THREE.BufferAttribute(spherePositions, 3)); 
sphereGeometry.setAttribute('color', new THREE.BufferAttribute(sphereColors, 3)); 

const sphereMaterial = new THREE.PointsMaterial({ 
size: sphereParams.particleSize, 
vertexColors: true, 
transparent: true, 
opacity: 0.96, 
blending: THREE.AdditiveBlending, 
fog: true,
depthWrite: false
}); 

const sphereParticleSystem = new THREE.Points(sphereGeometry, sphereMaterial); 
scene.add(sphereParticleSystem); 

// Sphere visibility `enabled` 
sphereParticleSystem.visible = sphereParams.enabled; 

const sphere = { 
index: index, 
params: sphereParams, 
geometry: sphereGeometry, 
colors: sphereColors, 
material: sphereMaterial, 
particleSystem: sphereParticleSystem, 
positions: spherePositions, 
velocities: velocities, 
basePositions: basePositions, 
lifetimes: lifetimes, 
maxLifetimes: maxLifetimes, 
beatEffects: beatEffects, 
lastNoiseScale: sphereParams.noiseScale, 
lastValidVolume: 0, 
lastRotationSpeed: 0,
floatPhase: 0,
floatPhase0: Math.random() * Math.PI * 2
}; 

sphere.peakDetection = { 
energyHistory: [], 
historyLength: 30, 
lastPeakTime: 0, 
minTimeBetweenPeaks: 200 
}; 

// Colors update 
updateColorsForSphere(THREE, sphereParams, sphereGeometry, sphereColors); 

// GUI folder 
const sphereFolder = mainGui.addFolder('Sphere ' + (index + 1)); 

sphereFolder.add(sphere.params, 'particleCount', 4000, 150000).step(1000) 
.onChange(() => { 
const { 
newPositions, 
newColors, 
newVelocities, 
newBasePositions, 
newLifetimes, 
newMaxLifetimes, 
newBeatEffects 
} = reinitializeParticlesForSphere(
THREE,
sphere, sphere.params, sphere.geometry
);

sphere.positions = newPositions; 
sphere.colors = newColors; 
sphere.velocities = newVelocities; 
sphere.basePositions = newBasePositions; 
sphere.lifetimes = newLifetimes; 
sphere.maxLifetimes = newMaxLifetimes; 
sphere.beatEffects = newBeatEffects; 

sphere.geometry.attributes.position.needsUpdate = true; 
sphere.geometry.attributes.color.needsUpdate = true; 
}); 

sphereFolder.add(sphere.params, 'particleSize', 0.0015, 0.018).step(0.0005) 
.onChange(value => { 
sphere.material.size = value; 
}); 

if (index === 0) { 
sphereFolder.add({ copyToOthers: () => { 
for (let i = 1; i < spheres.length; i++) { 
Object.assign(spheres[i].params, JSON.parse(JSON.stringify(sphere.params))); 

const { 
newPositions, 
newColors, 
newVelocities, 
newBasePositions, 
newLifetimes, 
newMaxLifetimes, 
newBeatEffects 
} = reinitializeParticlesForSphere(
THREE,
spheres[i], spheres[i].params, spheres[i].geometry
);

spheres[i].positions = newPositions; 
spheres[i].colors = newColors; 
spheres[i].velocities = newVelocities; 
spheres[i].basePositions = newBasePositions; 
spheres[i].lifetimes = newLifetimes; 
spheres[i].maxLifetimes = newMaxLifetimes; 
spheres[i].beatEffects = newBeatEffects; 

spheres[i].geometry.attributes.position.needsUpdate = true; 
spheres[i].geometry.attributes.color.needsUpdate = true; 


spheres[i].particleSystem.visible = spheres[i].params.enabled; 

const targetFolder = mainGui.__folders[`Sphere ${i + 1}`]; 
if (targetFolder) { 
targetFolder.__controllers.forEach(controller => controller.updateDisplay()); 
} 
} 
mainGui.updateDisplay();
}}, 'copyToOthers').name('Copy to Spheres 2-5'); 
} 
sphereFolder.add(sphere.params, 'particleLifetime', 1, 20).step(1);

sphereFolder.add(sphere.params, 'shape', SHAPES).name('Shape').onChange(() => {
reinitFromParams(THREE, sphere);
updateColorsForSphere(THREE, sphere.params, sphere.geometry, sphere.colors);
});

sphereFolder.add(sphere.params, 'ellipsoidEx', 0.2, 2.5).step(0.02).name('Ellipsoid Ex').onChange(() => reinitFromParams(THREE, sphere));
sphereFolder.add(sphere.params, 'ellipsoidEy', 0.2, 2.5).step(0.02).name('Ellipsoid Ey').onChange(() => reinitFromParams(THREE, sphere));
sphereFolder.add(sphere.params, 'ellipsoidEz', 0.2, 2.5).step(0.02).name('Ellipsoid Ez').onChange(() => reinitFromParams(THREE, sphere));
sphereFolder.add(sphere.params, 'torusMajorRatio', 0.35, 0.95).step(0.01).name('Torus R').onChange(() => reinitFromParams(THREE, sphere));
sphereFolder.add(sphere.params, 'torusTubeRatio', 0.06, 0.45).step(0.01).name('Torus r').onChange(() => reinitFromParams(THREE, sphere));
sphereFolder.add(sphere.params, 'ringThickness', 0.01, 0.2).step(0.005).name('Ring thickness').onChange(() => reinitFromParams(THREE, sphere));
sphereFolder.add(sphere.params, 'floatSpread', 0, 1.6).step(0.02).name('Float spread');
sphereFolder.add(sphere.params, 'floatSpeed', 0, 0.55).step(0.01).name('Float speed');
sphereFolder.add(sphere.params, 'noiseTempoSync', 0, 1).step(0.02).name('Noise ↔ beat');
sphereFolder.add(sphere.params, 'noiseBpmSlow', 0, 1).step(0.02).name('Noise BPM slow');

sphereFolder.add(sphere.params, 'sphereRadius', 0.05, 3.0).step(0.05); 
sphereFolder.add(sphere.params, 'innerSphereRadius', 0, 1).step(0.01) 
.onChange(() => { 
const { 
newPositions, 
newColors, 
newVelocities, 
newBasePositions, 
newLifetimes, 
newMaxLifetimes, 
newBeatEffects 
} = reinitializeParticlesForSphere(THREE,
 sphere, sphere.params, sphere.geometry); 

sphere.positions = newPositions; 
sphere.colors = newColors; 
sphere.velocities = newVelocities; 
sphere.basePositions = newBasePositions; 
sphere.lifetimes = newLifetimes; 
sphere.maxLifetimes = newMaxLifetimes; 
sphere.beatEffects = newBeatEffects; 

sphere.geometry.attributes.position.needsUpdate = true; 
sphere.geometry.attributes.color.needsUpdate = true; 
}); 

sphereFolder.add(sphere.params, 'rotationSpeedMin', 0, 0.02).step(0.001); 
sphereFolder.add(sphere.params, 'rotationSpeedMax', 0, 0.1).step(0.001); 
sphereFolder.add(sphere.params, 'rotationSmoothness', 0.01, 1).step(0.01); 
sphereFolder.add(sphere.params, 'volumeChangeThreshold', 0.01, 0.2).step(0.01); 

sphereFolder.add(sphereParams, 'minFrequency', 0, 22050).step(1).name('Min Frequency (Hz)') 
.onChange(value => sphereParams.minFrequency = value); 
sphereFolder.add(sphereParams, 'maxFrequency', 0, 22050).step(1).name('Max Frequency (Hz)') 
.onChange(value => sphereParams.maxFrequency = value); 

// GUI defaults 
const minFreqController = sphereFolder.__controllers.find(c => c.property === 'minFrequency'); 
const maxFreqController = sphereFolder.__controllers.find(c => c.property === 'maxFrequency'); 
if (minFreqController) minFreqController.setValue(sphereParams.minFrequency); 
if (maxFreqController) maxFreqController.setValue(sphereParams.maxFrequency); 

sphereFolder.add(sphere.params, 'noiseScale', 0.1, 10.0).step(0.1); 
sphereFolder.add(sphere.params, 'minNoiseScale', 0.0, 10.0).step(0.1).name('Min NoiseScale') 
.onChange(() => { 
if (sphere.params.minNoiseScale > sphere.params.maxNoiseScale) { 
sphere.params.minNoiseScale = sphere.params.maxNoiseScale; 
} 
updateNoiseStep(sphere.params); 
}); 
sphereFolder.add(sphere.params, 'maxNoiseScale', 0.0, 10.0).step(0.1).name('Max NoiseScale') 
.onChange(() => { 
if (sphere.params.maxNoiseScale < sphere.params.minNoiseScale) { 
sphere.params.maxNoiseScale = sphere.params.minNoiseScale; 
} 
updateNoiseStep(sphere.params); 
}); 
sphereFolder.add(sphere.params, 'noiseStep', 0.1, 5.0).step(0.1).name('Noise Step') 
.onChange(() => { 
updateNoiseStep(sphere.params); 
}); 
function updateNoiseStep(params) { 
const range = params.maxNoiseScale - params.minNoiseScale; 
if (params.noiseStep > range) { 
params.noiseStep = range / 2; 
} 
} 
sphereFolder.add(sphere.params, 'noiseSpeed', 0, 1.0).step(0.01); 

sphereFolder.add(sphere.params, 'peakSensitivity', 1.01, 2).step(0.01); 
sphereFolder.add(sphere.peakDetection, 'historyLength', 10, 1200).step(1).name('History Length'); 
sphereFolder.add(sphere.peakDetection, 'minTimeBetweenPeaks', 50, 5000).step(10).name('Min Time Between Peaks'); 

sphereFolder.add(sphere.params, 'turbulenceStrength', 0, 0.03).step(0.0001); 
sphereFolder.addColor(sphere.params, 'colorStart') 
.onChange(() => {
if ((sphere.params.colorCycleSpeed || 0) < 0.0001) {
updateColorsForSphere(THREE, sphere.params, sphere.geometry, sphere.colors);
}
}); 
sphereFolder.addColor(sphere.params, 'colorEnd') 
.onChange(() => {
if ((sphere.params.colorCycleSpeed || 0) < 0.0001) {
updateColorsForSphere(THREE, sphere.params, sphere.geometry, sphere.colors);
}
}); 
sphereFolder.add(sphere.params, 'colorCycleSpeed', 0, 2.2).step(0.02).name('Color cycle').onChange((v) => {
if (v < 0.0001) updateColorsForSphere(THREE, sphere.params, sphere.geometry, sphere.colors);
});
sphereFolder.add(sphere.params, 'colorCycleSpread', 0, 1).step(0.02).name('Cycle spread');
sphereFolder.add(sphere.params, 'colorCycleAudio', 0, 1).step(0.02).name('Cycle ↔ beat');

sphereFolder.add(sphereParams, 'minFrequencyBeat', 0, 22050).step(1).name('Min Freq Beat (Hz)') 
.onChange(value => sphereParams.minFrequencyBeat = value); 
sphereFolder.add(sphereParams, 'maxFrequencyBeat', 0, 22050).step(1).name('Max Freq Beat (Hz)') 
.onChange(value => sphereParams.maxFrequencyBeat = value); 

sphereFolder.add(sphere.params, 'beatThreshold', 50, 255).step(1); 
sphereFolder.add(sphere.params, 'beatStrength', 0, 0.05).step(0.001); 
sphereFolder.add(sphere.params, 'gainMultiplier', 1.0, 3.0).step(0.1); 
sphereFolder.add(sphere.params, 'dynamicNoiseScale'); 
sphereFolder.add(sphere.params, 'enabled').onChange(value => { 
sphere.particleSystem.visible = value; 
}); 

sphereFolder.close();

return sphere;
}
