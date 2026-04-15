/**
 * Particula port — Perlin noise + beat wave manager (from Humprt/particula MIT).
 * NEXUS embed only; do not use the name "Particula" for product branding per upstream README.
 */

export const noise = {
  p: new Array(256).fill(0).map((_, i) => i),
  perm: new Array(512),
  init() {
    for (let i = this.p.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  },
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
  lerp(t, a, b) { return a + t * (b - a); },
  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  },
  noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);
    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;
    return this.lerp(w,
      this.lerp(v,
        this.lerp(u, this.grad(this.perm[AA], x, y, z), this.grad(this.perm[BA], x - 1, y, z)),
        this.lerp(u, this.grad(this.perm[AB], x, y - 1, z), this.grad(this.perm[BB], x - 1, y - 1, z))),
      this.lerp(v,
        this.lerp(u, this.grad(this.perm[AA + 1], x, y, z - 1), this.grad(this.perm[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.perm[AB + 1], x, y - 1, z - 1), this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1))));
  }
};
noise.init();

export const beatManager = {
  currentWaveRadius: 0,
  waveStrength: 0,
  isWaveActive: false,
  triggerWave(rangeEnergy) {
    const maxEnergy = 255;
    const energyExcess = rangeEnergy - 200;
    this.waveStrength = (energyExcess / (maxEnergy - 200)) * 20.0;
    this.currentWaveRadius = 0;
    this.isWaveActive = true;
  },
  update(deltaTime) {
    if (!this.isWaveActive) return;
    this.currentWaveRadius += deltaTime * 1.0;
    this.waveStrength *= 0.98;
    if (this.currentWaveRadius > 1.0 || this.waveStrength < 0.1) this.isWaveActive = false;
  },
  getWaveForce(position) {
    if (!this.isWaveActive) return 0;
    const distanceFromCenter = position.length();
    const distanceFromWave = Math.abs(distanceFromCenter - this.currentWaveRadius);
    if (distanceFromWave < 0.1) return this.waveStrength * Math.exp(-distanceFromWave * 10);
    return 0;
  }
};
