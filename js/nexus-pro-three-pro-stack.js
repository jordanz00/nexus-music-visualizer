'use strict';
/**
 * nexus-pro-three-pro-stack.js — One Three.js context on #c-three: MSDF-style RGB text + optional webcam layer.
 * Call renderFrame() from the main engine loop. Disables simple Three guest when started.
 */
(function () {
  var renderer = null;
  var scene = null;
  var camera = null;
  var msdfMesh = null;
  var videoMesh = null;
  var videoTex = null;
  var stream = null;
  var active = false;

  function loadThree() {
    return new Promise(function (resolve, reject) {
      if (window.THREE && THREE.WebGLRenderer) {
        resolve(window.THREE);
        return;
      }
      var s = document.createElement('script');
      s.src = new URL('vendor/three.min.js', document.baseURI || location.href).href;
      s.onload = function () {
        if (window.THREE) resolve(window.THREE);
        else reject(new Error('THREE missing'));
      };
      s.onerror = function () { reject(new Error('three load')); };
      document.head.appendChild(s);
    });
  }

  function stopGuest() {
    if (NX.ThreeGuest && typeof NX.ThreeGuest.stop === 'function') {
      try {
        NX.ThreeGuest.stop();
      } catch (e) { /* ignore */ }
    }
  }

  function buildMsdfLikeAtlas(text, THREE) {
    var tw = 256;
    var th = 64;
    var cvs = document.createElement('canvas');
    cvs.width = tw;
    cvs.height = th;
    var ctx = cvs.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, tw, th);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text || 'NEXUS').slice(0, 12), 8, th * 0.52);
    var img = ctx.getImageData(0, 0, tw, th);
    var d = img.data;
    var sdf = new Float32Array(tw * th);
    var rad = 8;
    var x;
    var y;
    var dx;
    var dy;
    var xx;
    var yy;
    var o;
    var ins;
    var oth;
    var best;
    var dd;
    var dist;
    for (y = 0; y < th; y++) {
      for (x = 0; x < tw; x++) {
        ins = d[(y * tw + x) * 4] > 128 ? 1 : 0;
        best = rad * rad;
        for (dy = -rad; dy <= rad; dy++) {
          for (dx = -rad; dx <= rad; dx++) {
            xx = x + dx;
            yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= tw || yy >= th) continue;
            oth = d[(yy * tw + xx) * 4] > 128 ? 1 : 0;
            if (oth !== ins) {
              dd = dx * dx + dy * dy;
              if (dd < best) best = dd;
            }
          }
        }
        dist = (ins ? 1 : -1) * Math.sqrt(best);
        sdf[y * tw + x] = dist / rad;
      }
    }
    var rgba = new Uint8Array(tw * th * 4);
    var gx;
    var gy;
    var i;
    for (y = 1; y < th - 1; y++) {
      for (x = 1; x < tw - 1; x++) {
        i = y * tw + x;
        gx = sdf[i + 1] - sdf[i - 1];
        gy = sdf[i + tw] - sdf[i - tw];
        o = i * 4;
        rgba[o] = Math.max(0, Math.min(255, Math.floor((sdf[i] * 0.5 + 0.5) * 255)));
        rgba[o + 1] = Math.max(0, Math.min(255, Math.floor((gx * 0.5 + 0.5) * 255)));
        rgba[o + 2] = Math.max(0, Math.min(255, Math.floor((gy * 0.5 + 0.5) * 255)));
        rgba[o + 3] = 255;
      }
    }
    var tex = new THREE.DataTexture(rgba, tw, th, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function syncSize() {
    var main = document.getElementById('c');
    var t = document.getElementById('c-three');
    if (!main || !t || !renderer) return;
    if (t.width !== main.width || t.height !== main.height) {
      t.width = main.width;
      t.height = main.height;
    }
    renderer.setSize(t.width, t.height, false);
    if (camera && camera.isPerspectiveCamera) {
      camera.aspect = t.width / Math.max(1, t.height);
      camera.updateProjectionMatrix();
    }
  }

  function renderFrame() {
    if (!active || !renderer || !scene || !camera) return;
    syncSize();
    var S = NX.S;
    var bass = S && typeof S.sBass === 'number' ? S.sBass : 0;
    if (msdfMesh && msdfMesh.material && msdfMesh.material.uniforms) {
      msdfMesh.material.uniforms.uTime.value = S && S.GT ? S.GT : 0;
      msdfMesh.material.uniforms.uPulse.value = bass;
    }
    if (videoTex && videoTex.image && videoTex.image.readyState >= 2) {
      videoTex.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  function finishScene(THREE) {
    var amb = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(amb);
    var pl = new THREE.PointLight(0xaaccff, 0.9, 20);
    pl.position.set(1.2, 1.0, 2);
    scene.add(pl);
    var t = document.getElementById('c-three');
    if (t) {
      t.style.opacity = '0.92';
      t.setAttribute('aria-hidden', 'false');
    }
    active = true;
  }

  /**
   * @param {{text?:string,camera?:boolean}} opts
   * @returns {Promise<boolean>}
   */
  function init(opts) {
    opts = opts || {};
    if (active) return Promise.resolve(true);
    return loadThree().then(function (THREE) {
      stopGuest();
      var t = document.getElementById('c-three');
      if (!t) return false;
      renderer = new THREE.WebGLRenderer({ canvas: t, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.05, 50);
      camera.position.set(0, 0, 3.2);

      var atlas = buildMsdfLikeAtlas(opts.text || 'NEXUS', THREE);
      if (atlas) {
        var geo = new THREE.PlaneGeometry(2.6, 0.55, 1, 1);
        var mat = new THREE.ShaderMaterial({
          transparent: true,
          uniforms: {
            mapMsdf: { value: atlas },
            uTime: { value: 0 },
            uPulse: { value: 0 }
          },
          vertexShader: [
            'varying vec2 vUv;',
            'uniform float uPulse;',
            'void main(){',
            ' vUv = uv;',
            ' vec3 p = position;',
            ' p.z += sin(uv.x*6.283+uPulse*4.)*0.04*uPulse;',
            ' gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);',
            '}'
          ].join('\n'),
          fragmentShader: [
            'precision mediump float;',
            'varying vec2 vUv;',
            'uniform sampler2D mapMsdf;',
            'uniform float uTime,uPulse;',
            'float med(vec3 m){return max(min(m.r,m.g),min(max(m.r,m.g),m.b));}',
            'void main(){',
            ' vec3 m = texture2D(mapMsdf,vUv).rgb;',
            ' float sd = med(m) - 0.5;',
            ' float w = fwidth(sd) * 1.25;',
            ' float a = smoothstep(-w, w, sd);',
            ' vec3 col = mix(vec3(0.02,0.08,0.12), vec3(0.35,0.95,1.0), a);',
            ' col += vec3(1.0,0.5,0.2) * uPulse * a * 0.15;',
            ' gl_FragColor = vec4(col, a * 0.92);',
            '}'
          ].join('\n')
        });
        msdfMesh = new THREE.Mesh(geo, mat);
        msdfMesh.position.set(0, 0.35, 0);
        scene.add(msdfMesh);
      }

      if (opts.camera) {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
          .then(function (s) {
            stream = s;
            var vid = document.createElement('video');
            vid.playsInline = true;
            vid.muted = true;
            vid.srcObject = s;
            var p = vid.play();
            if (p && p.catch) p.catch(function () { });
            videoTex = new THREE.VideoTexture(vid);
            videoTex.minFilter = THREE.LinearFilter;
            videoTex.magFilter = THREE.LinearFilter;
            var vmat = new THREE.MeshBasicMaterial({ map: videoTex, transparent: true, opacity: 0.52, depthWrite: false });
            videoMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.92), vmat);
            videoMesh.position.set(0, -0.12, -0.55);
            scene.add(videoMesh);
            finishScene(THREE);
            return true;
          })
          .catch(function () {
            finishScene(THREE);
            return true;
          });
      }
      finishScene(THREE);
      return true;
    });
  }

  function dispose() {
    active = false;
    if (stream && stream.getTracks) stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) { } });
    stream = null;
    if (renderer) {
      try {
        renderer.dispose();
      } catch (e2) { /* ignore */ }
    }
    renderer = null;
    scene = null;
    camera = null;
    msdfMesh = null;
    videoMesh = null;
    videoTex = null;
    var t = document.getElementById('c-three');
    if (t) {
      t.style.opacity = '0';
      t.setAttribute('aria-hidden', 'true');
    }
  }

  window.NX = window.NX || {};
  NX.ProThreeStack = {
    init: init,
    dispose: dispose,
    renderFrame: renderFrame,
    isActive: function () { return active; }
  };
})();
