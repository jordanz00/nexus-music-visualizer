/**
 * Maps NEXUS analyzer state (NX.S) into Particula-style frequency buffers + peaks.
 */

const FFT_BINS = 512;
const freqBuffer = new Uint8Array(FFT_BINS);

const F_MIN = 20;
const F_MAX = 20000;

function clamp255(x) {
  if (x < 0) return 0;
  if (x > 255) return 255;
  return x | 0;
}

/** Map linear bin index → Hz on a log scale (more resolution in bass). */
export function binIndexToHz(i, binCount = FFT_BINS) {
  const lo = Math.log(F_MIN);
  const hi = Math.log(F_MAX);
  const t = (i + 0.5) / Math.max(1, binCount);
  return Math.exp(lo + t * (hi - lo));
}

/** Map Hz → bin index (log spectrum; lows span more bins). */
export function hzToLogBin(hz, binCount = FFT_BINS) {
  const lo = Math.log(F_MIN);
  const hi = Math.log(F_MAX);
  const h = Math.max(F_MIN, Math.min(F_MAX, hz));
  const t = (Math.log(h) - lo) / (hi - lo);
  return Math.max(0, Math.min(binCount - 1, Math.round(t * (binCount - 1))));
}

/**
 * Fill a byte-frequency array from NX.S bands (no second AudioContext).
 * Bins are spaced logarithmically in Hz so low frequencies get more spectral weight.
 */
export function fillFrequencyBufferFromNXS() {
  const S = typeof window !== 'undefined' && window.NX && window.NX.S ? window.NX.S : {};
  const bass = typeof S.sBass === 'number' ? S.sBass : 0;
  const mid = typeof S.sMid === 'number' ? S.sMid : 0;
  const high = typeof S.sHigh === 'number' ? S.sHigh : 0;
  const flux = typeof S.sFlux === 'number' ? S.sFlux : 0;
  const cent = typeof S.sCent === 'number' ? S.sCent : 0.35;
  const beat = typeof S.beatVisual === 'number' ? S.beatVisual : (typeof S.beat === 'number' ? Math.min(1, S.beat * 0.55) : 0);
  const vol = typeof S.sVol === 'number' ? S.sVol : 0;

  for (let i = 0; i < FFT_BINS; i++) {
    const hz = binIndexToHz(i, FFT_BINS);
    const linT = (Math.log(hz) - Math.log(F_MIN)) / (Math.log(F_MAX) - Math.log(F_MIN));
    const lowShape = Math.exp(-linT * 14) * (0.62 + bass * 1.35);
    const midShape = Math.exp(-Math.pow((linT - 0.28) / 0.2, 2)) * (0.48 + mid * 1.12);
    const highShape = Math.exp(-Math.pow((linT - 0.78) / 0.2, 2)) * (0.36 + high * 1.22);
    const lowBoost = 1 + 0.55 * (1 - linT);
    const comb = (lowShape * 118 + midShape * 132 + highShape * 124) * lowBoost;
    const pulse = 1 + beat * 0.85 + flux * 0.4;
    const tilt = 0.85 + cent * 0.35 * (0.25 + linT);
    const v = comb * pulse * tilt + vol * 22;
    freqBuffer[i] = clamp255(v);
  }
  return freqBuffer;
}

/**
 * Noise time factor: base scroll + optional sync to NX.S beatPhase / BPM (slows at high BPM when enabled).
 */
export function getNoiseTimeFactor(currentTimeMs, params) {
  const S = typeof window !== 'undefined' && window.NX && window.NX.S ? window.NX.S : {};
  const speed = typeof params.noiseSpeed === 'number' ? params.noiseSpeed : 0.1;
  let t = currentTimeMs * 0.001 * speed;
  const sync = typeof params.noiseTempoSync === 'number' ? params.noiseTempoSync : 0.45;
  const bp = typeof S.beatPhase === 'number' ? S.beatPhase : 0;
  const bc = typeof S.bpmConfidence === 'number' ? S.bpmConfidence : 0;
  const bpm = typeof S.bpm === 'number' ? S.bpm : 120;
  t += sync * (0.2 + bc * 0.8) * bp * 1.15;
  const slowMix = typeof params.noiseBpmSlow === 'number' ? params.noiseBpmSlow : 0.35;
  const tempoScale = Math.min(1.4, Math.max(0.5, 118 / Math.max(60, bpm)));
  t *= 1 - slowMix + slowMix * tempoScale;
  return t;
}

/**
 * Particula-compatible audio payload (uses shared buffer; copy if mutating).
 */
export function getAudioData(sphere, frequencies) {
  const binCount = frequencies.length;
  const gain = typeof sphere.params.gainMultiplier === 'number' ? sphere.params.gainMultiplier : 1;
  const scaled = new Uint8Array(binCount);
  for (let i = 0; i < binCount; i++) {
    scaled[i] = clamp255(frequencies[i] * gain);
  }
  const frequencyToIndex = (frequency) => hzToLogBin(frequency, binCount);

  const minFreqIndex = Math.max(0, Math.min(binCount - 1, frequencyToIndex(sphere.params.minFrequency)));
  const maxFreqIndex = Math.max(0, Math.min(binCount - 1, frequencyToIndex(sphere.params.maxFrequency)));
  const frequencyRange = scaled.subarray(minFreqIndex, maxFreqIndex + 1);
  let sum = 0;
  for (let i = 0; i < frequencyRange.length; i++) sum += frequencyRange[i];
  const rangeEnergy = frequencyRange.length ? sum / frequencyRange.length : 0;

  const minFreqBeatIndex = Math.max(0, Math.min(binCount - 1, frequencyToIndex(sphere.params.minFrequencyBeat)));
  const maxFreqBeatIndex = Math.max(0, Math.min(binCount - 1, frequencyToIndex(sphere.params.maxFrequencyBeat)));
  const frequencyRangeBeat = scaled.subarray(minFreqBeatIndex, maxFreqBeatIndex + 1);
  let sumB = 0;
  for (let i = 0; i < frequencyRangeBeat.length; i++) sumB += frequencyRangeBeat[i];
  const rangeEnergyBeat = frequencyRangeBeat.length ? sumB / frequencyRangeBeat.length : 0;

  if (!sphere.peakDetection.energyHistory) {
    sphere.peakDetection.energyHistory = [];
    sphere.peakDetection.historyLength = 30;
    sphere.peakDetection.lastPeakTime = 0;
    sphere.peakDetection.minTimeBetweenPeaks = 200;
  }
  sphere.peakDetection.energyHistory.push(rangeEnergy);
  if (sphere.peakDetection.energyHistory.length > sphere.peakDetection.historyLength) {
    sphere.peakDetection.energyHistory.shift();
  }
  const averageEnergy = sphere.peakDetection.energyHistory.reduce((a, b) => a + b, 0) /
    sphere.peakDetection.energyHistory.length;
  const now = performance.now();
  const peakDetected = rangeEnergy > averageEnergy * sphere.params.peakSensitivity &&
    now - sphere.peakDetection.lastPeakTime > sphere.peakDetection.minTimeBetweenPeaks;
  if (peakDetected) sphere.peakDetection.lastPeakTime = now;

  return {
    average: rangeEnergy / 255,
    frequencies: scaled,
    peakDetected,
    rangeEnergy,
    rangeEnergyBeat
  };
}

export function getSmoothVolumeNXS(params, lastValidVolume, volumeChangeThreshold) {
  const S = typeof window !== 'undefined' && window.NX && window.NX.S ? window.NX.S : {};
  const bass = typeof S.sBass === 'number' ? S.sBass : 0;
  const mid = typeof S.sMid === 'number' ? S.sMid : 0;
  const high = typeof S.sHigh === 'number' ? S.sHigh : 0;
  const vol = typeof S.sVol === 'number' ? S.sVol : 0;
  const normalizedVolume = Math.min(1, bass * 0.38 + mid * 0.32 + high * 0.22 + vol * 0.25);

  let shouldUpdate = true;
  let lv = lastValidVolume;
  if (lv === 0) {
    lv = normalizedVolume;
  } else {
    const change = Math.abs(normalizedVolume - lv);
    if (change <= volumeChangeThreshold) lv = normalizedVolume;
    else shouldUpdate = false;
  }
  return { volume: lv, shouldUpdate };
}

export { FFT_BINS };
