const STORAGE_KEY = 'weekly-status-tracker:v2';
const API_STATE_ENDPOINT = '/api/state';
const SAVE_DEBOUNCE_MS = 300;

const TASK_STATUSES = ['not_started', 'in_progress', 'done'];
const TASK_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const TASK_SORT_MODES = ['priority', 'status', 'created_at'];

const TASK_COLUMN_DEFAULTS = Object.freeze({
  name: 440,
  status: 180,
  priority: 120,
});

const TASK_COLUMN_MIN = Object.freeze({
  name: 260,
  status: 140,
  priority: 100,
});

const TASK_COLUMN_KEYS = ['name', 'status', 'priority'];
const TASK_RESIZE_BREAKPOINT = 980;
const TASK_COLUMN_GAP_PX = 8;
const TASK_DELETE_COLUMN_PX = 34;

const STATUS_SORT_ORDER = {
  not_started: 0,
  in_progress: 1,
  done: 2,
};

const PRIORITY_SORT_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const nextWeekBtn = document.getElementById('nextWeekBtn');
const previousWeekBtn = document.getElementById('previousWeekBtn');
const tasksNavBtn = document.getElementById('tasksNavBtn');
const skillsNavBtn = document.getElementById('skillsNavBtn');
const weeklyNavBtn = document.getElementById('weeklyNavBtn');

const skillsAddBtn = document.getElementById('skillsAddBtn');
const skillsGrid = document.getElementById('skillsGrid');
const skillsEmptyHint = document.getElementById('skillsEmptyHint');

const addTaskBtn = document.getElementById('addTaskBtn');
const taskSortSelect = document.getElementById('taskSortSelect');
const tasksList = document.getElementById('tasksList');
const tasksEmptyHint = document.getElementById('tasksEmptyHint');
const tasksPanel = document.getElementById('tasksPanel');
const taskGridHead = document.getElementById('taskGridHead');
const taskResizeNameStatus = document.getElementById('taskResizeNameStatus');
const taskResizeStatusPriority = document.getElementById('taskResizeStatusPriority');

const weeksContainer = document.getElementById('weeksContainer');
const weekTemplate = document.getElementById('weekTemplate');
const tileTemplate = document.getElementById('tileTemplate');
const taskRowTemplate = document.getElementById('taskRowTemplate');
const skillTileTemplate = document.getElementById('skillTileTemplate');

const storageMode = document.getElementById('storageMode');

let stateCache = {
  weeks: {},
  tasks: [],
  taskSortMode: 'created_at',
  taskColumns: { ...TASK_COLUMN_DEFAULTS },
  skills: [],
};

let serverReachable = false;
let serverSaveTimer = null;
let dragSrc = null;
let skillDragSourceId = null;
let activeTaskResize = null;
let taskColumnLayoutRaf = null;

const pageMode = (() => {
  const explicit = document.body?.dataset.page;
  if (explicit === 'tasks' || explicit === 'skills' || explicit === 'weekly') {
    return explicit;
  }

  const pathname = (window.location.pathname || '').toLowerCase();
  if (pathname.endsWith('/weekly.html') || pathname.endsWith('weekly.html')) {
    return 'weekly';
  }

  if (pathname.endsWith('/skills.html') || pathname.endsWith('skills.html')) {
    return 'skills';
  }

  return 'tasks';
})();

function isTasksPage() {
  return pageMode === 'tasks';
}

function isSkillsPage() {
  return pageMode === 'skills';
}

function isWeeklyPage() {
  return pageMode === 'weekly';
}

function applyNavigationState() {
  const tasksActive = isTasksPage();
  const skillsActive = isSkillsPage();
  const weeklyActive = isWeeklyPage();

  if (tasksNavBtn) {
    tasksNavBtn.classList.toggle('is-active', tasksActive);
    tasksNavBtn.setAttribute('aria-current', tasksActive ? 'page' : 'false');
  }

  if (skillsNavBtn) {
    skillsNavBtn.classList.toggle('is-active', skillsActive);
    skillsNavBtn.setAttribute('aria-current', skillsActive ? 'page' : 'false');
  }

  if (weeklyNavBtn) {
    weeklyNavBtn.classList.toggle('is-active', weeklyActive);
    weeklyNavBtn.setAttribute('aria-current', weeklyActive ? 'page' : 'false');
  }

  if (weeklyActive) {
    document.title = 'Weekly Status - Weekly Status Tracker';
  } else if (skillsActive) {
    document.title = 'Skills - Weekly Status Tracker';
  } else {
    document.title = 'Tasks - Weekly Status Tracker';
  }
}

function isValidStateShape(candidate) {
  return Boolean(candidate && typeof candidate === 'object' && candidate.weeks && typeof candidate.weeks === 'object');
}

function generateTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


function generateSkillId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `skill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function isValidIsoDate(isoString) {
  return typeof isoString === 'string' && Number.isFinite(Date.parse(isoString));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTaskColumns(rawColumns) {
  const normalized = {};

  for (const key of TASK_COLUMN_KEYS) {
    const fallback = TASK_COLUMN_DEFAULTS[key];
    const maybe = rawColumns && typeof rawColumns[key] === 'number' ? rawColumns[key] : fallback;
    const safe = Number.isFinite(maybe) ? maybe : fallback;
    normalized[key] = Math.max(TASK_COLUMN_MIN[key], Math.round(safe));
  }

  return normalized;
}

function normalizeTask(task) {
  if (!task || typeof task !== 'object') {
    return null;
  }

  const id = typeof task.id === 'string' && task.id.trim() ? task.id : generateTaskId();
  const name = typeof task.name === 'string' ? task.name : '';
  const status = TASK_STATUSES.includes(task.status) ? task.status : 'not_started';
  const priority = TASK_PRIORITIES.includes(task.priority) ? task.priority : 'P0';
  const createdAt = isValidIsoDate(task.createdAt) ? task.createdAt : new Date().toISOString();

  return {
    id,
    name,
    status,
    priority,
    createdAt,
  };
}

function normalizeSkill(skill) {
  if (!skill || typeof skill !== "object") {
    return null;
  }

  const id = typeof skill.id === "string" && skill.id.trim() ? skill.id : generateSkillId();
  const title = typeof skill.title === "string" ? skill.title : "";
  const text = typeof skill.text === "string" ? skill.text : "";
  const createdAt = isValidIsoDate(skill.createdAt) ? skill.createdAt : new Date().toISOString();

  return {
    id,
    title,
    text,
    createdAt,
  };
}

function normalizeState(candidate) {
  const normalizedWeeks =
    candidate && typeof candidate.weeks === "object" && candidate.weeks !== null
      ? candidate.weeks
      : {};

  const rawTasks = Array.isArray(candidate?.tasks) ? candidate.tasks : [];
  const seenTaskIds = new Set();
  const normalizedTasks = [];

  for (const rawTask of rawTasks) {
    const task = normalizeTask(rawTask);
    if (!task) continue;

    let taskId = task.id;
    while (seenTaskIds.has(taskId)) {
      taskId = generateTaskId();
    }

    seenTaskIds.add(taskId);
    normalizedTasks.push({ ...task, id: taskId });
  }

  const rawSkills = Array.isArray(candidate?.skills) ? candidate.skills : [];
  const seenSkillIds = new Set();
  const normalizedSkills = [];

  for (const rawSkill of rawSkills) {
    const skill = normalizeSkill(rawSkill);
    if (!skill) continue;

    let skillId = skill.id;
    while (seenSkillIds.has(skillId)) {
      skillId = generateSkillId();
    }

    seenSkillIds.add(skillId);
    normalizedSkills.push({ ...skill, id: skillId });
  }

  const normalizedSortMode = TASK_SORT_MODES.includes(candidate?.taskSortMode)
    ? candidate.taskSortMode
    : "created_at";

  return {
    weeks: normalizedWeeks,
    tasks: normalizedTasks,
    taskSortMode: normalizedSortMode,
    taskColumns: normalizeTaskColumns(candidate?.taskColumns),
    skills: normalizedSkills,
  };
}

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
  const d = new Date(`${weekStartISO}T00:00:00`);
  const end = addDays(d, 6);
  return `Week of ${weekStartISO} -> ${isoDate(end)}`;
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidStateShape(parsed)) {
        return normalizeState(parsed);
      }
    }
  } catch {}

  // One-time migration from v1 if present.
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

      const migrated = normalizeState({ weeks });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}

  return normalizeState({ weeks: {} });
}

function saveLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadServerState() {
  const response = await fetch(API_STATE_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);

  const parsed = await response.json();
  if (!isValidStateShape(parsed)) throw new Error('Invalid server state');

  return normalizeState(parsed);
}

function updateStorageMode() {
  if (!storageMode) return;

  storageMode.textContent = serverReachable
    ? 'Project file data/weekly-status.json'
    : 'Browser localStorage (fallback)';
}

function setServerReachable(isReachable) {
  serverReachable = isReachable;
  updateStorageMode();
}

function scheduleServerSave(state) {
  if (!serverReachable) return;

  if (serverSaveTimer) {
    clearTimeout(serverSaveTimer);
  }

  const payload = JSON.stringify(state);

  serverSaveTimer = setTimeout(async () => {
    try {
      const response = await fetch(API_STATE_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch {
      setServerReachable(false);
    }
  }, SAVE_DEBOUNCE_MS);
}

function saveState(state) {
  stateCache = normalizeState(state);
  saveLocalState(stateCache);
  scheduleServerSave(stateCache);
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

function getWeekBounds(state) {
  const weeks = getAllWeeksSorted(state);
  return {
    newestISO: weeks[0] || null,
    oldestISO: weeks[weeks.length - 1] || null,
  };
}

function createWeekAtISO(weekStartISO) {
  const state = stateCache;
  ensureWeek(state, weekStartISO);
  saveState(state);
  render();
  return weekStartISO;
}

function createTile(text = '') {
  const node = tileTemplate.content.firstElementChild.cloneNode(true);
  const body = node.querySelector('.tile-body');
  body.textContent = text;
  return node;
}

function getTaskColumnsMinTotal() {
  return TASK_COLUMN_MIN.name + TASK_COLUMN_MIN.status + TASK_COLUMN_MIN.priority;
}

function fitTaskColumnsToWidth(columns, availableWidth) {
  const normalized = normalizeTaskColumns(columns);

  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return normalized;
  }

  const minTotal = getTaskColumnsMinTotal();
  if (availableWidth <= minTotal) {
    return { ...TASK_COLUMN_MIN };
  }

  const total = normalized.name + normalized.status + normalized.priority;
  if (total <= availableWidth) {
    return normalized;
  }

  const overflow = total - availableWidth;
  const room = {
    name: normalized.name - TASK_COLUMN_MIN.name,
    status: normalized.status - TASK_COLUMN_MIN.status,
    priority: normalized.priority - TASK_COLUMN_MIN.priority,
  };

  const totalRoom = room.name + room.status + room.priority;
  if (totalRoom <= 0) {
    return { ...TASK_COLUMN_MIN };
  }

  const adjusted = {};
  for (const key of TASK_COLUMN_KEYS) {
    const roomShare = room[key] > 0 ? (overflow * room[key]) / totalRoom : 0;
    adjusted[key] = normalized[key] - roomShare;
  }

  for (const key of TASK_COLUMN_KEYS) {
    adjusted[key] = Math.max(TASK_COLUMN_MIN[key], Math.round(adjusted[key]));
  }

  const cappedWidth = Math.floor(availableWidth);
  let adjustedTotal = adjusted.name + adjusted.status + adjusted.priority;

  while (adjustedTotal > cappedWidth) {
    let changed = false;

    for (const key of TASK_COLUMN_KEYS) {
      if (adjustedTotal <= cappedWidth) break;
      if (adjusted[key] > TASK_COLUMN_MIN[key]) {
        adjusted[key] -= 1;
        adjustedTotal -= 1;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return adjusted;
}

function applyTaskColumnStyles(columns) {
  if (!tasksPanel) return;

  const next = normalizeTaskColumns(columns);
  tasksPanel.style.setProperty('--task-col-name', `${next.name}px`);
  tasksPanel.style.setProperty('--task-col-status', `${next.status}px`);
  tasksPanel.style.setProperty('--task-col-priority', `${next.priority}px`);
}

function getTaskColumnAvailableWidth() {
  if (!taskGridHead) return null;

  const headWidth = taskGridHead.clientWidth;
  if (!Number.isFinite(headWidth) || headWidth <= 0) return null;

  const available = headWidth - TASK_DELETE_COLUMN_PX - TASK_COLUMN_GAP_PX * 3;
  return Math.max(getTaskColumnsMinTotal(), available);
}

function isTaskResizeEnabled() {
  return Boolean(tasksPanel && taskGridHead && window.innerWidth > TASK_RESIZE_BREAKPOINT);
}

function syncTaskColumnLayout() {
  if (!tasksPanel) return;

  const preferred = normalizeTaskColumns(stateCache.taskColumns);

  if (!isTaskResizeEnabled()) {
    applyTaskColumnStyles(preferred);
    return;
  }

  const available = getTaskColumnAvailableWidth();
  const fitted = fitTaskColumnsToWidth(preferred, available);
  applyTaskColumnStyles(fitted);
}

function scheduleTaskColumnLayoutSync() {
  if (taskColumnLayoutRaf) {
    cancelAnimationFrame(taskColumnLayoutRaf);
  }

  taskColumnLayoutRaf = requestAnimationFrame(() => {
    taskColumnLayoutRaf = null;
    syncTaskColumnLayout();
  });
}

function normalizePairResize(startLeft, startRight, delta, minLeft, minRight) {
  const total = startLeft + startRight;
  const minBound = minLeft;
  const maxBound = total - minRight;
  const left = clamp(startLeft + delta, minBound, maxBound);
  const right = total - left;

  return {
    left: Math.round(left),
    right: Math.round(right),
  };
}

function endTaskResize(pointerId) {
  if (!activeTaskResize) return null;
  if (pointerId !== null && pointerId !== activeTaskResize.pointerId) return null;

  const { handleEl, pointerId: activePointerId, currentColumns, startColumns } = activeTaskResize;

  if (handleEl?.hasPointerCapture?.(activePointerId)) {
    handleEl.releasePointerCapture(activePointerId);
  }

  handleEl?.classList.remove('is-active');
  tasksPanel?.classList.remove('is-resizing');

  window.removeEventListener('pointermove', onTaskResizePointerMove);
  window.removeEventListener('pointerup', onTaskResizePointerUp);
  window.removeEventListener('pointercancel', onTaskResizePointerUp);

  activeTaskResize = null;

  return normalizeTaskColumns(currentColumns || startColumns);
}

function onTaskResizePointerMove(event) {
  if (!activeTaskResize || event.pointerId !== activeTaskResize.pointerId) return;

  const delta = event.clientX - activeTaskResize.startX;
  const nextColumns = { ...activeTaskResize.startColumns };

  if (activeTaskResize.mode === 'name_status') {
    const pair = normalizePairResize(
      activeTaskResize.startColumns.name,
      activeTaskResize.startColumns.status,
      delta,
      TASK_COLUMN_MIN.name,
      TASK_COLUMN_MIN.status,
    );

    nextColumns.name = pair.left;
    nextColumns.status = pair.right;
  } else {
    const pair = normalizePairResize(
      activeTaskResize.startColumns.status,
      activeTaskResize.startColumns.priority,
      delta,
      TASK_COLUMN_MIN.status,
      TASK_COLUMN_MIN.priority,
    );

    nextColumns.status = pair.left;
    nextColumns.priority = pair.right;
  }

  activeTaskResize.currentColumns = nextColumns;
  applyTaskColumnStyles(nextColumns);
}

function onTaskResizePointerUp(event) {
  const finalColumns = endTaskResize(event.pointerId);
  if (!finalColumns) return;

  const state = stateCache;
  state.taskColumns = finalColumns;
  saveState(state);
  syncTaskColumnLayout();
}

function beginTaskResize(mode, handleEl, event) {
  if (!handleEl || !isTaskResizeEnabled()) return;
  if (event.button !== 0) return;

  event.preventDefault();

  const available = getTaskColumnAvailableWidth();
  const startColumns = fitTaskColumnsToWidth(stateCache.taskColumns, available);

  tasksPanel?.classList.add('is-resizing');
  handleEl.classList.add('is-active');

  if (handleEl.setPointerCapture) {
    handleEl.setPointerCapture(event.pointerId);
  }

  activeTaskResize = {
    mode,
    handleEl,
    pointerId: event.pointerId,
    startX: event.clientX,
    startColumns,
    currentColumns: startColumns,
  };

  applyTaskColumnStyles(startColumns);

  window.addEventListener('pointermove', onTaskResizePointerMove);
  window.addEventListener('pointerup', onTaskResizePointerUp);
  window.addEventListener('pointercancel', onTaskResizePointerUp);
}

function createTask() {
  return {
    id: generateTaskId(),
    name: '',
    status: 'not_started',
    priority: 'P0',
    createdAt: new Date().toISOString(),
  };
}

function autoGrowTaskNameInput(nameInput) {
  if (!(nameInput instanceof HTMLTextAreaElement)) return;

  nameInput.style.height = '0px';
  const nextHeight = Math.max(34, nameInput.scrollHeight);
  nameInput.style.height = `${nextHeight}px`;
}

function addTask() {
  const state = stateCache;
  const task = createTask();
  state.tasks.push(task);
  saveState(state);
  render();
  return task.id;
}

function focusTaskName(taskId) {
  if (!tasksList) return;

  const input = tasksList.querySelector(`[data-task-id="${CSS.escape(taskId)}"] .task-name-input`);
  if (!input) return;

  input.focus();

  if (typeof input.setSelectionRange === 'function') {
    const len = typeof input.value === 'string' ? input.value.length : 0;
    input.setSelectionRange(len, len);
  }
}

function updateTask(taskId, patch, shouldRender = false) {
  const state = stateCache;
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
    task.name = typeof patch.name === 'string' ? patch.name : String(patch.name ?? '');
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'status') && TASK_STATUSES.includes(patch.status)) {
    task.status = patch.status;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'priority') && TASK_PRIORITIES.includes(patch.priority)) {
    task.priority = patch.priority;
  }

  saveState(state);

  if (shouldRender) {
    render();
  }
}

function deleteTask(taskId) {
  const state = stateCache;
  const idx = state.tasks.findIndex((task) => task.id === taskId);
  if (idx === -1) return;

  state.tasks.splice(idx, 1);
  saveState(state);
  render();
}

function compareCreatedAtDesc(leftTask, rightTask) {
  const leftTime = Date.parse(leftTask.createdAt);
  const rightTime = Date.parse(rightTask.createdAt);

  const leftSafe = Number.isFinite(leftTime) ? leftTime : 0;
  const rightSafe = Number.isFinite(rightTime) ? rightTime : 0;

  return rightSafe - leftSafe;
}

function getSortedTasks(tasks, sortMode) {
  const decorated = tasks.map((task, index) => ({ task, index }));

  decorated.sort((left, right) => {
    let primary = 0;

    if (sortMode === 'priority') {
      primary = PRIORITY_SORT_ORDER[left.task.priority] - PRIORITY_SORT_ORDER[right.task.priority];
    } else if (sortMode === 'status') {
      primary = STATUS_SORT_ORDER[left.task.status] - STATUS_SORT_ORDER[right.task.status];
    } else {
      primary = compareCreatedAtDesc(left.task, right.task);
    }

    if (primary !== 0) return primary;

    const createdAtTieBreak = compareCreatedAtDesc(left.task, right.task);
    if (createdAtTieBreak !== 0) return createdAtTieBreak;

    return left.index - right.index;
  });

  return decorated.map((entry) => entry.task);
}

function setTaskSortMode(mode) {
  if (!TASK_SORT_MODES.includes(mode)) return;
  if (stateCache.taskSortMode === mode) return;

  const state = stateCache;
  state.taskSortMode = mode;
  saveState(state);
  render();
}

function renderTasks() {
  if (!tasksList || !taskRowTemplate) return;

  const state = stateCache;
  const sortedTasks = getSortedTasks(state.tasks, state.taskSortMode);

  if (taskSortSelect && taskSortSelect.value !== state.taskSortMode) {
    taskSortSelect.value = state.taskSortMode;
  }

  tasksList.innerHTML = '';

  for (const task of sortedTasks) {
    const row = taskRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.taskId = task.id;
    row.dataset.status = task.status;
    row.dataset.priority = task.priority;

    const nameInput = row.querySelector('.task-name-input');
    const statusSelect = row.querySelector('.task-status-select');
    const prioritySelect = row.querySelector('.task-priority-select');
    const deleteBtn = row.querySelector('[data-action="delete-task"]');

    nameInput.value = task.name;
    statusSelect.value = task.status;
    statusSelect.dataset.status = task.status;
    prioritySelect.value = task.priority;
    prioritySelect.dataset.priority = task.priority;

    autoGrowTaskNameInput(nameInput);

    nameInput.addEventListener('input', () => {
      autoGrowTaskNameInput(nameInput);
      updateTask(task.id, { name: nameInput.value }, false);
    });

    nameInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.shiftKey || event.isComposing) return;

      event.preventDefault();
      const newTaskId = addTask();
      focusTaskName(newTaskId);
    });

    statusSelect.addEventListener('change', () => {
      statusSelect.dataset.status = statusSelect.value;
      updateTask(task.id, { status: statusSelect.value }, true);
    });

    prioritySelect.addEventListener('change', () => {
      prioritySelect.dataset.priority = prioritySelect.value;
      updateTask(task.id, { priority: prioritySelect.value }, true);
    });

    deleteBtn.addEventListener('click', () => {
      deleteTask(task.id);
    });

    tasksList.appendChild(row);
  }

  if (tasksEmptyHint) {
    tasksEmptyHint.hidden = sortedTasks.length > 0;
  }
}


function createSkillTile() {
  return {
    id: generateSkillId(),
    title: "",
    text: "",
    createdAt: new Date().toISOString(),
  };
}

function autoGrowSkillTextInput(textInput) {
  if (!(textInput instanceof HTMLTextAreaElement)) return;

  textInput.style.height = "0px";
  const nextHeight = Math.max(232, textInput.scrollHeight);
  textInput.style.height = `${nextHeight}px`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to a legacy copy path when clipboard permissions are restricted.
    }
  }

  const scratch = document.createElement("textarea");
  scratch.value = text;
  scratch.setAttribute("readonly", "true");
  scratch.style.position = "fixed";
  scratch.style.top = "-9999px";
  scratch.style.left = "-9999px";
  scratch.style.opacity = "0";
  document.body.appendChild(scratch);
  scratch.focus();
  scratch.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  scratch.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}

function flashSkillCopyStatus(copyBtn, nextLabel) {
  if (!copyBtn) return;

  copyBtn.textContent = nextLabel;

  window.clearTimeout(copyBtn._copyLabelTimer);
  copyBtn._copyLabelTimer = window.setTimeout(() => {
    copyBtn.textContent = "Copy";
  }, 1000);
}

function focusSkillTitle(skillId) {
  if (!skillsGrid) return;

  const input = skillsGrid.querySelector(`[data-skill-id=\"${CSS.escape(skillId)}\"] .skill-title-input`);
  if (!input) return;

  input.focus();
  if (typeof input.setSelectionRange === "function") {
    const end = typeof input.value === "string" ? input.value.length : 0;
    input.setSelectionRange(end, end);
  }
}

function addSkillTile() {
  const state = stateCache;
  const skill = createSkillTile();
  state.skills.push(skill);
  saveState(state);
  render();
  return skill.id;
}

function updateSkillTile(skillId, patch, shouldRender = false) {
  const state = stateCache;
  const skill = state.skills.find((item) => item.id === skillId);
  if (!skill) return;

  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    skill.title = typeof patch.title === "string" ? patch.title : String(patch.title ?? "");
  }

  if (Object.prototype.hasOwnProperty.call(patch, "text")) {
    skill.text = typeof patch.text === "string" ? patch.text : String(patch.text ?? "");
  }

  saveState(state);

  if (shouldRender) {
    render();
  }
}

function deleteSkillTile(skillId) {
  const state = stateCache;
  const idx = state.skills.findIndex((skill) => skill.id === skillId);
  if (idx === -1) return;

  state.skills.splice(idx, 1);
  saveState(state);
  render();
}

function moveSkillTile(fromIndex, toIndex) {
  const state = stateCache;
  const arr = state.skills;

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= arr.length ||
    toIndex >= arr.length ||
    fromIndex === toIndex
  ) {
    return false;
  }

  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  saveState(state);
  return true;
}

function clearSkillDropTargets() {
  if (!skillsGrid) return;
  skillsGrid.querySelectorAll(".skill-tile.is-drop-target").forEach((node) => {
    node.classList.remove("is-drop-target");
  });
}

function renderSkills() {
  if (!skillsGrid || !skillTileTemplate) return;

  const state = stateCache;
  skillsGrid.innerHTML = "";

  for (const skill of state.skills) {
    const tile = skillTileTemplate.content.firstElementChild.cloneNode(true);
    tile.dataset.skillId = skill.id;

    const dragHandle = tile.querySelector(".skill-drag");
    const titleInput = tile.querySelector(".skill-title-input");
    const textInput = tile.querySelector(".skill-text-input");
    const copyBtn = tile.querySelector("[data-action=\"copy-skill\"]");
    const deleteBtn = tile.querySelector("[data-action=\"delete-skill\"]");

    titleInput.value = skill.title;
    textInput.value = skill.text;
    autoGrowSkillTextInput(textInput);

    titleInput.addEventListener("input", () => {
      updateSkillTile(skill.id, { title: titleInput.value }, false);
    });

    textInput.addEventListener("input", () => {
      autoGrowSkillTextInput(textInput);
      updateSkillTile(skill.id, { text: textInput.value }, false);
    });

    textInput.addEventListener("paste", () => {
      window.setTimeout(() => {
        autoGrowSkillTextInput(textInput);
        updateSkillTile(skill.id, { text: textInput.value }, false);
      }, 0);
    });

    copyBtn.addEventListener("click", async () => {
      const textToCopy = textInput.value ?? "";

      try {
        await copyTextToClipboard(textToCopy);
        flashSkillCopyStatus(copyBtn, "Copied");
      } catch {
        flashSkillCopyStatus(copyBtn, "Failed");
      }
    });

    deleteBtn.addEventListener("click", () => {
      deleteSkillTile(skill.id);
    });

    dragHandle.addEventListener("dragstart", (event) => {
      skillDragSourceId = skill.id;
      tile.classList.add("is-grabbed");
      clearSkillDropTargets();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", skill.id);
    });

    dragHandle.addEventListener("dragend", () => {
      tile.classList.remove("is-grabbed");
      clearSkillDropTargets();
      skillDragSourceId = null;
    });

    tile.addEventListener("dragover", (event) => {
      const sourceId = skillDragSourceId || event.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === skill.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      tile.classList.add("is-drop-target");
    });

    tile.addEventListener("dragleave", () => {
      tile.classList.remove("is-drop-target");
    });

    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      tile.classList.remove("is-drop-target");

      const sourceId = skillDragSourceId || event.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === skill.id) return;

      const fromIndex = stateCache.skills.findIndex((item) => item.id === sourceId);
      const toIndex = stateCache.skills.findIndex((item) => item.id === skill.id);
      if (fromIndex === -1 || toIndex === -1) return;

      const insertAt = toIndex;
      if (moveSkillTile(fromIndex, insertAt)) {
        render();
      }
    });

    skillsGrid.appendChild(tile);
  }

  if (skillsEmptyHint) {
    skillsEmptyHint.hidden = state.skills.length > 0;
  }
}
function renderWeekSection(weekStartISO, weekData) {
  const section = weekTemplate.content.firstElementChild.cloneNode(true);
  section.dataset.week = weekStartISO;

  const tileCount = weekData.tiles.length;
  const tileLabel = tileCount === 1 ? 'tile' : 'tiles';

  section.querySelector('.week-title').textContent = fmtWeekLabel(weekStartISO);
  section.querySelector('.week-meta').textContent = `${tileCount} ${tileLabel}`;

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
      <div class="tile-bar"><span class="drag-wrap"><span class="drag"> </span><span class="drag-label">empty</span></span></div>
      <div class="tile-body" style="color: var(--text-3)">Add a tile, then write your sections (for example, 'Last week' and 'Next week').</div>
    `;
    hint.style.opacity = '0.84';
    hint.style.borderStyle = 'dashed';
    listEl.appendChild(hint);
  }

  section.querySelector('[data-action="add"]').addEventListener('click', () => {
    addTileToWeek(weekStartISO);
  });

  section.querySelector('[data-action="delete-week"]').addEventListener('click', () => {
    deleteWeek(weekStartISO);
  });

  wireWeekList(listEl);

  return section;
}

function renderWeeklyTracker() {
  if (!weeksContainer || !weekTemplate || !tileTemplate) return;

  const state = stateCache;
  let weeks = getAllWeeksSorted(state);

  // Keep first-run experience simple: start with this week when empty.
  if (weeks.length === 0) {
    const thisWeek = isoDate(startOfWeek());
    ensureWeek(state, thisWeek);
    saveState(state);
    weeks = getAllWeeksSorted(state);
  }

  weeksContainer.innerHTML = '';

  weeks.forEach((weekKey, idx) => {
    const section = renderWeekSection(weekKey, state.weeks[weekKey]);
    section.style.setProperty('--stagger', String(idx));
    weeksContainer.appendChild(section);
  });
}

function renderTasksPage() {
  renderTasks();
  scheduleTaskColumnLayoutSync();
}

function renderSkillsPage() {
  renderSkills();
}

function render() {
  if (isWeeklyPage()) {
    renderWeeklyTracker();
  }

  if (isTasksPage()) {
    renderTasksPage();
  }

  if (isSkillsPage()) {
    renderSkillsPage();
  }
}

function addTileToWeek(weekStartISO) {
  const state = stateCache;
  ensureWeek(state, weekStartISO);
  state.weeks[weekStartISO].tiles.unshift({ text: '' });
  saveState(state);
  render();

  // Focus first editable tile of that week.
  const section = weeksContainer?.querySelector(`[data-week="${CSS.escape(weekStartISO)}"]`);
  const first = section?.querySelector('.tile .tile-body');
  first?.focus();
}

function deleteWeek(weekStartISO) {
  const state = stateCache;
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
  const state = stateCache;
  const week = state.weeks[weekStartISO];
  if (!week) return;

  week.tiles.splice(idx, 1);
  saveState(state);
  render();
}

function updateTileText(weekStartISO, idx, text) {
  const state = stateCache;
  const week = state.weeks[weekStartISO];
  if (!week || !week.tiles[idx]) return;

  week.tiles[idx].text = text;
  saveState(state);
}

function moveTile(weekStartISO, fromIdx, toIdx) {
  const state = stateCache;
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

function addNextWeek() {
  const state = stateCache;
  const { newestISO } = getWeekBounds(state);
  const baseISO = newestISO || isoDate(startOfWeek());
  const nextISO = isoDate(addDays(new Date(`${baseISO}T00:00:00`), 7));

  createWeekAtISO(nextISO);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addPreviousWeek() {
  const state = stateCache;
  const { oldestISO } = getWeekBounds(state);
  const baseISO = oldestISO || isoDate(startOfWeek());
  const previousISO = isoDate(addDays(new Date(`${baseISO}T00:00:00`), -7));

  createWeekAtISO(previousISO);

  const previousSection = weeksContainer?.querySelector(`[data-week="${CSS.escape(previousISO)}"]`);
  if (previousSection) {
    previousSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
  } else {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
}

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

if (nextWeekBtn) {
  nextWeekBtn.addEventListener('click', addNextWeek);
}

if (previousWeekBtn) {
  previousWeekBtn.addEventListener('click', addPreviousWeek);
}

if (skillsAddBtn) {
  skillsAddBtn.addEventListener('click', () => {
    const skillId = addSkillTile();
    focusSkillTitle(skillId);
  });
}

if (addTaskBtn) {
  addTaskBtn.addEventListener('click', () => {
    const taskId = addTask();
    focusTaskName(taskId);
  });
}

if (taskSortSelect) {
  taskSortSelect.addEventListener('change', () => {
    setTaskSortMode(taskSortSelect.value);
  });
}

if (taskResizeNameStatus) {
  taskResizeNameStatus.addEventListener('pointerdown', (event) => {
    beginTaskResize('name_status', taskResizeNameStatus, event);
  });
}

if (taskResizeStatusPriority) {
  taskResizeStatusPriority.addEventListener('pointerdown', (event) => {
    beginTaskResize('status_priority', taskResizeStatusPriority, event);
  });
}

if (tasksPanel) {
  window.addEventListener('resize', scheduleTaskColumnLayoutSync);
}

async function initialize() {
  stateCache = loadLocalState();

  try {
    const serverState = await loadServerState();
    stateCache = serverState;
    saveLocalState(stateCache);
    setServerReachable(true);
  } catch {
    setServerReachable(false);
  }

  applyNavigationState();
  render();
}

initialize();
