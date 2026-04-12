/**
 * nexus-webrtc-signaling.mjs — Minimal WS room broker for NEXUS MultiscreenRTC (SDP + ICE relay).
 *
 * Run: cd NEXUS/tools && npm install && npm run signaling
 * Default: ws://127.0.0.1:8787 — use only on trusted networks.
 */
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.NEXUS_SIGNAL_PORT ? Number(process.env.NEXUS_SIGNAL_PORT) : 8787;
const rooms = new Map();

function roomState(room) {
  if (!rooms.has(room)) rooms.set(room, { leader: null, follower: null });
  return rooms.get(room);
}

const httpServer = createServer(function (_req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('NEXUS WebRTC signaling — use WebSocket client from NEXUS System panel.\n');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', function (socket) {
  let myRoom = 'default';
  let myRole = null;

  socket.on('message', function (raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === 'hello') {
      myRoom = typeof msg.room === 'string' && msg.room.length < 64 ? msg.room : 'default';
      myRole = msg.role === 'leader' || msg.role === 'follower' ? msg.role : null;
      if (!myRole) return;
      const st = roomState(myRoom);
      if (myRole === 'leader') st.leader = socket;
      else st.follower = socket;
      if (st.leader && st.follower) {
        const go = JSON.stringify({ type: 'paired', room: myRoom });
        try {
          st.leader.send(go);
          st.follower.send(go);
        } catch { /* ignore */ }
      }
      return;
    }
    const st = roomState(myRoom);
    const peer = myRole === 'leader' ? st.follower : st.leader;
    if (peer && peer.readyState === 1) {
      try {
        peer.send(JSON.stringify(msg));
      } catch { /* ignore */ }
    }
  });

  socket.on('close', function () {
    const st = roomState(myRoom);
    if (st.leader === socket) st.leader = null;
    if (st.follower === socket) st.follower = null;
  });
});

httpServer.listen(PORT, '127.0.0.1', function () {
  console.log('[NEXUS] WebRTC signaling on ws://127.0.0.1:' + PORT);
});
