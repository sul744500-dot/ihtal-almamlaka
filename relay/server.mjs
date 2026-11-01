// خادم «احتلّ المملكة» المحلي:
// - يقدّم اللعبة المبنية (مجلد dist) على الشبكة المحلية
// - يمرر رسائل التزامن عبر WebSocket بين المتصفح وOBS Browser Source والجوال
// - يحتفظ بآخر حالة للمباراة حتى تظهر فورًا لأي شاشة تتصل لاحقًا
// الاستخدام: npm start   (أو: node relay/server.mjs)

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';
import { authorize, isLoopback, isNewerState, makePin } from './logic.mjs';

const PORT = Number(process.env.IHTAL_PORT || process.env.PORT || 8787);
const HOST = process.env.IHTAL_HOST || '0.0.0.0';
const PIN = process.env.IHTAL_PIN || makePin();
const DIST = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const VERSION = 1;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list ?? []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

const lanUrls = () => lanAddresses().map((ip) => `http://${ip}:${PORT}`);

async function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/ihtal-relay.json') {
    const local = isLoopback(req.socket.remoteAddress);
    const body = { ws: true, version: VERSION, port: PORT, ...(local ? { pin: PIN, lanUrls: lanUrls() } : {}) };
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(DIST, pathname));
  if (file !== DIST && !file.startsWith(DIST + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('not a file');
    const data = await readFile(file);
    const ext = extname(file).toLowerCase();
    const immutable = pathname.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(data);
  } catch {
    if (pathname === '/index.html') {
      res.writeHead(503, { 'Content-Type': MIME['.html'] });
      res.end('<meta charset="utf-8"><body dir="rtl" style="font-family:sans-serif;background:#081129;color:#fff;padding:40px"><h1>لم يتم بناء اللعبة بعد</h1><p>شغّل الأمر <code>npm run build</code> ثم أعد تشغيل الخادم.</p></body>');
    } else {
      res.writeHead(404).end();
    }
  }
}

const server = http.createServer((req, res) => {
  void serveStatic(req, res);
});

// ───── المزامنة ─────

const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 * 1024 });
/** آخر حالة معروفة للمباراة، تُرسل لكل شاشة جديدة */
let lastState = null;
let lastSettings = null;

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (!authorize(req.socket.remoteAddress, url.searchParams.get('pin'), PIN)) {
      ws.close(4001, 'bad pin');
      return;
    }
    ws.remote = !isLoopback(req.socket.remoteAddress);
    wss.emit('connection', ws, req);
  });
});

function sendJson(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

let midSeq = 0;
const relayMid = () => `relay-${Date.now().toString(36)}-${++midSeq}`;

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  const who = req.socket.remoteAddress;
  console.log(`🔌 اتصال جديد ${ws.remote ? '(جهاز آخر)' : '(هذا الجهاز)'} ${who} — المتصلون: ${wss.clients.size}`);
  if (lastState) sendJson(ws, { t: 'state', from: 'relay', mid: relayMid(), state: lastState });
  if (lastSettings) sendJson(ws, { ...lastSettings, from: 'relay', mid: relayMid() });

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    const raw = data.toString();
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;
    // مزامنة الساعة: نرد على المرسل فقط
    if (msg.t === 'time') {
      sendJson(ws, { t: 'time', id: msg.id, t0: msg.t0, server: Date.now() });
      return;
    }
    if (msg.t === 'state' && msg.state && typeof msg.state.id === 'string') {
      if (isNewerState(msg.state, lastState)) lastState = msg.state;
    } else if (msg.t === 'settings') {
      lastSettings = msg;
    } else if (msg.t === 'cleared' && lastState && lastState.id === msg.matchId) {
      lastState = null;
    }
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === client.OPEN) client.send(raw);
    }
  });

  ws.on('close', () => {
    console.log(`❎ انقطع اتصال ${who} — المتصلون: ${wss.clients.size}`);
  });
});

// إسقاط الاتصالات الميتة (مثلًا جوال أُغلقت شاشته)
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);
wss.on('close', () => clearInterval(heartbeat));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⛔ المنفذ ${PORT} مستخدم. ربما الخادم يعمل بالفعل، أو غيّر المنفذ: set IHTAL_PORT=8788`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, async () => {
  const lans = lanUrls();
  console.log('');
  console.log('  👑 احتلّ المملكة — خادم المزامنة يعمل');
  console.log('');
  console.log(`  الكمبيوتر:          http://localhost:${PORT}`);
  console.log(`  لوحة المقدم:        http://localhost:${PORT}/#/host`);
  console.log(`  OBS Browser Source: http://localhost:${PORT}/?obs=1#/audience   (1920×1080)`);
  for (const u of lans) console.log(`  الجوال (تحكم):      ${u}/?pin=${PIN}#/host`);
  console.log(`  رمز الجوال (PIN):   ${PIN}`);
  console.log('');
  if (lans[0]) {
    try {
      console.log(await QRCode.toString(`${lans[0]}/?pin=${PIN}#/host`, { type: 'terminal', small: true }));
    } catch {
      /* رمز QR اختياري */
    }
  }
  console.log('  اترك هذه النافذة مفتوحة أثناء اللعب. للإيقاف: Ctrl+C');
  console.log('');
});

function shutdown() {
  for (const ws of wss.clients) ws.close(1001, 'server shutdown');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
