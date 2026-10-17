const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  DB_PATH,
  SLOT_TIMES,
  getMoscowDate,
  ensureSlotsForDate,
  getTodaySlots,
  bookSlot,
} = require('./db');

// Не 3000: на этом порту часто уже работают другие локальные проекты
const PORT = Number(process.env.PORT) || 3100;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 10 * 1024;

// Отдаём только явно перечисленные файлы, без обхода папки по произвольному пути
const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
};

// Ошибка с HTTP-статусом и понятным пользователю текстом
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Дочитываем тело вхолостую, чтобы успеть отправить ответ
        req.removeAllListeners('data');
        req.resume();
        reject(new HttpError(413, 'Слишком большой запрос'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof body !== 'object' || body === null) {
          throw new Error('Тело запроса — не объект');
        }
        resolve(body);
      } catch {
        reject(new HttpError(400, 'Некорректный запрос'));
      }
    });

    req.on('error', reject);
  });
}

// Убирает пробелы по краям и схлопывает повторные пробелы внутри
function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function handleState(res) {
  const { date, slots } = getTodaySlots();
  sendJson(res, 200, { date, dateLabel: formatDateLabel(date), slots });
}

async function handleBook(req, res) {
  const body = await readJson(req);
  const name = normalizeName(body.name);

  if (!SLOT_TIMES.includes(body.time)) {
    throw new HttpError(400, 'Такого слота нет');
  }
  if (!name) {
    throw new HttpError(400, 'Введите ФИО');
  }
  if (!bookSlot(body.time, name)) {
    throw new HttpError(409, 'Слот занят');
  }

  sendJson(res, 200, { time: body.time, bookedBy: name });
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

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && pathname === '/api/state') {
      handleState(res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/book') {
      await handleBook(req, res);
      return;
    }

    const staticFile = req.method === 'GET' && STATIC_FILES[pathname];
    if (staticFile) {
      handleStatic(res, staticFile);
      return;
    }

    sendText(res, 404, 'Не найдено');
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
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
