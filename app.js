const STORAGE_KEY = 'weekly-status-tracker:v1';

const weekSelect = document.getElementById('weekSelect');
const newWeekBtn = document.getElementById('newWeekBtn');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const clearLocalBtn = document.getElementById('clearLocalBtn');

const doneList = document.getElementById('doneList');
const planList = document.getElementById('planList');
const addDoneBtn = document.getElementById('addDoneBtn');
const addPlanBtn = document.getElementById('addPlanBtn');

const tileTemplate = document.getElementById('tileTemplate');

function isoDate(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function startOfWeek(d = new Date()) {
  // Monday start
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function fmtWeekLabel(weekStartISO) {
  const d = new Date(weekStartISO + 'T00:00:00');
  const end = addDays(d, 6);
  return `${weekStartISO} → ${isoDate(end)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { weeks: {}, selectedWeek: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { weeks: {}, selectedWeek: null };
    return {
      weeks: parsed.weeks || {},
      selectedWeek: parsed.selectedWeek || null,
    };
  } catch {
    return { weeks: {}, selectedWeek: null };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureWeek(state, weekStartISO) {
  if (!state.weeks[weekStartISO]) {
    state.weeks[weekStartISO] = {
      done: [],
      plan: [],
      createdAt: new Date().toISOString(),
    };
  }
}

function setSelectedWeek(state, weekStartISO) {
  ensureWeek(state, weekStartISO);
  state.selectedWeek = weekStartISO;
  saveState(state);
  render();
}

function getAllWeeksSorted(state) {
  return Object.keys(state.weeks).sort((a, b) => (a < b ? 1 : -1));
}

function createTile(text = '') {
  const node = tileTemplate.content.firstElementChild.cloneNode(true);
  const body = node.querySelector('.tile-body');
  body.textContent = text;
  return node;
}

function renderWeekSelect(state) {
  const weeks = getAllWeeksSorted(state);
  weekSelect.innerHTML = '';
  for (const w of weeks) {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = fmtWeekLabel(w);
    weekSelect.appendChild(opt);
  }

  if (!state.selectedWeek) {
    const thisWeek = isoDate(startOfWeek());
    if (!state.weeks[thisWeek]) ensureWeek(state, thisWeek);
    state.selectedWeek = thisWeek;
    saveState(state);
  }

  // If selectedWeek missing (after import), pick newest
  if (!state.weeks[state.selectedWeek]) {
    const newest = weeks[0] || isoDate(startOfWeek());
    ensureWeek(state, newest);
    state.selectedWeek = newest;
    saveState(state);
  }

  weekSelect.value = state.selectedWeek;
}

function renderList(listEl, tiles, listName) {
  listEl.innerHTML = '';
  tiles.forEach((t, idx) => {
    const tile = createTile(t.text || '');
    tile.dataset.list = listName;
    tile.dataset.index = String(idx);
    listEl.appendChild(tile);
  });

  // empty state
  if (tiles.length === 0) {
    const hint = document.createElement('li');
    hint.className = 'tile';
    hint.innerHTML = `
      <div class="tile-bar"><span class="drag"> </span><span>empty</span></div>
      <div class="tile-body" style="color: var(--muted)">Add a tile to get started.</div>
    `;
    hint.style.opacity = '0.75';
    hint.style.borderStyle = 'dashed';
    listEl.appendChild(hint);
  }
}

function render() {
  const state = loadState();
  renderWeekSelect(state);
  const week = state.weeks[state.selectedWeek];

  renderList(doneList, week.done, 'done');
  renderList(planList, week.plan, 'plan');

  wireLists();
}

function addTileTo(listName) {
  const state = loadState();
  const weekStartISO = state.selectedWeek;
  ensureWeek(state, weekStartISO);
  state.weeks[weekStartISO][listName].unshift({ text: '' });
  saveState(state);
  render();

  // focus first editable tile
  const listEl = listName === 'done' ? doneList : planList;
  const first = listEl.querySelector('.tile .tile-body');
  if (first) {
    first.focus();
    document.execCommand?.('selectAll', false, null);
  }
}

function deleteTile(listName, idx) {
  const state = loadState();
  const week = state.weeks[state.selectedWeek];
  week[listName].splice(idx, 1);
  saveState(state);
  render();
}

function updateTileText(listName, idx, text) {
  const state = loadState();
  const week = state.weeks[state.selectedWeek];
  if (!week[listName][idx]) return;
  week[listName][idx].text = text;
  saveState(state);
}

function newWeek() {
  const state = loadState();
  const thisWeek = isoDate(startOfWeek());
  // create a next week if this already exists and is selected
  let w = thisWeek;
  if (state.weeks[w]) {
    // pick next Monday after latest week
    const weeks = getAllWeeksSorted(state);
    const newest = weeks[0];
    const d = new Date(newest + 'T00:00:00');
    w = isoDate(addDays(d, 7));
  }
  ensureWeek(state, w);
  state.selectedWeek = w;
  saveState(state);
  render();
}

function exportJson() {
  const state = loadState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `weekly-status-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
  if (!parsed.weeks || typeof parsed.weeks !== 'object') throw new Error('Missing weeks');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  render();
}

function clearLocal() {
  if (!confirm('Clear all local weekly status data from this browser?')) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
}

// Drag + drop reorder
let dragSrc = null;

function wireLists() {
  for (const listEl of [doneList, planList]) {
    for (const tile of listEl.querySelectorAll('li.tile[draggable="true"]')) {
      const body = tile.querySelector('.tile-body');
      const del = tile.querySelector('[data-action="delete"]');

      body.addEventListener('input', () => {
        const listName = tile.dataset.list;
        const idx = Number(tile.dataset.index);
        updateTileText(listName, idx, body.textContent);
      });

      del.addEventListener('click', () => {
        const listName = tile.dataset.list;
        const idx = Number(tile.dataset.index);
        deleteTile(listName, idx);
      });

      tile.addEventListener('dragstart', (e) => {
        dragSrc = tile;
        tile.setAttribute('aria-grabbed', 'true');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
          list: tile.dataset.list,
          index: Number(tile.dataset.index),
        }));
      });

      tile.addEventListener('dragend', () => {
        tile.removeAttribute('aria-grabbed');
        dragSrc = null;
      });

      tile.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragSrc) return;

        const from = JSON.parse(e.dataTransfer.getData('text/plain'));
        const to = { list: tile.dataset.list, index: Number(tile.dataset.index) };

        const state = loadState();
        const week = state.weeks[state.selectedWeek];

        const fromArr = week[from.list];
        const toArr = week[to.list];

        const [moved] = fromArr.splice(from.index, 1);
        // if moving within same array and removing earlier index, adjust target
        let insertAt = to.index;
        if (from.list === to.list && from.index < to.index) insertAt = to.index - 1;
        toArr.splice(insertAt, 0, moved);

        saveState(state);
        render();
      });
    }
  }
}

// Events
weekSelect.addEventListener('change', () => {
  const state = loadState();
  setSelectedWeek(state, weekSelect.value);
});

newWeekBtn.addEventListener('click', newWeek);
addDoneBtn.addEventListener('click', () => addTileTo('done'));
addPlanBtn.addEventListener('click', () => addTileTo('plan'));
exportBtn.addEventListener('click', exportJson);
clearLocalBtn.addEventListener('click', clearLocal);

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    await importJson(file);
  } catch (e) {
    alert(`Import failed: ${e.message || e}`);
  } finally {
    importFile.value = '';
  }
});

// Boot
(function init() {
  const state = loadState();
  const thisWeek = isoDate(startOfWeek());
  ensureWeek(state, thisWeek);
  if (!state.selectedWeek) state.selectedWeek = thisWeek;
  saveState(state);
  render();
})();
