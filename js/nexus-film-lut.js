'use strict';
/**
 * nexus-film-lut.js — Parse Adobe .cube, build 2D strip GPU texture, bind for post OUTPUT pass.
 * Layout: texel (r + g*N, b) stores output RGB for lattice input (r,g,b), N = LUT_3D_SIZE.
 */
(function () {
  var _tex = null;
  var _dim = 0;
  var _black = null;

  function ensureBlack(gl) {
    if (_black) return _black;
    _black = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, _black);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return _black;
  }

  /**
   * @param {string} text — .cube file contents
   * @returns {{dim:number, rgb:Uint8Array}|null}
   */
  function parseCube(text) {
    if (!text || typeof text !== 'string') return null;
    var lines = text.split(/\r?\n/);
    var dim = 0;
    var data = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln || ln.charAt(0) === '#') continue;
      if (/^TITLE\s+/i.test(ln)) continue;
      var m = /^LUT_3D_SIZE\s+(\d+)/i.exec(ln);
      if (m) {
        dim = parseInt(m[1], 10) | 0;
        continue;
      }
      if (/^DOMAIN_MIN|^DOMAIN_MAX/i.test(ln)) continue;
      var parts = ln.split(/\s+/);
      if (parts.length >= 3) {
        var r = parseFloat(parts[0]);
        var g = parseFloat(parts[1]);
        var b = parseFloat(parts[2]);
        if (isFinite(r) && isFinite(g) && isFinite(b)) {
          data.push(r, g, b);
        }
      }
    }
    var n = dim * dim * dim;
    if (dim < 2 || dim > 128 || data.length < n * 3) return null;
    var rgb = new Uint8Array(n * 3);
    var j;
    for (j = 0; j < n; j++) {
      var idx = j * 3;
      rgb[idx] = Math.max(0, Math.min(255, Math.round(data[idx] * 255)));
      rgb[idx + 1] = Math.max(0, Math.min(255, Math.round(data[idx + 1] * 255)));
      rgb[idx + 2] = Math.max(0, Math.min(255, Math.round(data[idx + 2] * 255)));
    }
    return { dim: dim, rgb: rgb };
  }

  /**
   * @param {WebGLRenderingContext} gl
   * @param {number} dim
   * @param {Uint8Array} rgb — length dim^3 * 3, order r fastest then g then b
   * @returns {boolean}
   */
  function uploadRgbLattice(gl, dim, rgb) {
    if (!gl || dim < 2) return false;
    var w = dim * dim;
    var h = dim;
    var rgba = new Uint8Array(w * h * 4);
    var n = dim * dim * dim;
    var j;
    for (j = 0; j < n; j++) {
      var rr = j % dim;
      var gg = ((j / dim) | 0) % dim;
      var bb = (j / (dim * dim)) | 0;
      var lutIdx = j * 3;
      var tx = rr + gg * dim;
      var ty = bb;
      var o = (ty * w + tx) * 4;
      rgba[o] = rgb[lutIdx];
      rgba[o + 1] = rgb[lutIdx + 1];
      rgba[o + 2] = rgb[lutIdx + 2];
      rgba[o + 3] = 255;
    }
    if (!_tex) _tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, _tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    _dim = dim;
    return true;
  }

  function buildIdentity(gl, dim) {
    dim = Math.max(2, Math.min(33, dim | 0));
    var rgb = new Uint8Array(dim * dim * dim * 3);
    var r;
    var g;
    var b;
    for (b = 0; b < dim; b++) {
      for (g = 0; g < dim; g++) {
        for (r = 0; r < dim; r++) {
          var li = ((b * dim + g) * dim + r) * 3;
          rgb[li] = Math.round((r / (dim - 1)) * 255);
          rgb[li + 1] = Math.round((g / (dim - 1)) * 255);
          rgb[li + 2] = Math.round((b / (dim - 1)) * 255);
        }
      }
    }
    return uploadRgbLattice(gl, dim, rgb);
  }

  /**
   * @param {WebGLRenderingContext} gl
   * @param {WebGLProgram} outProg
   * @returns {void}
   */
  function bindForOutputPass(gl, outProg) {
    if (!gl || !outProg) return;
    var S = NX.S;
    var mixv = S && typeof S.filmLutMix === 'number' ? S.filmLutMix : 0;
    var dimv = _dim > 0 ? _dim : (S && typeof S.filmLutDim === 'number' ? S.filmLutDim : 0);
    if (S) {
      S.filmLutDim = dimv;
    }
    var u = NX.u;
    var loc = u(outProg, 'LUTT');
    var lm = u(outProg, 'LM');
    if (!loc || !lm) return;
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, (_tex && dimv > 1) ? _tex : ensureBlack(gl));
    gl.uniform1i(loc, 7);
    gl.uniform2f(lm, Math.max(0, Math.min(1, mixv)), dimv > 0 ? dimv : 0);
  }

  /**
   * @param {WebGLRenderingContext} gl
   * @param {string} text
   * @returns {boolean}
   */
  function loadCubeText(gl, text) {
    var p = parseCube(text);
    if (!p || !gl) return false;
    return uploadRgbLattice(gl, p.dim, p.rgb);
  }

  window.NX = window.NX || {};
  NX.FilmLUT = {
    parseCube: parseCube,
    loadCubeText: loadCubeText,
    buildIdentity: buildIdentity,
    bindForOutputPass: bindForOutputPass,
    getDim: function () { return _dim; },
    clear: function (gl) {
      if (gl && _tex) {
        try {
          gl.deleteTexture(_tex);
        } catch (e) { /* ignore */ }
      }
      _tex = null;
      _dim = 0;
      if (NX.S) {
        NX.S.filmLutMix = 0;
        NX.S.filmLutDim = 0;
      }
    }
  };
})();
