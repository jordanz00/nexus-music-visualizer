'use strict';
/**
 * nexus-three-guest.js — Optional second WebGL canvas (Three.js) under the main #c stack.
 * URL `?three=1` or localStorage `nexus.three.guest=1` loads vendor/three.min.js and a tiny audio-reactive mesh.
 *
 * WHO THIS IS FOR: operators / devs experimenting with MIT Three.js alongside the native WebGL1 scenes.
 * BLAST RADIUS: second WebGL context + ~670 KB when the script loads; keep off for low-end / iOS unless testing.
 */
(function () {
  var enabled = false;
  var renderer = null;
  var scene = null;
  var camera = null;
  var mesh = null;
  var rafId = 0;

  function wantsThreeFromEnv() {
    try {
      if (new URLSearchParams(location.search).get('three') === '1') return true;
    } catch (e0) { /* ignore */ }
    try {
      if (NX.Persist.getItem('nexus.three.guest') === '1') return true;
    } catch (e1) { /* ignore */ }
    return false;
  }

  function syncCanvasSize() {
    var main = document.getElementById('c');
    var t = document.getElementById('c-three');
    if (!main || !t || !renderer) return;
    if (t.width !== main.width || t.height !== main.height) {
      t.width = main.width;
      t.height = main.height;
    }
    renderer.setSize(t.width, t.height, false);
    if (camera && camera.aspect) {
      camera.aspect = t.width / Math.max(1, t.height);
      camera.updateProjectionMatrix();
    }
  }

  function tick() {
    if (NX.MazeThree && typeof NX.MazeThree.isActive === 'function' && NX.MazeThree.isActive()) return;
    if (!enabled || !renderer || !scene || !camera) return;
    rafId = requestAnimationFrame(tick);
    var S = window.NX && NX.S;
    var bass = S && typeof S.sBass === 'number' ? S.sBass : 0;
    var mid = S && typeof S.sMid === 'number' ? S.sMid : 0;
    var bv = S && typeof S.beatVisual === 'number' ? S.beatVisual : 0;
    if (mesh) {
      mesh.rotation.x += 0.011 + bass * 0.038;
      mesh.rotation.y += 0.014 + mid * 0.022;
      var s = 1 + bass * 0.35 + bv * 0.12;
      mesh.scale.set(s, s, s);
    }
    syncCanvasSize();
    renderer.render(scene, camera);
  }

  function showLayer(on) {
    var t = document.getElementById('c-three');
    if (!t) return;
    t.style.opacity = on ? '0.42' : '0';
    t.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function stop() {
    enabled = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    showLayer(false);
    if (renderer) {
      try {
        renderer.dispose();
      } catch (eD) { /* ignore */ }
    }
    renderer = null;
    scene = null;
    camera = null;
    mesh = null;
  }

  /**
   * Build Three.js scene after global THREE is available.
   * @returns {boolean}
   */
  function bootstrapFromUrl() {
    if (!wantsThreeFromEnv()) return false;
    var THREE = window.THREE;
    if (!THREE || !THREE.PerspectiveCamera) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS Three guest: THREE missing');
      return false;
    }
    var t = document.getElementById('c-three');
    if (!t) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS Three guest: #c-three missing');
      return false;
    }
    stop();
    enabled = true;
    renderer = new THREE.WebGLRenderer({
      canvas: t,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 2.8;
    var geo = new THREE.IcosahedronGeometry(0.72, 1);
    var mat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x220033,
      emissiveIntensity: 0.35,
      metalness: 0.55,
      roughness: 0.28,
      wireframe: false
    });
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    var amb = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(amb);
    var pl = new THREE.PointLight(0xff66cc, 1.1, 12);
    pl.position.set(1.2, 1.5, 2);
    scene.add(pl);
    showLayer(true);
    tick();
    if (typeof console !== 'undefined' && console.info) {
      console.info('[NEXUS] Three.js guest layer on — second WebGL context; remove ?three=1 or localStorage nexus.three.guest to unload');
    }
    return true;
  }

  window.NX = window.NX || {};
  NX.ThreeGuest = {
    wantsThreeFromEnv: wantsThreeFromEnv,
    bootstrapFromUrl: bootstrapFromUrl,
    stop: stop,
    isEnabled: function () { return enabled; }
  };
})();
