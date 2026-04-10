'use strict';
/**
 * WebGPU WGSL post chain: multi-pass fullscreen passes over a copy of #c (Radiance-style stack, browser-native).
 * Feature-detects navigator.gpu; Show tab enables chain + node list (localStorage nexus.wgpu.chain).
 */
(function () {
  var device = null;
  var ctxGpu = null;
  var format = null;
  var sampler = null;
  var layout = null;
  var rgbaPipelines = {};
  var blitPipeline = null;
  var shaderModule = null;
  var ubuf = null;
  var texA = null;
  var texB = null;
  var tw = 0;
  var th = 0;
  var ready = false;
  var initTried = false;
  var enabled = false;
  var halfResChain = false;
  /** @type {{type:string,intensity:number}[]} */
  var chain = [{ type: 'warm', intensity: 0.35 }, { type: 'vignette', intensity: 0.4 }];

  var WGSL = `
struct U { intensity: f32, time_s: f32, bass: f32, flux: f32 }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var texIn: texture_2d<f32>;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2f,3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  var uv = array<vec2f,3>(vec2f(0.0,1.0), vec2f(2.0,1.0), vec2f(0.0,-1.0));
  var o: VSOut;
  o.pos = vec4f(p[vi], 0.0, 1.0);
  o.uv = uv[vi];
  return o;
}

@fragment
fn fs_pass(@location(0) uv: vec2f) -> @location(0) vec4f {
  var c = textureSampleLevel(texIn, samp, uv, 0.0);
  let k = clamp(u.intensity, 0.0, 1.0);
  return vec4f(c.rgb * mix(1.0, 1.15, k), c.a);
}

@fragment
fn fs_warm(@location(0) uv: vec2f) -> @location(0) vec4f {
  var c = textureSampleLevel(texIn, samp, uv, 0.0);
  let w = clamp(u.intensity, 0.0, 1.0);
  let r = c.r * (1.0 + w * 0.45);
  let g = c.g * (1.0 + w * 0.12);
  let b = c.b * (1.0 - w * 0.18);
  return vec4f(clamp(vec3f(r,g,b), vec3f(0.0), vec3f(1.2)), c.a);
}

@fragment
fn fs_vig(@location(0) uv: vec2f) -> @location(0) vec4f {
  var c = textureSampleLevel(texIn, samp, uv, 0.0);
  let w = clamp(u.intensity, 0.0, 1.0);
  let d = length(uv - vec2f(0.5, 0.5)) * 1.35;
  let v = 1.0 - d * d * w * 1.1;
  return vec4f(c.rgb * clamp(v, 0.15, 1.0), c.a);
}

@fragment
fn fs_scan(@location(0) uv: vec2f) -> @location(0) vec4f {
  var c = textureSampleLevel(texIn, samp, uv, 0.0);
  let w = clamp(u.intensity, 0.0, 1.0);
  let y = uv.y * 420.0 + u.time_s * 14.0;
  let band = abs(fract(y) - 0.5) * 2.0;
  let s = 1.0 - smoothstep(0.0, 0.08, band) * w * 0.55;
  return vec4f(c.rgb * s, c.a);
}

@fragment
fn fs_chroma(@location(0) uv: vec2f) -> @location(0) vec4f {
  let w = clamp(u.intensity, 0.0, 1.0);
  let off = vec2f(w * 0.004 + u.flux * 0.002, 0.0);
  let r = textureSampleLevel(texIn, samp, uv + off, 0.0).r;
  let g = textureSampleLevel(texIn, samp, uv, 0.0).g;
  let b = textureSampleLevel(texIn, samp, uv - off, 0.0).b;
  return vec4f(r, g, b, 1.0);
}

@fragment
fn fs_poster(@location(0) uv: vec2f) -> @location(0) vec4f {
  var c = textureSampleLevel(texIn, samp, uv, 0.0);
  let w = clamp(u.intensity, 0.0, 1.0);
  let levels = mix(24.0, 5.0, w);
  return vec4f(floor(c.rgb * levels) / levels, c.a);
}

@fragment
fn fs_fract2d(@location(0) uv: vec2f) -> @location(0) vec4f {
  let w = clamp(u.intensity, 0.0, 1.0);
  let p = (uv - vec2f(0.5)) * 3.2 * (1.05 - w * 0.25) + vec2f(-0.52, 0.0);
  var z = vec2f(0.0);
  let c = p + vec2f(sin(u.time_s * 0.18) * 0.04, cos(u.time_s * 0.14) * 0.04);
  var m = 0.0;
  for (var i = 0; i < 28; i++) {
    if (dot(z, z) > 4.0) { break; }
    z = vec2f(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    m = m + 1.0;
  }
  m = m / 28.0;
  let base = textureSampleLevel(texIn, samp, uv, 0.0);
  let fr = vec4f(vec3f(m * m, m * 0.75, 1.0 - m * 0.6) * (0.45 + u.bass * 0.35), 1.0);
  return mix(base, fr, w * 0.62);
}

@fragment
fn fs_smear(@location(0) uv: vec2f) -> @location(0) vec4f {
  let w = clamp(u.intensity, 0.0, 1.0);
  let dir = vec2f(cos(u.time_s * 1.15 + u.flux * 2.0), sin(u.time_s * 1.05)) * w * 0.014;
  var acc = vec4f(0.0);
  var tw = 0.0;
  for (var k = 0; k < 6; k++) {
    let fk = f32(k);
    let ww = 1.0 - fk * 0.14;
    acc += textureSampleLevel(texIn, samp, uv - dir * fk, 0.0) * ww;
    tw += ww;
  }
  return acc / max(tw, 0.001);
}
`;

  var ENTRY = {
    passthrough: 'fs_pass',
    warm: 'fs_warm',
    vignette: 'fs_vig',
    scan: 'fs_scan',
    chroma: 'fs_chroma',
    poster: 'fs_poster',
    fractal2d: 'fs_fract2d',
    smear: 'fs_smear'
  };

  function loadHalfResFlag() {
    try {
      halfResChain = localStorage.getItem('nexus.wgpu.halfRes') === '1';
    } catch (e) { halfResChain = false; }
  }

  function saveHalfResFlag() {
    try {
      localStorage.setItem('nexus.wgpu.halfRes', halfResChain ? '1' : '0');
    } catch (e2) { /* ignore */ }
  }

  function loadChainFromStorage() {
    try {
      var raw = localStorage.getItem('nexus.wgpu.chain');
      if (!raw) return;
      var j = JSON.parse(raw);
      if (Array.isArray(j) && j.length) {
        chain = j.map(function (n) {
          return {
            type: ENTRY[n.type] ? n.type : 'passthrough',
            intensity: typeof n.intensity === 'number' ? Math.max(0, Math.min(1, n.intensity)) : 0.5
          };
        }).slice(0, 8);
      }
    } catch (e) { /* ignore */ }
  }

  function saveChainToStorage() {
    try {
      localStorage.setItem('nexus.wgpu.chain', JSON.stringify(chain));
    } catch (e2) { /* ignore */ }
  }

  function ensureTextures(w, h) {
    if (!device) return;
    if (texA && tw === w && th === h) return;
    tw = w;
    th = h;
    if (texA) texA.destroy();
    if (texB) texB.destroy();
    var desc = {
      size: { width: w, height: h },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    };
    texA = device.createTexture(desc);
    texB = device.createTexture(desc);
  }

  function makePipelineLayout() {
    return device.createPipelineLayout({ bindGroupLayouts: [layout] });
  }

  function makeRgbaPipeline(entry) {
    return device.createRenderPipeline({
      layout: makePipelineLayout(),
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: entry,
        targets: [{ format: 'rgba8unorm' }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }

  function makeBlitPipeline() {
    return device.createRenderPipeline({
      layout: makePipelineLayout(),
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_pass',
        targets: [{ format: format }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }

  function makeBindGroup(texView, intensity, timeS, bass, flux) {
    var u = new Float32Array([intensity, timeS, bass, flux]);
    device.queue.writeBuffer(ubuf, 0, u);
    return device.createBindGroup({
      layout: layout,
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: texView }
      ]
    });
  }

  function tryInit() {
    if (initTried) return Promise.resolve(ready);
    initTried = true;
    loadHalfResFlag();
    loadChainFromStorage();
    if (!navigator.gpu) return Promise.resolve(false);
    var canvas = document.getElementById('nx-wgpu');
    if (!canvas) return Promise.resolve(false);
    return navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).then(function (adapter) {
      if (!adapter) return false;
      return adapter.requestDevice();
    }).then(function (dev) {
      if (!dev) return false;
      device = dev;
      ctxGpu = canvas.getContext('webgpu');
      if (!ctxGpu) return false;
      format = navigator.gpu.getPreferredCanvasFormat();
      ctxGpu.configure({ device: device, format: format, alphaMode: 'premultiplied' });
      shaderModule = device.createShaderModule({ code: WGSL });
      layout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
        ]
      });
      sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
      ubuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      var k;
      for (k in ENTRY) {
        if (ENTRY.hasOwnProperty(k)) rgbaPipelines[k] = makeRgbaPipeline(ENTRY[k]);
      }
      blitPipeline = makeBlitPipeline();
      ready = true;
      resize();
      return true;
    }).catch(function () {
      ready = false;
      return false;
    });
  }

  function resize() {
    var c = document.getElementById('c');
    var wEl = document.getElementById('nx-wgpu');
    if (!c || !wEl) return;
    wEl.width = c.width;
    wEl.height = c.height;
    wEl.style.width = c.style.width || '100%';
    wEl.style.height = c.style.height || '100%';
    if (ctxGpu && device && navigator.gpu) {
      format = navigator.gpu.getPreferredCanvasFormat();
      ctxGpu.configure({ device: device, format: format, alphaMode: 'premultiplied' });
      if (ready && shaderModule && layout) {
        blitPipeline = makeBlitPipeline();
      }
    }
    tw = 0;
    th = 0;
    texA = null;
    texB = null;
  }

  function setEnabled(on) {
    enabled = !!on;
    var wEl = document.getElementById('nx-wgpu');
    if (wEl) {
      wEl.style.opacity = enabled ? '1' : '0';
      wEl.style.pointerEvents = 'none';
    }
    var S = window.NX && NX.S;
    if (S) S.wgpuGraphEnabled = enabled;
  }

  function getChain() {
    return chain.slice();
  }

  function setChain(next) {
    if (!Array.isArray(next)) return;
    chain = next.slice(0, 8).map(function (n) {
      var t = n.type && ENTRY[n.type] ? n.type : 'passthrough';
      return { type: t, intensity: typeof n.intensity === 'number' ? Math.max(0, Math.min(1, n.intensity)) : 0 };
    });
    saveChainToStorage();
  }

  function activeNodes() {
    return chain.filter(function (n) { return n.intensity > 0.002; });
  }

  function renderFrame() {
    if (!ready || !enabled || !device || !ctxGpu) return;
    var c = document.getElementById('c');
    if (!c) return;
    var wFull = c.width | 0;
    var hFull = c.height | 0;
    var w = halfResChain ? Math.max(2, (wFull / 2) | 0) : wFull;
    var h = halfResChain ? Math.max(2, (hFull / 2) | 0) : hFull;
    if (wFull < 2 || hFull < 2) return;
    var nodes = activeNodes();
    if (!nodes.length) return;
    if (!blitPipeline) return;

    ensureTextures(w, h);
    var S = window.NX && NX.S;
    var bass = S && typeof S.sBass === 'number' ? S.sBass : 0;
    var flux = S && typeof S.sFlux === 'number' ? S.sFlux : 0;
    var timeS = performance.now() / 1000;

    var encoder = device.createCommandEncoder();
    encoder.copyExternalImageToTexture(
      { source: c },
      { texture: texA },
      { width: w, height: h }
    );

    var input = texA;
    var output = texB;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var pl = rgbaPipelines[node.type] || rgbaPipelines.passthrough;
      var pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: output.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.setPipeline(pl);
      pass.setBindGroup(0, makeBindGroup(input.createView(), node.intensity, timeS, bass, flux));
      pass.draw(3);
      pass.end();
      if (i < nodes.length - 1) {
        var tmp = input;
        input = output;
        output = tmp;
      }
    }

    var outTex = output;
    var swapView = ctxGpu.getCurrentTexture().createView();
    var passB = encoder.beginRenderPass({
      colorAttachments: [{
        view: swapView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    passB.setPipeline(blitPipeline);
    passB.setBindGroup(0, makeBindGroup(outTex.createView(), 1, timeS, bass, flux));
    passB.draw(3);
    passB.end();

    device.queue.submit([encoder.finish()]);
  }

  function isReady() {
    return ready && !!blitPipeline;
  }

  window.NX = window.NX || {};
  function setHalfResChain(on) {
    halfResChain = !!on;
    saveHalfResFlag();
    tw = 0;
    th = 0;
    texA = null;
    texB = null;
  }

  function getHalfResChain() {
    return halfResChain;
  }

  NX.WgslGraph = {
    tryInit: tryInit,
    resize: resize,
    setEnabled: setEnabled,
    getEnabled: function () { return enabled; },
    getChain: getChain,
    setChain: setChain,
    renderFrame: renderFrame,
    isReady: isReady,
    setHalfResChain: setHalfResChain,
    getHalfResChain: getHalfResChain,
    NODE_TYPES: Object.keys(ENTRY)
  };
})();
