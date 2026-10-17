const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'boris.db');
const TIME_ZONE = 'Europe/Moscow';
const SLOT_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00'];

const db = new DatabaseSync(DB_PATH);

// Схема из spec.md без изменений
db.exec(`
CREATE TABLE IF NOT EXISTS walk_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  walk_date TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  booked_by TEXT,
  booked_at TEXT,
  UNIQUE (walk_date, slot_time),
  CHECK (
    (booked_by IS NULL AND booked_at IS NULL)
    OR
    (booked_by IS NOT NULL AND booked_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS feedings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  fed_at TEXT NOT NULL
);
`);

// Текущая дата в Москве в формате YYYY-MM-DD (локаль en-CA даёт именно его)
function getMoscowDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const insertSlot = db.prepare(
  'INSERT OR IGNORE INTO walk_slots (walk_date, slot_time) VALUES (?, ?)'
);

// Создаёт пять свободных слотов на дату, если их ещё нет; UNIQUE не даёт дублей
function ensureSlotsForDate(walkDate) {
  db.exec('BEGIN');
  try {
    for (const slotTime of SLOT_TIMES) {
      insertSlot.run(walkDate, slotTime);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const selectSlots = db.prepare(
  'SELECT slot_time, booked_by FROM walk_slots WHERE walk_date = ? ORDER BY slot_time'
);

// Слоты на сегодня; создаются при каждом запросе, чтобы после полуночи новый день появлялся без перезапуска
function getTodaySlots() {
  const walkDate = getMoscowDate();
  ensureSlotsForDate(walkDate);
  const slots = selectSlots.all(walkDate).map((row) => ({
    time: row.slot_time,
    bookedBy: row.booked_by,
  }));
  return { date: walkDate, slots };
}

module.exports = { db, DB_PATH, SLOT_TIMES, getMoscowDate, ensureSlotsForDate, getTodaySlots };
