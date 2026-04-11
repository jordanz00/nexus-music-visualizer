'use strict';
/**
 * nexus-maze-three.js — Procedural grid maze on #c-three (Chris Raff–style interaction homage; original code).
 *
 * WHO THIS IS FOR: MAZE-* scenes; loads vendor/three.min.js on first use.
 * WHAT IT DOES: Recursive-backtracker maze, WASD move, mouse-look yaw, exit win + regen (key N).
 * HOW IT CONNECTS: engine calls applyForScene / tick; pointer lock only after explicit tap on #c-three.
 */
(function () {
  var NX = window.NX || (window.NX = {});

  var active = false;
  var renderer = null;
  var scene = null;
  var camera = null;
  var rafId = 0;
  var maze = [];
  var mw = 11;
  var mh = 11;
  var px = 1.5;
  var pz = 1.5;
  var yaw = 0;
  var keys = {};
  var exitCell = { x: 0, z: 0 };
  var won = false;
  var pointerLocked = false;
  var reduceMotion = false;
  var galleryMode = false;
  var orbitAngle = 0;
  var canvasClickHandler = null;

  function wantsMaze(name) {
    return name && String(name).toUpperCase().indexOf('MAZE') === 0;
  }

  function isGalleryName(name) {
    return name && String(name).toUpperCase().indexOf('GALLERY') >= 0;
  }

  function walkableAt(x, z) {
    var ix = Math.floor(x + 1e-6);
    var iz = Math.floor(z + 1e-6);
    if (ix < 0 || ix >= mw || iz < 0 || iz >= mh) return false;
    return maze[iz][ix] === 0;
  }

  function genMaze(oddW, oddH) {
    oddW = Math.max(5, Math.min(21, oddW | 0));
    oddH = Math.max(5, Math.min(21, oddH | 0));
    if (oddW % 2 === 0) oddW++;
    if (oddH % 2 === 0) oddH++;
    mw = oddW;
    mh = oddH;
    maze = [];
    var x;
    var y;
    for (y = 0; y < mh; y++) {
      maze[y] = [];
      for (x = 0; x < mw; x++) maze[y][x] = 1;
    }
    var stack = [];
    var sx = 1;
    var sy = 1;
    maze[sy][sx] = 0;
    stack.push({ x: sx, y: sy });
    var dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      var cur = stack[stack.length - 1];
      var shuf = dirs.slice().sort(function () { return Math.random() - 0.5; });
      var moved = false;
      for (var d = 0; d < 4; d++) {
        var nx = cur.x + shuf[d][0];
        var ny = cur.y + shuf[d][1];
        if (nx > 0 && nx < mw - 1 && ny > 0 && ny < mh - 1 && maze[ny][nx] === 1) {
          maze[ny][nx] = 0;
          maze[cur.y + shuf[d][1] / 2][cur.x + shuf[d][0] / 2] = 0;
          stack.push({ x: nx, y: ny });
          moved = true;
          break;
        }
      }
      if (!moved) stack.pop();
    }
    maze[1][1] = 0;
    exitCell.x = mw - 2;
    exitCell.z = mh - 2;
    maze[exitCell.z][exitCell.x] = 0;
    px = 1.5;
    pz = 1.5;
    yaw = 0;
    won = false;
  }

  function buildMeshes(THREE) {
    while (scene.children.length) scene.remove(scene.children[0]);
    var mat = new THREE.MeshStandardMaterial({ color: 0x3a4a6a, metalness: 0.2, roughness: 0.85 });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mw / 2 - 0.5, 0, mh / 2 - 0.5);
    scene.add(floor);
    var bx;
    var bz;
    for (bz = 0; bz < mh; bz++) {
      for (bx = 0; bx < mw; bx++) {
        if (maze[bz][bx] === 1) {
          var box = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 1), mat);
          box.position.set(bx, 0.6, bz);
          scene.add(box);
        }
      }
    }
    var ex = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x003322 }));
    ex.position.set(exitCell.x, 0.7, exitCell.z);
    ex.name = 'nxExit';
    scene.add(ex);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    var pl = new THREE.PointLight(0xaaccff, 0.9, 18);
    pl.position.set(mw / 2, 4, mh / 2);
    scene.add(pl);
  }

  function syncSize() {
    var main = document.getElementById('c');
    var t = document.getElementById('c-three');
    if (!main || !t || !renderer) return;
    t.width = main.width;
    t.height = main.height;
    renderer.setSize(t.width, t.height, false);
    if (camera) {
      camera.aspect = t.width / Math.max(1, t.height);
      camera.updateProjectionMatrix();
    }
  }

  function step(dt) {
    if (!active || !camera) return;
    if (galleryMode) {
      orbitAngle += dt * 0.22 * (reduceMotion ? 0.45 : 1);
      var cx = mw * 0.5 - 0.5;
      var cz = mh * 0.5 - 0.5;
      var rad = Math.max(mw, mh) * 0.65 + 2;
      camera.position.set(cx + Math.cos(orbitAngle) * rad, 2.8, cz + Math.sin(orbitAngle) * rad);
      camera.lookAt(cx, 0.4, cz);
      return;
    }
    var sp = (keys.shift ? 2.8 : 1.55) * dt;
    if (reduceMotion) sp *= 0.55;
    var fwdX = -Math.sin(yaw);
    var fwdZ = -Math.cos(yaw);
    var rgtX = Math.cos(yaw);
    var rgtZ = -Math.sin(yaw);
    var mx = 0;
    var mz = 0;
    if (keys.w) { mx -= fwdX; mz -= fwdZ; }
    if (keys.s) { mx += fwdX; mz += fwdZ; }
    if (keys.a) { mx -= rgtX; mz -= rgtZ; }
    if (keys.d) { mx += rgtX; mz += rgtZ; }
    var len = Math.hypot(mx, mz);
    if (len > 1e-6) {
      mx /= len;
      mz /= len;
    }
    var nxp = px + mx * sp;
    if (walkableAt(nxp, pz)) px = nxp;
    var nzp = pz + mz * sp;
    if (walkableAt(px, nzp)) pz = nzp;
    camera.position.set(px, 0.55, pz);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = 0;
    if (Math.floor(px + 0.2) === exitCell.x && Math.floor(pz + 0.2) === exitCell.z) won = true;
  }

  function loop() {
    if (!active) return;
    rafId = requestAnimationFrame(loop);
    var dt = 1 / 60;
    step(dt);
    syncSize();
    renderer.render(scene, camera);
  }

  function onKeyDown(e) {
    if (!active) return;
    var k = e.key && e.key.toLowerCase();
    if (k === 'w') keys.w = true;
    if (k === 's') keys.s = true;
    if (k === 'a') keys.a = true;
    if (k === 'd') keys.d = true;
    if (e.key === 'Shift') keys.shift = true;
    if (k === 'n') {
      genMaze(mw, mh);
      buildMeshes(window.THREE);
    }
    if (e.key === 'Escape') stop();
  }

  function onKeyUp(e) {
    var k = e.key && e.key.toLowerCase();
    if (k === 'w') keys.w = false;
    if (k === 's') keys.s = false;
    if (k === 'a') keys.a = false;
    if (k === 'd') keys.d = false;
    if (e.key === 'Shift') keys.shift = false;
  }

  function onMouseMove(e) {
    if (!active || !pointerLocked || reduceMotion) return;
    yaw -= e.movementX * 0.0022;
  }

  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === document.getElementById('c-three');
  }

  function startThree() {
    var THREE = window.THREE;
    var t = document.getElementById('c-three');
    if (!THREE || !t) return false;
    stop();
    active = true;
    reduceMotion = false;
    try {
      reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (eR) { /* ignore */ }
    renderer = new THREE.WebGLRenderer({ canvas: t, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, 1, 0.08, 80);
    genMaze(11, 11);
    buildMeshes(THREE);
    t.style.opacity = '1';
    t.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    if (!galleryMode && !reduceMotion) {
      if (t._nxMazePtrBound && canvasClickHandler) {
        t.removeEventListener('click', canvasClickHandler, false);
        t._nxMazePtrBound = false;
      }
      canvasClickHandler = function () {
        if (galleryMode || reduceMotion) return;
        try {
          if (t.requestPointerLock) t.requestPointerLock();
        } catch (eL) { /* ignore */ }
      };
      t.addEventListener('click', canvasClickHandler, false);
      t._nxMazePtrBound = true;
    }
    loop();
    return true;
  }

  function stop() {
    active = false;
    galleryMode = false;
    orbitAngle = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    document.removeEventListener('keydown', onKeyDown, false);
    document.removeEventListener('keyup', onKeyUp, false);
    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('pointerlockchange', onPointerLockChange, false);
    try {
      if (document.exitPointerLock) document.exitPointerLock();
    } catch (eP) { /* ignore */ }
    var t = document.getElementById('c-three');
    if (t) {
      if (canvasClickHandler && t._nxMazePtrBound) {
        t.removeEventListener('click', canvasClickHandler, false);
        t._nxMazePtrBound = false;
      }
      canvasClickHandler = null;
      t.style.opacity = '0';
      t.setAttribute('aria-hidden', 'true');
    }
    if (renderer) {
      try { renderer.dispose(); } catch (eD) { /* ignore */ }
    }
    renderer = null;
    scene = null;
    camera = null;
  }

  function ensureVendor(cb) {
    if (window.THREE) {
      cb(true);
      return;
    }
    if (document.getElementById('nx-vendor-three-maze')) {
      var tries = 0;
      var id = setInterval(function () {
        tries++;
        if (window.THREE) {
          clearInterval(id);
          cb(true);
        } else if (tries > 80) {
          clearInterval(id);
          cb(false);
        }
      }, 50);
      return;
    }
    var st = document.createElement('script');
    st.id = 'nx-vendor-three-maze';
    st.src = 'vendor/three.min.js';
    st.async = true;
    st.onload = function () { cb(!!window.THREE); };
    st.onerror = function () { cb(false); };
    document.head.appendChild(st);
  }

  /**
   * @param {number} sceneIdx
   */
  function applyForScene(sceneIdx) {
    var name = NX.HomageBridge && NX.HomageBridge.sceneNameAt ? NX.HomageBridge.sceneNameAt(sceneIdx) : '';
    galleryMode = isGalleryName(name);
    if (!wantsMaze(name)) {
      stop();
      return;
    }
    var S = NX.S;
    if (S && S._iosCoarsePointer) {
      stop();
      return;
    }
    ensureVendor(function (ok) {
      if (!ok) return;
      startThree();
    });
  }

  function tick() {
    /* stepped in loop */
  }

  function getHudCompassDeg() {
    if (!active) return null;
    var dx = exitCell.x - px;
    var dz = exitCell.z - pz;
    var ang = Math.atan2(dx, dz) * (180 / Math.PI);
    var rel = ang - yaw * (180 / Math.PI);
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;
    return rel;
  }

  function isWon() {
    return !!won;
  }

  NX.MazeThree = {
    applyForScene: applyForScene,
    tick: tick,
    stop: stop,
    getHudCompassDeg: getHudCompassDeg,
    isWon: isWon,
    isActive: function () { return active; }
  };
})();
