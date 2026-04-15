/**
 * Particula sphere simulation tick + geometry helpers (MIT upstream logic).
 */

import { sampleShapeLocalPosition, applyShapeBoundary, respawnShapeLocalPosition } from './nexus-shapes.mjs';
import { getNoiseTimeFactor } from './nexus-audio.mjs';

const _tmpSpawn = { x: 0, y: 0, z: 0 };

export function generateNewNoiseScale(params, lastNoiseScale) {
  if (!params.dynamicNoiseScale) return params.noiseScale;
  let { minNoiseScale, maxNoiseScale, noiseStep } = params;
  if (minNoiseScale >= maxNoiseScale) maxNoiseScale = minNoiseScale + 0.1;
  let range = maxNoiseScale - minNoiseScale;
  if (range < 0.1) {
    range = 0.1;
    maxNoiseScale = minNoiseScale + range;
  }
  if (noiseStep > range) noiseStep = range / 2;
  let last = Math.max(minNoiseScale, Math.min(lastNoiseScale, maxNoiseScale));
  const stepsUp = Math.floor((maxNoiseScale - last) / noiseStep);
  const stepsDown = Math.floor((last - minNoiseScale) / noiseStep);
  if (stepsUp === 0 && stepsDown === 0) return last;
  const direction = Math.random() < 0.5 && stepsDown > 0 ? -1 : 1;
  const steps = direction === 1
    ? Math.floor(Math.random() * (stepsUp + 1))
    : Math.floor(Math.random() * (stepsDown + 1));
  let newValue = last + direction * steps * noiseStep;
  return Math.max(minNoiseScale, Math.min(newValue, maxNoiseScale));
}

export function reinitializeParticlesForSphere(THREE, sphere, sphereParams, sphereGeometry) {
  const newPositions = new Float32Array(sphereParams.particleCount * 3);
  const newColors = new Float32Array(sphereParams.particleCount * 3);
  const newVelocities = new Float32Array(sphereParams.particleCount * 3);
  const newBasePositions = new Float32Array(sphereParams.particleCount * 3);
  const newLifetimes = new Float32Array(sphereParams.particleCount);
  const newMaxLifetimes = new Float32Array(sphereParams.particleCount);
  const newBeatEffects = new Float32Array(sphereParams.particleCount);
  for (let i = 0; i < sphereParams.particleCount; i++) {
    const i3 = i * 3;
    sampleShapeLocalPosition(sphereParams, _tmpSpawn);
    const x = _tmpSpawn.x;
    const y = _tmpSpawn.y;
    const z = _tmpSpawn.z;
    newPositions[i3] = x;
    newPositions[i3 + 1] = y;
    newPositions[i3 + 2] = z;
    newBasePositions[i3] = x;
    newBasePositions[i3 + 1] = y;
    newBasePositions[i3 + 2] = z;
    newVelocities[i3] = 0;
    newVelocities[i3 + 1] = 0;
    newVelocities[i3 + 2] = 0;
    const lt = Math.random() * sphereParams.particleLifetime;
    newLifetimes[i] = lt;
    newMaxLifetimes[i] = lt;
    newBeatEffects[i] = 0;
  }
  sphereGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  sphereGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
  updateColorsForSphere(THREE, sphereParams, sphereGeometry, newColors);
  return {
    newPositions, newColors, newVelocities, newBasePositions,
    newLifetimes, newMaxLifetimes, newBeatEffects
  };
}

export function updateColorsForSphere(THREE, sphereParams, sphereGeometry, sphereColors) {
  const color1 = new THREE.Color(sphereParams.colorStart);
  const color2 = new THREE.Color(sphereParams.colorEnd);
  for (let i = 0; i < sphereParams.particleCount; i++) {
    const t = i / sphereParams.particleCount;
    sphereColors[i * 3] = color1.r * (1 - t) + color2.r * t;
    sphereColors[i * 3 + 1] = color1.g * (1 - t) + color2.g * t;
    sphereColors[i * 3 + 2] = color1.b * (1 - t) + color2.b * t;
  }
  sphereGeometry.attributes.color.needsUpdate = true;
}

export function tickSpheres(ctx) {
  const {
    THREE, noise, beatManager, spheres, getAudioData, fillFrequencyBufferFromNXS,
    getSmoothVolumeNXS, currentTime, deltaTime
  } = ctx;
  const frequencies = fillFrequencyBufferFromNXS();
  beatManager.update(deltaTime);

  spheres.forEach((sphere) => {
    if (!sphere.params.enabled) return;
    const audioData = getAudioData(sphere, frequencies);
    if (audioData.peakDetected && sphere.params.dynamicNoiseScale) {
      sphere.params.noiseScale = generateNewNoiseScale(sphere.params, sphere.lastNoiseScale);
      sphere.lastNoiseScale = sphere.params.noiseScale;
    }
    const { params, geometry, positions, velocities, basePositions, lifetimes, maxLifetimes, beatEffects } = sphere;
    const beatDetected = audioData.rangeEnergyBeat > params.beatThreshold;
    if (beatDetected && !beatManager.isWaveActive && params.beatStrength > 0) {
      beatManager.triggerWave(audioData.rangeEnergyBeat);
    }
    const noiseTime = getNoiseTimeFactor(currentTime, params);
    const pc = params.particleCount;
    for (let i = 0; i < pc; i++) {
      const i3 = i * 3;
      let x = positions[i3];
      let y = positions[i3 + 1];
      let z = positions[i3 + 2];
      let vx = velocities[i3];
      let vy = velocities[i3 + 1];
      let vz = velocities[i3 + 2];
      let lt = lifetimes[i];
      let be = beatEffects[i];
      lt -= deltaTime;
      const ns = params.noiseScale;
      const timeFactor = noiseTime;
      const noiseX = noise.noise3D(x * ns + timeFactor, y * ns, z * ns);
      const noiseY = noise.noise3D(x * ns, y * ns + timeFactor, z * ns);
      const noiseZ = noise.noise3D(x * ns, y * ns, z * ns + timeFactor);
      vx += noiseX * params.turbulenceStrength;
      vy += noiseY * params.turbulenceStrength;
      vz += noiseZ * params.turbulenceStrength;
      if (beatDetected) be = 1.0;
      be *= 0.95;
      if (be > 0.01) {
        const dist = Math.sqrt(x * x + y * y + z * z);
        if (dist > 0) {
          const dx = x / dist;
          const dy = y / dist;
          const dz = z / dist;
          const beatForce = be * params.beatStrength;
          vx += dx * beatForce;
          vy += dy * beatForce;
          vz += dz * beatForce;
        }
      }
      x += vx;
      y += vy;
      z += vz;
      vx *= 0.98;
      vy *= 0.98;
      vz *= 0.98;
      const b = applyShapeBoundary(params, x, y, z, vx, vy, vz);
      x = b.x;
      y = b.y;
      z = b.z;
      vx = b.vx;
      vy = b.vy;
      vz = b.vz;
      if (lt <= 0) {
        respawnShapeLocalPosition(params, _tmpSpawn);
        x = _tmpSpawn.x;
        y = _tmpSpawn.y;
        z = _tmpSpawn.z;
        vx = vy = vz = 0;
        const newLt = Math.random() * params.particleLifetime;
        lt = newLt;
        maxLifetimes[i] = newLt;
        be = 0;
        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;
      }
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      velocities[i3] = vx;
      velocities[i3 + 1] = vy;
      velocities[i3 + 2] = vz;
      lifetimes[i] = lt;
      beatEffects[i] = be;
    }
    geometry.attributes.position.needsUpdate = true;
    const { volume: smoothVolume, shouldUpdate } = getSmoothVolumeNXS(
      params, sphere.lastValidVolume, params.volumeChangeThreshold
    );
    if (shouldUpdate) {
      const targetRotationSpeed = THREE.MathUtils.lerp(
        params.rotationSpeedMin,
        params.rotationSpeedMax,
        smoothVolume
      );
      sphere.lastRotationSpeed = params.rotationSpeed +
        (targetRotationSpeed - params.rotationSpeed) * params.rotationSmoothness;
    }
    sphere.particleSystem.rotation.y += sphere.lastRotationSpeed;
    if (shouldUpdate) sphere.lastValidVolume = smoothVolume;
  });
}
