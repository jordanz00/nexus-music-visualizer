'use strict';
/**
 * nexus-comfy-client.js — Local ComfyUI (/prompt + /history) and A1111 (/sdapi/v1/txt2img) with strict URL allowlist.
 * No API keys in repo; operators supply loopback URLs only (see NX.NexusEndpointGuard).
 */
(function () {
  function guard() {
    return NX.NexusEndpointGuard || { isAllowedProHttpUrl: function () { return false; } };
  }

  function clientId() {
    return 'nexus-' + ((Math.random() * 1e9) | 0).toString(36);
  }

  /**
   * @param {string} base — e.g. http://127.0.0.1:8188
   * @param {object} promptGraph — Comfy API-format prompt object
   * @returns {Promise<{images: string[]}>} base64 PNG strings without data: prefix
   */
  function comfyQueueAndWait(base, promptGraph) {
    var g = guard();
    if (!g.isAllowedProHttpUrl(base)) return Promise.reject(new Error('blocked-url'));
    var cid = clientId();
    var url = base.replace(/\/$/, '') + '/prompt';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptGraph, client_id: cid }),
      credentials: 'omit',
      mode: 'cors'
    }).then(function (r) {
      if (!r.ok) return Promise.reject(new Error('comfy-prompt ' + r.status));
      return r.json();
    }).then(function (j) {
      var pid = j.prompt_id;
      if (!pid) return Promise.reject(new Error('no-prompt_id'));
      var t0 = performance.now();
      return new Promise(function (resolve, reject) {
        function poll() {
          if (performance.now() - t0 > 240000) {
            reject(new Error('timeout'));
            return;
          }
          var hUrl = base.replace(/\/$/, '') + '/history/' + encodeURIComponent(pid);
          fetch(hUrl, { credentials: 'omit', mode: 'cors' })
            .then(function (hr) {
              if (hr.status === 404) {
                return fetch(base.replace(/\/$/, '') + '/history', { credentials: 'omit', mode: 'cors' }).then(function (h2) { return h2.json(); });
              }
              return hr.json();
            })
            .then(function (hist) {
              var block = hist && hist[pid] ? hist[pid] : hist;
              var out = block && block.outputs;
              if (!out) {
                setTimeout(poll, 480);
                return;
              }
              var imgs = [];
              var k;
              for (k in out) {
                if (!out[k] || !out[k].images) continue;
                var arr = out[k].images;
                var i;
                for (i = 0; i < arr.length; i++) {
                  var im = arr[i];
                  var fn = im.filename;
                  var sub = im.subfolder || '';
                  var typ = im.type || 'output';
                  if (!fn) continue;
                  var vu = base.replace(/\/$/, '') + '/view?filename=' + encodeURIComponent(fn) +
                    '&subfolder=' + encodeURIComponent(sub) + '&type=' + encodeURIComponent(typ);
                  imgs.push(vu);
                }
              }
              if (imgs.length === 0) {
                setTimeout(poll, 480);
                return;
              }
              resolve({ viewUrls: imgs });
            })
            .catch(function () { setTimeout(poll, 720); });
        }
        poll();
      });
    });
  }

  function fetchAsBlob(url) {
    return fetch(url, { credentials: 'omit', mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('view ' + r.status);
      return r.blob();
    });
  }

  /**
   * Automatic1111 txt2img (OpenAPI shape).
   * @param {string} base — http://127.0.0.1:7860
   * @param {string} prompt
   * @param {{steps?:number,width?:number,height?:number}} opt
   */
  function a1111Txt2Img(base, prompt, opt) {
    var g = guard();
    if (!g.isAllowedProHttpUrl(base)) return Promise.reject(new Error('blocked-url'));
    opt = opt || {};
    var url = base.replace(/\/$/, '') + '/sdapi/v1/txt2img';
    var body = {
      prompt: String(prompt || ''),
      steps: Math.max(4, Math.min(60, opt.steps | 0 || 22)),
      width: Math.max(256, Math.min(768, opt.width | 0 || 512)),
      height: Math.max(256, Math.min(768, opt.height | 0 || 512)),
      cfg_scale: 7
    };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      mode: 'cors'
    }).then(function (r) {
      if (!r.ok) return Promise.reject(new Error('a1111 ' + r.status));
      return r.json();
    }).then(function (j) {
      var imgs = j.images;
      if (!imgs || !imgs.length) return Promise.reject(new Error('no-images'));
      return { base64Png: imgs[0] };
    });
  }

  /**
   * Build minimal Comfy graph from JSON string (localStorage or UI). Replaces __PROMPT__.
   * @param {string} workflowJson
   * @param {string} positive
   * @returns {object|null}
   */
  function parseWorkflowTemplate(workflowJson, positive, ckpt) {
    if (!workflowJson || typeof workflowJson !== 'string') return null;
    try {
      var esc = String(positive || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      var s = workflowJson.replace(/__PROMPT__/g, esc);
      s = s.replace(/__CKPT__/g, String(ckpt || 'model.safetensors').replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  window.NX = window.NX || {};
  NX.ComfyClient = {
    comfyQueueAndWait: comfyQueueAndWait,
    a1111Txt2Img: a1111Txt2Img,
    parseWorkflowTemplate: parseWorkflowTemplate,
    fetchAsBlob: fetchAsBlob,
    clientId: clientId
  };
})();
