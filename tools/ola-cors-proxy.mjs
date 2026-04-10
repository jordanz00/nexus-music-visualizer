#!/usr/bin/env node
/**
 * Tiny CORS proxy for OLA olad HTTP API (browsers cannot POST to :9090 cross-origin).
 * Run: node tools/ola-cors-proxy.mjs
 * Then in NEXUS Show tab set OLA URL to http://127.0.0.1:9393
 * Requires: olad running (default http://127.0.0.1:9090)
 */
import http from 'http';

var LISTEN = parseInt(process.env.NX_OLA_PROXY_PORT || '9393', 10);
var OLA = process.env.NX_OLA_URL || 'http://127.0.0.1:9090';

function send(res, code, body, headers) {
  headers = headers || {};
  headers['Access-Control-Allow-Origin'] = '*';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type';
  res.writeHead(code, headers);
  res.end(body);
}

var server = http.createServer(function (req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }
  if (req.url === '/health' && req.method === 'GET') {
    send(res, 200, JSON.stringify({ ok: true, target: OLA }), { 'Content-Type': 'application/json' });
    return;
  }
  if (req.url === '/set_dmx' && req.method === 'POST') {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      var body = Buffer.concat(chunks);
      var u = new URL(OLA);
      var opts = {
        hostname: u.hostname,
        port: u.port || 80,
        path: '/set_dmx',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': body.length
        }
      };
      var p = http.request(opts, function (r) {
        var out = [];
        r.on('data', function (x) { out.push(x); });
        r.on('end', function () {
          send(res, r.statusCode, Buffer.concat(out), { 'Content-Type': r.headers['content-type'] || 'text/plain' });
        });
      });
      p.on('error', function (e) {
        send(res, 502, String(e.message), { 'Content-Type': 'text/plain' });
      });
      p.write(body);
      p.end();
    });
    return;
  }
  send(res, 404, 'NX OLA proxy: use POST /set_dmx or GET /health');
});

server.listen(LISTEN, '127.0.0.1', function () {
  console.log('NEXUS OLA CORS proxy http://127.0.0.1:' + LISTEN + ' → ' + OLA);
});
