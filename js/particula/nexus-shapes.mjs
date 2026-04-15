/**
 * Shape sampling + soft boundaries for Particula swarms (local space, origin at swarm center).
 */

const SHAPES = ['sphere', 'ring', 'ellipsoid', 'torus'];

function cbrt01() {
  return Math.cbrt(Math.random());
}

/**
 * @param {object} params — sphere params + shape* fields
 * @param {{ x: number, y: number, z: number }} out
 */
export function sampleShapeLocalPosition(params, out) {
  const R = typeof params.sphereRadius === 'number' ? params.sphereRadius : 1;
  const inner = typeof params.innerSphereRadius === 'number' ? params.innerSphereRadius : 0.25;
  const shape = params.shape && SHAPES.includes(params.shape) ? params.shape : 'sphere';

  const ex = typeof params.ellipsoidEx === 'number' ? params.ellipsoidEx : 1;
  const ey = typeof params.ellipsoidEy === 'number' ? params.ellipsoidEy : 0.65;
  const ez = typeof params.ellipsoidEz === 'number' ? params.ellipsoidEz : 0.5;
  const torusMajor = typeof params.torusMajorRatio === 'number' ? params.torusMajorRatio : 0.72;
  const torusTube = typeof params.torusTubeRatio === 'number' ? params.torusTubeRatio : 0.22;
  const ringThickness = typeof params.ringThickness === 'number' ? params.ringThickness : 0.04;

  if (shape === 'ellipsoid') {
    const phi = Math.acos(2 * Math.random() - 1);
    const th = Math.random() * Math.PI * 2;
    const rad = cbrt01() * R * Math.max(0.08, inner);
    const sx = rad * Math.sin(phi) * Math.cos(th) * ex;
    const sy = rad * Math.sin(phi) * Math.sin(th) * ey;
    const sz = rad * Math.cos(phi) * ez;
    out.x = sx;
    out.y = sy;
    out.z = sz;
    return;
  }

  if (shape === 'torus') {
    const R0 = R * torusMajor;
    const r0 = Math.max(0.02 * R, R * torusTube);
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    out.x = (R0 + r0 * Math.cos(v)) * Math.cos(u);
    out.y = r0 * Math.sin(v);
    out.z = (R0 + r0 * Math.cos(v)) * Math.sin(u);
    return;
  }

  if (shape === 'ring') {
    const th = Math.random() * Math.PI * 2;
    const rad = (inner * R) + cbrt01() * (1 - inner) * R;
    out.x = Math.cos(th) * rad;
    out.z = Math.sin(th) * rad;
    out.y = (Math.random() - 0.5) * 2 * ringThickness * R;
    return;
  }

  /* sphere */
  const radius = R * Math.max(0.02, inner) * cbrt01();
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  out.x = radius * Math.sin(phi) * Math.cos(theta);
  out.y = radius * Math.sin(phi) * Math.sin(theta);
  out.z = radius * Math.cos(phi);
}

/**
 * Soft pullback when outside shape (local coordinates).
 */
export function applyShapeBoundary(params, x, y, z, vx, vy, vz) {
  const R = typeof params.sphereRadius === 'number' ? params.sphereRadius : 1;
  const inner = typeof params.innerSphereRadius === 'number' ? params.innerSphereRadius : 0.25;
  const shape = params.shape && SHAPES.includes(params.shape) ? params.shape : 'sphere';

  const ex = (typeof params.ellipsoidEx === 'number' ? params.ellipsoidEx : 1) * R;
  const ey = (typeof params.ellipsoidEy === 'number' ? params.ellipsoidEy : 0.65) * R;
  const ez = (typeof params.ellipsoidEz === 'number' ? params.ellipsoidEz : 0.5) * R;
  const torusMajor = typeof params.torusMajorRatio === 'number' ? params.torusMajorRatio : 0.72;
  const torusTube = typeof params.torusTubeRatio === 'number' ? params.torusTubeRatio : 0.22;
  const ringThickness = typeof params.ringThickness === 'number' ? params.ringThickness : 0.04;

  if (shape === 'ellipsoid') {
    const nx = x / Math.max(1e-5, ex);
    const ny = y / Math.max(1e-5, ey);
    const nz = z / Math.max(1e-5, ez);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1) {
      const s = 1 / len;
      const ox = x - nx * s * ex;
      const oy = y - ny * s * ey;
      const oz = z - nz * s * ez;
      x -= ox * 0.12;
      y -= oy * 0.12;
      z -= oz * 0.12;
      vx *= 0.9;
      vy *= 0.9;
      vz *= 0.9;
    }
    return { x, y, z, vx, vy, vz };
  }

  if (shape === 'torus') {
    const R0 = R * torusMajor;
    const r0 = Math.max(0.02 * R, R * torusTube);
    const u = Math.atan2(z, x);
    const cx = Math.cos(u) * R0;
    const cz = Math.sin(u) * R0;
    const dx = x - cx;
    const dy = y;
    const dz = z - cz;
    const rad = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (rad > r0 && rad > 1e-6) {
      const s = (rad - r0) / rad * 0.14;
      x -= dx * s;
      y -= dy * s;
      z -= dz * s;
      vx *= 0.9;
      vy *= 0.9;
      vz *= 0.9;
    }
    return { x, y, z, vx, vy, vz };
  }

  if (shape === 'ring') {
    const q = Math.sqrt(x * x + z * z);
    const rMin = inner * R;
    const rMax = R;
    const yy = Math.abs(y);
    if (q > rMax) {
      const s = (q - rMax) / Math.max(q, 1e-6) * 0.12;
      x *= 1 - s;
      z *= 1 - s;
      vx *= 0.9;
      vz *= 0.9;
    } else if (q < rMin && q > 1e-5) {
      const s = (rMin - q) / rMin * 0.1;
      x *= 1 + s;
      z *= 1 + s;
      vx *= 0.9;
      vz *= 0.9;
    }
    if (yy > ringThickness * R) {
      const s = (yy - ringThickness * R) / Math.max(yy, 1e-6) * 0.12;
      y -= Math.sign(y) * s * R;
      vy *= 0.9;
    }
    return { x, y, z, vx, vy, vz };
  }

  /* sphere */
  const dist = Math.sqrt(x * x + y * y + z * z);
  if (dist > R) {
    const overflow = dist - R;
    const pullback = overflow * 0.1;
    if (dist > 0) {
      const dx = x / dist;
      const dy = y / dist;
      const dz = z / dist;
      x -= dx * pullback;
      y -= dy * pullback;
      z -= dz * pullback;
    }
    vx *= 0.9;
    vy *= 0.9;
    vz *= 0.9;
  }
  return { x, y, z, vx, vy, vz };
}

export function respawnShapeLocalPosition(params, out) {
  sampleShapeLocalPosition(params, out);
}

export { SHAPES };
