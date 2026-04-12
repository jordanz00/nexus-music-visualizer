'use strict';
/**
 * nexus-webrtc-multiscreen.js — DataChannel clock + scene sync via WS signaling (tools/nexus-webrtc-signaling.mjs).
 * Leader sends {t, beatPhase, curS, seq}; follower smooths webrtcClockOffsetMs and optionally applies scene jumps.
 */
(function () {
  var ws = null;
  var pc = null;
  var dc = null;
  var role = 'solo';
  var room = 'default';
  var seqLast = -1;
  var offsetEma = 0;
  var _cfg = null;

  function guard() {
    return NX.NexusEndpointGuard || { isAllowedProWsUrl: function () { return false; } };
  }

  function sendWs(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function closeAll() {
    try {
      if (dc) dc.close();
    } catch (e0) { /* ignore */ }
    dc = null;
    try {
      if (pc) pc.close();
    } catch (e1) { /* ignore */ }
    pc = null;
    try {
      if (ws) ws.close();
    } catch (e2) { /* ignore */ }
    ws = null;
  }

  function setupPeer(asOfferer) {
    var S = NX.S;
    pc = new RTCPeerConnection(_cfg && _cfg.rtcConfig ? _cfg.rtcConfig : {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pc.onicecandidate = function (ev) {
      sendWs({ type: 'ice', room: room, role: role, candidate: ev.candidate });
    };
    if (asOfferer) {
      dc = pc.createDataChannel('nexus-sync', { ordered: false, maxRetransmits: 0 });
      wireDc();
      pc.createOffer().then(function (o) {
        return pc.setLocalDescription(o);
      }).then(function () {
        sendWs({ type: 'sdp', room: room, role: role, sdp: pc.localDescription });
      }).catch(function (e) {
        if (console.warn) console.warn('NEXUS WebRTC offer failed', e);
      });
    } else {
      pc.ondatachannel = function (ev) {
        dc = ev.channel;
        wireDc();
      };
    }
    pc.onconnectionstatechange = function () {
      if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
        if (console.warn) console.warn('NEXUS WebRTC', pc.connectionState);
      }
    };
  }

  function wireDc() {
    if (!dc) return;
    dc.onmessage = function (ev) {
      var S = NX.S;
      if (!S) return;
      try {
        var msg = JSON.parse(ev.data);
        if (msg.cmd !== 'tick') return;
        if (role !== 'follower') return;
        var leaderNow = +msg.t || 0;
        var local = performance.now();
        var raw = leaderNow - local;
        offsetEma = offsetEma * 0.82 + raw * 0.18;
        S.webrtcClockOffsetMs = offsetEma;
        if (typeof msg.beatPhase === 'number') S.beatPhase = msg.beatPhase;
        if (S.proSyncFollowScenes && typeof msg.curS === 'number' && NX.scenes && NX.scenes.length) {
          var idx = (msg.curS | 0) % NX.scenes.length;
          if (idx !== S.curS && !S.morphing && NX.goNext) {
            NX.goNext(idx);
          }
        }
      } catch (e) { /* ignore */ }
    };
  }

  function tickLeader() {
    if (role !== 'leader' || !dc || dc.readyState !== 'open') return;
    var S = NX.S;
    if (!S) return;
    seqLast++;
    try {
      dc.send(JSON.stringify({
        cmd: 'tick',
        t: performance.now(),
        beatPhase: S.beatPhase,
        curS: S.curS,
        seq: seqLast
      }));
    } catch (e) { /* ignore */ }
  }

  /**
   * @param {string} signalingWsUrl
   * @param {string} r — leader|follower
   * @param {{room?:string}} opt
   * @returns {Promise<void>}
   */
  function connect(signalingWsUrl, r, opt) {
    closeAll();
    role = r === 'leader' || r === 'follower' ? r : 'solo';
    room = (opt && opt.room) || 'default';
    if (role === 'solo') return Promise.resolve();
    if (NX.S) NX.S.proSyncRole = role;
    var g = guard();
    if (!g.isAllowedProWsUrl(signalingWsUrl)) return Promise.reject(new Error('blocked-ws-url'));
    return new Promise(function (resolve, reject) {
      ws = new WebSocket(signalingWsUrl);
      ws.onopen = function () {
        sendWs({ type: 'hello', room: room, role: role });
        resolve();
      };
      ws.onerror = function () { reject(new Error('ws-error')); };
      ws.onmessage = function (ev) {
        var j;
        try {
          j = JSON.parse(ev.data);
        } catch (e) {
          return;
        }
        if (j.type === 'paired') {
          if (role === 'leader') setupPeer(true);
          else setupPeer(false);
          return;
        }
        if (j.type === 'sdp' && role === 'follower' && j.sdp && j.sdp.type === 'offer') {
          if (!pc) setupPeer(false);
        }
        if (j.type === 'sdp' && pc) {
          if (j.sdp && j.sdp.type === 'offer' && role === 'follower') {
            pc.setRemoteDescription(new RTCSessionDescription(j.sdp)).then(function () {
              return pc.createAnswer();
            }).then(function (a) {
              return pc.setLocalDescription(a);
            }).then(function () {
              sendWs({ type: 'sdp', room: room, role: role, sdp: pc.localDescription });
            }).catch(function (e2) {
              if (console.warn) console.warn('NEXUS answer', e2);
            });
          } else if (j.sdp && j.sdp.type === 'answer' && role === 'leader') {
            pc.setRemoteDescription(new RTCSessionDescription(j.sdp)).catch(function () { });
          }
          return;
        }
        if (j.type === 'ice' && pc && j.candidate) {
          try {
            pc.addIceCandidate(new RTCIceCandidate(j.candidate));
          } catch (e3) { /* ignore */ }
        }
      };
    });
  }

  window.NX = window.NX || {};
  NX.MultiscreenRTC = {
    connect: connect,
    disconnect: function () {
      closeAll();
      role = 'solo';
      offsetEma = 0;
      if (NX.S) {
        NX.S.webrtcClockOffsetMs = 0;
        NX.S.proSyncRole = 'solo';
      }
    },
    tickLeader: tickLeader,
    getRole: function () { return role; }
  };
})();
