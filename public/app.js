const dateEl = document.getElementById('date');
const slotsEl = document.getElementById('slots');
const messageEl = document.getElementById('message');

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
}

function hideMessage() {
  messageEl.textContent = '';
  messageEl.hidden = true;
}

// ФИО выводится через textContent, поэтому введённый текст не исполняется как HTML
function renderSlot(slot) {
  const isBooked = slot.bookedBy !== null;

  const item = document.createElement('li');
  item.className = isBooked ? 'slot slot--booked' : 'slot slot--free';

  const time = document.createElement('span');
  time.className = 'slot__time';
  time.textContent = slot.time;

  const status = document.createElement('span');
  status.className = 'slot__status';
  status.textContent = isBooked ? 'Занято' : 'Свободно';

  item.append(time, status);

  if (isBooked) {
    const name = document.createElement('span');
    name.className = 'slot__name';
    name.textContent = slot.bookedBy;
    item.append(name);
  }

  return item;
}

async function loadState() {
  try {
    const response = await fetch('/api/state');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const state = await response.json();

    dateEl.textContent = state.dateLabel;
    slotsEl.replaceChildren(...state.slots.map(renderSlot));
    hideMessage();
  } catch (err) {
    console.error('Не удалось загрузить состояние:', err);
    dateEl.textContent = '';
    showMessage('Не удалось загрузить слоты. Обновите страницу.');
  }
}

loadState();
