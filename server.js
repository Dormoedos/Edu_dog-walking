const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DB_PATH, getMoscowDate, ensureSlotsForDate, getTodaySlots } = require('./db');

// Не 3000: на этом порту часто уже работают другие локальные проекты
const PORT = Number(process.env.PORT) || 3100;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Отдаём только явно перечисленные файлы, без обхода папки по произвольному пути
const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
};

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// «суббота, 17 октября 2026 г.» для даты YYYY-MM-DD, уже посчитанной по Москве
function formatDateLabel(isoDate) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function handleState(res) {
  const { date, slots } = getTodaySlots();
  sendJson(res, 200, { date, dateLabel: formatDateLabel(date), slots });
}

function handleStatic(res, staticFile) {
  fs.readFile(path.join(PUBLIC_DIR, staticFile.file), (err, content) => {
    if (err) {
      console.error('Не удалось прочитать файл:', err);
      sendText(res, 500, 'Ошибка сервера');
      return;
    }
    res.writeHead(200, { 'Content-Type': staticFile.type });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && pathname === '/api/state') {
      handleState(res);
      return;
    }

    const staticFile = req.method === 'GET' && STATIC_FILES[pathname];
    if (staticFile) {
      handleStatic(res, staticFile);
      return;
    }

    sendText(res, 404, 'Не найдено');
  } catch (err) {
    console.error('Ошибка обработки запроса:', err);
    sendJson(res, 500, { error: 'Ошибка сервера' });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} уже занят другим процессом. Запустите на другом порту: PORT=3200 npm start`);
  } else {
    console.error('Не удалось запустить сервер:', err);
  }
  process.exit(1);
});

const today = getMoscowDate();
ensureSlotsForDate(today);
console.log(`База SQLite: ${DB_PATH}, слоты на ${today} готовы`);

// Только локальный адрес: проект запускается и проверяется на этом компьютере
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
