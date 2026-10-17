const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DB_PATH, getMoscowDate, ensureSlotsForDate } = require('./db');

// Не 3000: на этом порту часто уже работают другие локальные проекты
const PORT = Number(process.env.PORT) || 3100;
const INDEX_PATH = path.join(__dirname, 'public', 'index.html');

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/') {
    fs.readFile(INDEX_PATH, (err, html) => {
      if (err) {
        console.error('Не удалось прочитать страницу:', err);
        sendText(res, 500, 'Ошибка сервера');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    return;
  }

  sendText(res, 404, 'Не найдено');
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
