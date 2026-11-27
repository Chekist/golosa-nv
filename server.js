/* Голоса Нижневартовска — сервер на Node.js (без внешних зависимостей)
   Запуск:  node server.js   →  http://localhost:3000
   API:
     GET  /api/health          — проверка работы сервера
     GET  /api/messages        — список заявок с формы
     POST /api/messages        — новая заявка {name, topic, text}
     DELETE /api/messages      — очистить все заявки
     GET  /api/data            — точки + архив (JSON)
     PUT  /api/data            — сохранить {points, archive}
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const STORE = path.join(ROOT, 'data', 'store.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf'
};

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf-8')); }
  catch { return { points: null, archive: null, messages: [], marks: [] }; }
}
function saveStore(s) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(s, null, 2), 'utf-8');
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  // Buffer и string отправляем как есть; объекты — как JSON
  res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
  });
}

// Фильтр: удаляем эмодзи-флаги (последовательности региональных индикаторов, напр. украинский флаг)
const stripFlags = s => String(s).replace(/[\u{1F1E6}-\u{1F1FF}]{2}\uFE0F?/gu, '').replace(/\u{1F3F3}\uFE0F?\u200D\u{1F308}\uFE0F?/gu, '');

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const route = u.pathname;

  // --- API ---
  if (route.startsWith('/api/')) {
    const store = loadStore();
    if (route === '/api/health' && req.method === 'GET')
      return send(res, 200, { ok: true, name: 'golosa-nv', time: new Date().toISOString() });

    if (route === '/api/messages' && req.method === 'GET')
      return send(res, 200, store.messages);

    if (route === '/api/messages' && req.method === 'POST') {
      try {
        const b = await readBody(req);
        if (!b.name || !b.text) return send(res, 400, { error: 'name и text обязательны' });
        const msg = { id: Date.now(), name: stripFlags(b.name).slice(0, 120), topic: String(b.topic || 'Без темы').slice(0, 120),
                      text: stripFlags(b.text).slice(0, 4000), date: new Date().toLocaleString('ru-RU') };
        store.messages.push(msg); saveStore(store);
        return send(res, 201, msg);
      } catch { return send(res, 400, { error: 'Неверный JSON' }); }
    }

    if (route === '/api/messages' && req.method === 'DELETE') {
      store.messages = []; saveStore(store);
      return send(res, 200, { ok: true });
    }

    if (route === '/api/data' && req.method === 'GET')
      return send(res, 200, { points: store.points, archive: store.archive });

    if (route === '/api/data' && req.method === 'PUT') {
      try {
        const b = await readBody(req);
        if (b.points !== undefined) store.points = b.points;
        if (b.archive !== undefined) store.archive = b.archive;
        saveStore(store);
        return send(res, 200, { ok: true });
      } catch { return send(res, 400, { error: 'Неверный JSON' }); }
    }


    if (route === '/api/marks' && req.method === 'GET')
      return send(res, 200, store.marks || []);

    if (route === '/api/marks' && req.method === 'POST') {
      try {
        const b = await readBody(req);
        if (!b.title || !Array.isArray(b.coords)) return send(res, 400, { error: 'title и coords обязательны' });
        const mark = { id: Date.now(), title: stripFlags(b.title).slice(0, 140),
                       text: stripFlags(b.text || '').slice(0, 2000), author: stripFlags(b.author || '').slice(0, 80),
                       coords: b.coords.map(Number), date: new Date().toLocaleString('ru-RU') };
        store.marks = store.marks || []; store.marks.push(mark); saveStore(store);
        return send(res, 201, mark);
      } catch { return send(res, 400, { error: 'Неверный JSON' }); }
    }

    if (route.startsWith('/api/marks/') && req.method === 'DELETE') {
      const id = Number(route.split('/').pop());
      store.marks = (store.marks || []).filter(m => m.id !== id); saveStore(store);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'API-метод не найден' });
  }

  // --- Статика ---
  let filePath = path.normalize(path.join(ROOT, route === '/' ? 'index.html' : route));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(filePath, (err, content) => {
    if (err) {
      // SPA-fallback: неизвестные пути → главная
      fs.readFile(path.join(ROOT, 'index.html'), (e2, c2) =>
        e2 ? send(res, 404, 'Не найдено', 'text/plain; charset=utf-8') : send(res, 200, c2, MIME['.html']));
      return;
    }
    send(res, 200, content, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log('«Голоса Нижневартовска» запущены:');
  console.log(`  Локально:   http://localhost:${PORT}`);
  console.log('  Админка:    http://localhost:' + PORT + '/admin.html');
  console.log('  API-health: http://localhost:' + PORT + '/api/health');
});
