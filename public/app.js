const dateEl = document.getElementById('date');
const slotsEl = document.getElementById('slots');
const slotsMessageEl = document.getElementById('message');
const feedingLastEl = document.getElementById('feeding-last');
const feedingMessageEl = document.getElementById('feeding-message');
const feedForm = document.getElementById('feed-form');
const feedNameInput = document.getElementById('feed-name');

let slots = [];
// Слот, у которого сейчас открыта форма записи, и введённое в неё ФИО
let openSlotTime = null;
let draftName = '';

// kind: success | error | load (ошибка загрузки состояния)
function showMessage(target, text, kind) {
  target.textContent = text;
  target.className = `message message--${kind}`;
  target.hidden = false;
}

function hideMessage(target) {
  target.textContent = '';
  target.hidden = true;
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Возвращает { ok, data } или null, если сервер недоступен
async function postJson(url, payload) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  } catch (err) {
    console.error(`Не удалось отправить запрос ${url}:`, err);
    return null;
  }
}

function createBookButton(slot) {
  const button = createElement('button', 'button button--primary', 'Записаться');
  button.type = 'button';
  button.addEventListener('click', () => {
    openSlotTime = slot.time;
    hideMessage(slotsMessageEl);
    renderSlots();
    document.getElementById(`name-${slot.time}`).focus();
  });
  return button;
}

function createBookForm(slot) {
  const form = createElement('form', 'book-form');
  const inputId = `name-${slot.time}`;

  const label = createElement('label', 'visually-hidden', `ФИО для записи на ${slot.time}`);
  label.htmlFor = inputId;

  const input = createElement('input', 'input');
  input.id = inputId;
  input.name = 'name';
  input.placeholder = 'ФИО, например Анна Тестова';
  input.autocomplete = 'name';
  input.required = true;
  input.value = draftName;
  input.addEventListener('input', () => {
    draftName = input.value;
  });

  const submit = createElement('button', 'button button--primary', 'Подтвердить');
  submit.type = 'submit';

  const cancel = createElement('button', 'button button--secondary', 'Отмена');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    openSlotTime = null;
    renderSlots();
  });

  form.append(label, input, submit, cancel);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    bookSlot(slot.time, input.value, submit);
  });
  return form;
}

// ФИО выводится через textContent, поэтому введённый текст не исполняется как HTML
function renderSlot(slot) {
  const isBooked = slot.bookedBy !== null;
  const item = createElement('li', isBooked ? 'slot slot--booked' : 'slot slot--free');

  const info = createElement('div', 'slot__info');
  info.append(createElement('span', 'slot__status', isBooked ? 'Занято' : 'Свободно'));
  if (isBooked) {
    info.append(createElement('span', 'slot__name', slot.bookedBy));
  }

  item.append(createElement('span', 'slot__time', slot.time), info);

  if (!isBooked) {
    item.append(openSlotTime === slot.time ? createBookForm(slot) : createBookButton(slot));
  }
  return item;
}

function renderSlots() {
  slotsEl.replaceChildren(...slots.map(renderSlot));
}

function renderFeeding(lastFeeding) {
  if (!lastFeeding) {
    feedingLastEl.replaceChildren(createElement('span', 'feeding__empty', 'Отметок пока нет'));
    return;
  }
  feedingLastEl.replaceChildren(
    createElement('span', 'feeding__name', lastFeeding.employeeName),
    createElement('span', 'feeding__time', lastFeeding.fedAtLabel)
  );
}

async function loadState() {
  try {
    const response = await fetch('/api/state');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const state = await response.json();

    dateEl.textContent = state.dateLabel;
    slots = state.slots;
    // Форма открыта только у слота, который всё ещё свободен
    if (!slots.some((slot) => slot.time === openSlotTime && slot.bookedBy === null)) {
      openSlotTime = null;
    }
    renderSlots();
    renderFeeding(state.lastFeeding);
    if (slotsMessageEl.classList.contains('message--load')) {
      hideMessage(slotsMessageEl);
    }
  } catch (err) {
    console.error('Не удалось загрузить состояние:', err);
    showMessage(slotsMessageEl, 'Не удалось загрузить данные. Обновите страницу.', 'load');
  }
}

async function bookSlot(time, rawName, submitButton) {
  if (!rawName.trim()) {
    showMessage(slotsMessageEl, 'Введите ФИО', 'error');
    return;
  }

  submitButton.disabled = true;
  const result = await postJson('/api/book', { time, name: rawName });

  if (!result) {
    showMessage(slotsMessageEl, 'Нет связи с сервером. Попробуйте ещё раз.', 'error');
    submitButton.disabled = false;
    return;
  }

  if (result.ok) {
    openSlotTime = null;
    draftName = '';
    showMessage(slotsMessageEl, `Вы записаны на ${result.data.time}: ${result.data.bookedBy}`, 'success');
  } else {
    showMessage(slotsMessageEl, result.data.error || 'Не удалось записаться', 'error');
  }

  // После любого ответа показываем актуальное состояние из базы
  await loadState();
  submitButton.disabled = false;
}

feedForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = feedForm.querySelector('button[type="submit"]');

  if (!feedNameInput.value.trim()) {
    showMessage(feedingMessageEl, 'Введите ФИО', 'error');
    return;
  }

  submitButton.disabled = true;
  const result = await postJson('/api/feed', { name: feedNameInput.value });

  if (!result) {
    showMessage(feedingMessageEl, 'Нет связи с сервером. Попробуйте ещё раз.', 'error');
  } else if (result.ok) {
    feedNameInput.value = '';
    showMessage(feedingMessageEl, 'Кормление отмечено', 'success');
    await loadState();
  } else {
    showMessage(feedingMessageEl, result.data.error || 'Не удалось отметить кормление', 'error');
  }
  submitButton.disabled = false;
});

loadState();
