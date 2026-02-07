const STORAGE_KEY = 'weekly-status-tracker:v2';

const newWeekBtn = document.getElementById('newWeekBtn');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');

const weeksContainer = document.getElementById('weeksContainer');
const weekTemplate = document.getElementById('weekTemplate');
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
  return `Week of ${weekStartISO} → ${isoDate(end)}`;
}

function loadState() {
  // v2 shape: { weeks: { [weekStartISO]: { tiles:[{text}], createdAt } } }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.weeks && typeof parsed.weeks === 'object') {
        return parsed;
      }
    }
  } catch {}

  // Attempt one-time migration from v1 (done/plan) if present
  try {
    const v1raw = localStorage.getItem('weekly-status-tracker:v1');
    if (v1raw) {
      const v1 = JSON.parse(v1raw);
      const weeks = {};
      for (const [wk, w] of Object.entries(v1.weeks || {})) {
        const tiles = [];
        const done = (w.done || []).map((t) => t.text).filter(Boolean);
        const plan = (w.plan || []).map((t) => t.text).filter(Boolean);
        if (done.length) {
          tiles.push({ text: 'Last week' });
          for (const t of done) tiles.push({ text: t });
        }
        if (plan.length) {
          tiles.push({ text: 'Next week' });
          for (const t of plan) tiles.push({ text: t });
        }
        weeks[wk] = { tiles, createdAt: w.createdAt || new Date().toISOString() };
      }
      const state = { weeks };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    }
  } catch {}

  return { weeks: {} };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureWeek(state, weekStartISO) {
  if (!state.weeks[weekStartISO]) {
    state.weeks[weekStartISO] = {
      tiles: [],
      createdAt: new Date().toISOString(),
    };
  }
}

function getAllWeeksSorted(state) {
  // newest first
  return Object.keys(state.weeks).sort((a, b) => (a < b ? 1 : -1));
}

function createTile(text = '') {
  const node = tileTemplate.content.firstElementChild.cloneNode(true);
  const body = node.querySelector('.tile-body');
  body.textContent = text;
  return node;
}

function renderWeekSection(weekStartISO, weekData) {
  const section = weekTemplate.content.firstElementChild.cloneNode(true);
  section.dataset.week = weekStartISO;

  section.querySelector('.week-title').textContent = fmtWeekLabel(weekStartISO);
  section.querySelector('.week-meta').textContent = `Tiles: ${weekData.tiles.length}`;

  const listEl = section.querySelector('ul.list');
  listEl.innerHTML = '';

  weekData.tiles.forEach((t, idx) => {
    const tile = createTile(t.text || '');
    tile.dataset.week = weekStartISO;
    tile.dataset.index = String(idx);
    listEl.appendChild(tile);
  });

  if (weekData.tiles.length === 0) {
    const hint = document.createElement('li');
    hint.className = 'tile';
    hint.innerHTML = `
      <div class="tile-bar"><span class="drag"> </span><span>empty</span></div>
      <div class="tile-body" style="color: var(--muted)">Add a tile, then write your sections (e.g. “Last week”, “Next week”).</div>
    `;
    hint.style.opacity = '0.75';
    hint.style.borderStyle = 'dashed';
    listEl.appendChild(hint);
  }

  // Add button
  section.querySelector('[data-action="add"]').addEventListener('click', () => {
    addTileToWeek(weekStartISO);
  });

  // Delete week button
  section.querySelector('[data-action="delete-week"]').addEventListener('click', () => {
    deleteWeek(weekStartISO);
  });

  // Wire tiles (edit/delete/reorder)
  wireWeekList(listEl);

  return section;
}

function render() {
  const state = loadState();
  let weeks = getAllWeeksSorted(state);

  // Keep first-run experience simple: start with this week when empty.
  if (weeks.length === 0) {
    const thisWeek = isoDate(startOfWeek());
    ensureWeek(state, thisWeek);
    saveState(state);
    weeks = getAllWeeksSorted(state);
  }

  weeksContainer.innerHTML = '';
  for (const w of weeks) {
    weeksContainer.appendChild(renderWeekSection(w, state.weeks[w]));
  }
}

function addTileToWeek(weekStartISO) {
  const state = loadState();
  ensureWeek(state, weekStartISO);
  state.weeks[weekStartISO].tiles.unshift({ text: '' });
  saveState(state);
  render();

  // focus first editable tile of that week
  const section = weeksContainer.querySelector(`[data-week="${CSS.escape(weekStartISO)}"]`);
  const first = section?.querySelector('.tile .tile-body');
  first?.focus();
}

function deleteWeek(weekStartISO) {
  const state = loadState();
  const week = state.weeks[weekStartISO];
  if (!week) return;

  const tileCount = week.tiles.length;
  const tileWord = tileCount === 1 ? 'tile' : 'tiles';
  const ok = window.confirm(`Delete ${fmtWeekLabel(weekStartISO)}? This removes ${tileCount} ${tileWord}.`);
  if (!ok) return;

  delete state.weeks[weekStartISO];
  saveState(state);
  render();
}

function deleteTile(weekStartISO, idx) {
  const state = loadState();
  const week = state.weeks[weekStartISO];
  if (!week) return;
  week.tiles.splice(idx, 1);
  saveState(state);
  render();
}

function updateTileText(weekStartISO, idx, text) {
  const state = loadState();
  const week = state.weeks[weekStartISO];
  if (!week || !week.tiles[idx]) return;
  week.tiles[idx].text = text;
  saveState(state);
}

function moveTile(weekStartISO, fromIdx, toIdx) {
  const state = loadState();
  const week = state.weeks[weekStartISO];
  if (!week) return false;

  const arr = week.tiles;
  if (
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= arr.length ||
    toIdx >= arr.length ||
    fromIdx === toIdx
  ) {
    return false;
  }

  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);

  saveState(state);
  return true;
}

function moveTileRelative(weekStartISO, idx, direction) {
  const nextIdx = idx + direction;
  if (moveTile(weekStartISO, idx, nextIdx)) {
    render();
  }
}

function newWeek() {
  const state = loadState();
  const weeks = getAllWeeksSorted(state);
  const newest = weeks[0] || isoDate(startOfWeek());
  const d = new Date(newest + 'T00:00:00');
  const next = isoDate(addDays(d, 7));
  ensureWeek(state, next);
  saveState(state);
  render();
  // scroll to top (newest)
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

// Drag + drop reorder within a week
let dragSrc = null;

function wireWeekList(listEl) {
  const tiles = Array.from(listEl.querySelectorAll('li.tile[draggable="true"]'));
  const lastIndex = tiles.length - 1;

  for (const tile of tiles) {
    const body = tile.querySelector('.tile-body');
    const up = tile.querySelector('[data-action="up"]');
    const down = tile.querySelector('[data-action="down"]');
    const del = tile.querySelector('[data-action="delete"]');

    const idx = Number(tile.dataset.index);
    up.disabled = idx === 0;
    down.disabled = idx === lastIndex;

    body.addEventListener('input', () => {
      const week = tile.dataset.week;
      const currentIdx = Number(tile.dataset.index);
      updateTileText(week, currentIdx, body.textContent);
    });

    up.addEventListener('click', () => {
      const week = tile.dataset.week;
      const currentIdx = Number(tile.dataset.index);
      moveTileRelative(week, currentIdx, -1);
    });

    down.addEventListener('click', () => {
      const week = tile.dataset.week;
      const currentIdx = Number(tile.dataset.index);
      moveTileRelative(week, currentIdx, 1);
    });

    del.addEventListener('click', () => {
      const week = tile.dataset.week;
      const currentIdx = Number(tile.dataset.index);
      deleteTile(week, currentIdx);
    });

    tile.addEventListener('dragstart', (e) => {
      dragSrc = tile;
      tile.setAttribute('aria-grabbed', 'true');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          week: tile.dataset.week,
          index: Number(tile.dataset.index),
        }),
      );
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

      let from;
      try {
        from = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch {
        return;
      }

      const to = { week: tile.dataset.week, index: Number(tile.dataset.index) };
      if (from.week !== to.week) return; // keep it simple: no cross-week moves

      const insertAt = from.index < to.index ? to.index - 1 : to.index;
      if (moveTile(from.week, from.index, insertAt)) {
        render();
      }
    });
  }
}

// Events
newWeekBtn.addEventListener('click', newWeek);
exportBtn.addEventListener('click', exportJson);

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
render();
