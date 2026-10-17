const dateEl = document.getElementById('date');
const slotsEl = document.getElementById('slots');
const messageEl = document.getElementById('message');

let slots = [];
// Слот, у которого сейчас открыта форма записи, и введённое в неё ФИО
let openSlotTime = null;
let draftName = '';

// kind: success | error | load (ошибка загрузки состояния)
function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = `message message--${kind}`;
  messageEl.hidden = false;
}

function hideMessage() {
  messageEl.textContent = '';
  messageEl.hidden = true;
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createBookButton(slot) {
  const button = createElement('button', 'button button--primary', 'Записаться');
  button.type = 'button';
  button.addEventListener('click', () => {
    openSlotTime = slot.time;
    hideMessage();
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

  const input = createElement('input', 'book-form__input');
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
    if (messageEl.classList.contains('message--load')) {
      hideMessage();
    }
  } catch (err) {
    console.error('Не удалось загрузить состояние:', err);
    showMessage('Не удалось загрузить слоты. Обновите страницу.', 'load');
  }
}

async function bookSlot(time, rawName, submitButton) {
  if (!rawName.trim()) {
    showMessage('Введите ФИО', 'error');
    return;
  }

  submitButton.disabled = true;
  let response;
  let data = {};
  try {
    response = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time, name: rawName }),
    });
    data = await response.json().catch(() => ({}));
  } catch (err) {
    console.error('Не удалось отправить запись:', err);
    submitButton.disabled = false;
    showMessage('Нет связи с сервером. Попробуйте ещё раз.', 'error');
    return;
  }

  if (response.ok) {
    openSlotTime = null;
    draftName = '';
    showMessage(`Вы записаны на ${data.time}: ${data.bookedBy}`, 'success');
  } else {
    showMessage(data.error || 'Не удалось записаться', 'error');
  }

  // После любого ответа показываем актуальное состояние из базы
  await loadState();
  submitButton.disabled = false;
}

loadState();
