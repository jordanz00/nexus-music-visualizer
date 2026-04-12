/**
 * nexus-ndi-bridge.mjs — Receives JPEG frames over WebSocket; optional pipe to ffmpeg / NDI tooling.
 *
 * Run: cd NEXUS/tools && npm install && npm run ndi-bridge
 * Browser: point NEXUS "NDI relay URL" to ws://127.0.0.1:9797 and send binary JPEG frames (see NEXUS Pro panel).
 *
 * Real NDI® output requires NewTek/Vizrt SDK or distro that ships libndi — this bridge forwards compressed
 * frames so you can chain: `ffmpeg` with an NDI-enabled build, or OBS Virtual Camera, or Scan Converter.
 */
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const PORT = process.env.NEXUS_NDI_BRIDGE_PORT ? Number(process.env.NEXUS_NDI_BRIDGE_PORT) : 9797;
const FFMPEG = process.env.NEXUS_FFMPEG || 'ffmpeg';

const httpServer = createServer(function (_req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('NEXUS JPEG bridge — WebSocket binary JPEG → optional ffmpeg child (set NEXUS_FFMPEG_OUT).\n');
});

const wss = new WebSocketServer({ server: httpServer, maxPayload: 32 * 1024 * 1024 });

wss.on('connection', function (socket) {
  let ff = null;
  const outArgs = process.env.NEXUS_FFMPEG_OUT;
  if (outArgs) {
    const parts = outArgs.split(/\s+/).filter(Boolean);
    ff = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-i', 'pipe:0'].concat(parts), {
      stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log('[NEXUS] ffmpeg child spawned for JPEG pipe');
  }

  socket.on('message', function (data, isBinary) {
    if (!Buffer.isBuffer(data)) return;
    if (ff && ff.stdin && !ff.stdin.destroyed) {
      try {
        ff.stdin.write(data);
      } catch { /* ignore */ }
    }
  });

  socket.on('close', function () {
    if (ff && ff.stdin) {
      try {
        ff.stdin.end();
      } catch { /* ignore */ }
    }
    ff = null;
  });
});

httpServer.listen(PORT, '127.0.0.1', function () {
  console.log('[NEXUS] JPEG / NDI helper bridge on ws://127.0.0.1:' + PORT);
  if (!process.env.NEXUS_FFMPEG_OUT) {
    console.log('[NEXUS] Tip: set NEXUS_FFMPEG_OUT to extra ffmpeg output args (e.g. NDI or nut mux).');
  }
});
