/**
 * FlexiFocus Popup UI
 * Timer display, controls, task management, and theme toggle
 */

import { formatTime, formatDuration, capitalize } from '../../shared/utils.js';
import * as timerLogic from '../../services/timer.js';

/**
 * DOM element references with safe getters
 */
const els = {
  method: document.getElementById('method'),
  time: document.getElementById('time'),
  phase: document.getElementById('phase'),
  ring: document.getElementById('ring'),
  primary: document.getElementById('primary'),
  secondary: document.getElementById('secondary'),
  flowComplete: document.getElementById('flow-complete'),
  status: document.getElementById('status'),
  taskList: document.getElementById('task-list'),
  taskForm: document.getElementById('task-form'),
  taskTitle: document.getElementById('task-title'),
  taskEstimate: document.getElementById('task-estimate'),
  history: document.getElementById('history'),
  refresh: document.getElementById('refresh'),
  themeToggle: document.getElementById('theme-toggle'),
  stats: document.getElementById('stats'),
  exportData: document.getElementById('export-data'),
  shortcutsHelp: document.getElementById('shortcuts-help'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  closeModal: document.getElementById('close-modal'),
};

/**
 * Validate that all required DOM elements exist
 * @throws {Error} If any critical element is missing
 */
function validateDOMElements() {
  const required = [
    'method',
    'time',
    'phase',
    'ring',
    'primary',
    'secondary',
    'status',
    'taskList',
    'history',
  ];
  for (const key of required) {
    if (!els[key]) {
      console.error(`Critical DOM element missing: ${key}`);
      throw new Error(`DOM initialization failed: ${key} element not found`);
    }
  }
}

let appState = {
  state: null,
  settings: null,
  methods: {},
};

let ticker = null;

init();

/**
 * Initialize popup - validate DOM, fetch state, set up listeners
 */
function init() {
  try {
    validateDOMElements();
    fetchState();
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'stateUpdated') {
        appState = {
          state: msg.state,
          settings: msg.settings,
          methods: msg.methods,
        };
        render();
      }
    });

    applyThemeFromSettings();

    if (els.method) {
      els.method.addEventListener('change', async () => {
        await chrome.runtime.sendMessage({
          type: 'setMethod',
          methodKey: els.method.value,
        });
      });
    }

    els.primary?.addEventListener('click', handlePrimary);
    els.secondary?.addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'resetTimer' })
    );
    els.flowComplete?.addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'completeFlowtime' })
    );
    els.refresh?.addEventListener('click', fetchState);
    els.themeToggle?.addEventListener('click', toggleTheme);
    els.exportData?.addEventListener('click', exportData);
    els.shortcutsHelp?.addEventListener('click', showShortcuts);
    els.closeModal?.addEventListener('click', hideShortcuts);

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.shortcutsModal && !els.shortcutsModal.classList.contains('hidden')) {
        hideShortcuts();
      }
    });

    els.taskForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = els.taskTitle.value.trim();
      if (!title) {
        return;
      }
      const estimate = Number(els.taskEstimate.value) || 1;
      await chrome.runtime.sendMessage({ type: 'addTask', title, estimate });
      els.taskTitle.value = '';
      els.taskEstimate.value = 1;
      fetchState();
    });
  } catch (error) {
    console.error('Initialization failed:', error);
    document.body.textContent = 'Failed to load FlexiFocus. Please refresh the page.';
  }
}

/**
 * Fetch current state and settings from service worker
 */
async function fetchState() {
  const res = await chrome.runtime.sendMessage({ type: 'getState' });
  appState = { state: res.state, settings: res.settings, methods: res.methods };
  applyThemeFromSettings();
  render(res.remaining);
}

/**
 * Re-render entire UI based on current state
 * @param {number} initialRemaining - Optional override for remaining time
 */
function render(initialRemaining) {
  const { state, settings, methods } = appState;
  if (!state || !settings) {
    return;
  }
  renderMethods(methods, state.timer.methodKey);
  renderTimer(state, methods, initialRemaining);
  renderTasks(state.tasks, state.timer.activeTaskId);
  renderHistory(state.history, methods);
  renderStatistics(state.statistics);
  updateThemeToggle();
}

/**
 * Render method dropdown options
 * @param {Object} methods - Available timer methods
 * @param {string} selected - Currently selected method key
 */
function renderMethods(methods, selected) {
  if (!els.method) {
    return;
  }
  els.method.innerHTML = '';
  Object.values(methods).forEach((method) => {
    const opt = document.createElement('option');
    opt.value = method.key;
    opt.textContent = method.label;
    if (method.key === selected) {
      opt.selected = true;
    }
    els.method.append(opt);
  });
}

/**
 * Render timer display with progress ring
 * @param {Object} state - Application state
 * @param {Object} methods - Available timer methods
 * @param {number} initialRemaining - Optional override for remaining time
 */
function renderTimer(state, methods, initialRemaining) {
  const timer = state.timer;
  const method = methods[timer.methodKey] || methods.pomodoro;
  const remainingMs = computeRemaining(timer, method, initialRemaining);
  const duration = timerLogic.computePhaseDuration(method, timer.phase);
  const flowReference = timerLogic.getFlowReferenceMs(method);
  const progress = method.flexible
    ? Math.max(0, Math.min(1, remainingMs / flowReference))
    : duration > 0
      ? Math.max(0, Math.min(1, remainingMs / duration))
      : 0;
  els.ring.style.setProperty('--progress', `${progress * 100}%`);

  els.time.textContent = formatTime(remainingMs);
  els.phase.textContent = timerLogic.getPhaseLabel(timer.phase, method);
  els.status.textContent = buildStatus(timer, method);

  const isRunning = timer.isRunning;
  const shouldResume = !isRunning && (timer.remainingMs > 0 || timer.phase !== 'work');
  els.primary.innerHTML = isRunning
    ? '<img src="../assets/pause.svg" width="16" height="16"> Pause'
    : shouldResume
      ? '<img src="../assets/play.svg" width="16" height="16"> Resume'
      : '<img src="../assets/play.svg" width="16" height="16"> Start';
  els.secondary.innerHTML = '<img src="../assets/reset.svg" width="16" height="16"> Reset';
  els.flowComplete.classList.toggle('hidden', timer.methodKey !== 'flowtime' || !isRunning);

  if (ticker) {
    clearInterval(ticker);
  }
  ticker = setInterval(() => {
    const { state, methods } = appState;
    if (!state?.timer) {
      return;
    }
    const method = methods[state.timer.methodKey] || methods.pomodoro;
    const remaining = computeRemaining(state.timer, method);
    const duration = timerLogic.computePhaseDuration(method, state.timer.phase);
    const flowReference = timerLogic.getFlowReferenceMs(method);
    const pct = method.flexible
      ? Math.max(0, Math.min(1, remaining / flowReference))
      : duration > 0
        ? Math.max(0, Math.min(1, remaining / duration))
        : 0;
    els.ring.style.setProperty('--progress', `${pct * 100}%`);
    els.time.textContent = formatTime(remaining);
  }, 1000);
}

/**
 * Handle primary button (Start/Pause/Resume)
 */
function handlePrimary() {
  const { state } = appState;
  if (!state) {
    return;
  }
  if (state.timer.isRunning) {
    chrome.runtime.sendMessage({ type: 'pauseTimer' });
    return;
  }

  if (state.timer.remainingMs > 0 || state.timer.phase !== 'work') {
    chrome.runtime.sendMessage({ type: 'resumeTimer' });
    return;
  }

  const methodKey = els.method.value;
  chrome.runtime.sendMessage({
    type: 'startTimer',
    methodKey,
    phase: state.timer.phase,
  });
}

/**
 * Compute duration for current timer and phase
 * @param {Object} timer - Timer state
 * @param {Object} method - Method configuration
 * @returns {number} Duration in milliseconds
 */
function computeDuration(timer, method) {
  if (method.flexible) {
    const elapsed = timer.isRunning
      ? Math.max(0, Date.now() - (timer.startTime || Date.now()))
      : timer.remainingMs || 0;
    return Math.max(1, elapsed);
  }
  if (timer.endTime && timer.startTime) {
    return timer.endTime - timer.startTime;
  }
  if (timer.remainingMs) {
    return timer.remainingMs;
  }
  if (timer.phase === 'work') {
    return method.workMinutes * 60000;
  }
  if (timer.phase === 'longBreak') {
    return method.longBreakMinutes * 60000;
  }
  return method.shortBreakMinutes * 60000;
}

/**
 * Compute remaining time for current timer
 * @param {Object} timer - Timer state
 * @param {Object} method - Method configuration
 * @param {number} overrideRemaining - Optional override value
 * @returns {number} Remaining milliseconds
 */
function computeRemaining(timer, method, overrideRemaining) {
  if (typeof overrideRemaining === 'number') {
    return overrideRemaining;
  }
  if (method.flexible) {
    if (!timer.isRunning) {
      return timer.remainingMs || 0;
    }
    return Math.max(0, Date.now() - (timer.startTime || Date.now()));
  }
  if (timer.isRunning && timer.endTime) {
    return Math.max(0, timer.endTime - Date.now());
  }
  if (!timer.isRunning && timer.remainingMs) {
    return timer.remainingMs;
  }
  const duration = timerLogic.computePhaseDuration(method, timer.phase);
  return Math.max(0, timer.endTime ? timer.endTime - Date.now() : duration);
}

/**
 * Build status message for current phase
 * @param {Object} timer - Timer state
 * @param {Object} method - Method configuration
 * @returns {string} Status message
 */
function buildStatus(timer, method) {
  if (method.flexible) {
    return timer.isRunning
      ? 'Flowtime running - end when you feel ready.'
      : 'Start flow and end to calculate break.';
  }
  if (timer.phase === 'work') {
    return 'Focus block in progress';
  }
  return 'Recharge break';
}

/**
 * Render task list with progress indicators
 * @param {Array} tasks - Task list
 * @param {string} activeTaskId - Currently focused task ID
 */
function renderTasks(tasks = [], activeTaskId) {
  if (!tasks.length) {
    els.taskList.textContent = 'No tasks yet';
    els.taskList.classList.add('empty-state');
    return;
  }
  els.taskList.innerHTML = '';
  els.taskList.classList.remove('empty-state');
  tasks.forEach((task) => {
    const row = document.createElement('div');
    row.className = 'task';
    row.setAttribute('role', 'listitem');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', `Mark ${task.title} as ${task.done ? 'incomplete' : 'complete'}`);
    checkbox.addEventListener('change', () => {
      chrome.runtime.sendMessage({
        type: 'updateTask',
        id: task.id,
        updates: { done: !task.done },
      });
    });

    const text = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'task-title';
    title.textContent = task.title;
    if (task.done) {
      title.style.textDecoration = 'line-through';
    }
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = `${task.completedSessions ?? 0}/${task.estimate ?? 1} sessions`;
    text.append(title, meta);

    const actions = document.createElement('div');
    const focusBtn = document.createElement('button');
    focusBtn.className = 'btn tiny';
    focusBtn.textContent = task.id === activeTaskId ? 'Active' : 'Focus';
    focusBtn.setAttribute('aria-label', task.id === activeTaskId ? 'Currently active task' : `Focus on ${task.title}`);
    if (task.id === activeTaskId) {
      focusBtn.classList.add('primary');
    }
    focusBtn.addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'setActiveTask', id: task.id })
    );

    const delBtn = document.createElement('button');
    delBtn.className = 'btn tiny ghost';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', `Delete ${task.title}`);
    delBtn.addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'deleteTask', id: task.id })
    );
    const checkIcon = document.createElement('img');
    checkIcon.src = '../assets/check.svg';
    checkIcon.width = 14;
    checkIcon.height = 14;
    checkIcon.style.marginRight = '6px';
    checkIcon.style.opacity = task.done ? '1' : '0.2';
    const statusWrap = document.createElement('span');
    statusWrap.style.display = 'inline-flex';
    statusWrap.style.alignItems = 'center';
    statusWrap.append(checkIcon, document.createTextNode(task.done ? 'Done' : 'In Progress'));

    actions.append(statusWrap, focusBtn, delBtn);

    row.append(checkbox, text, actions);
    els.taskList.append(row);
  });
}

/**
 * Render session history list
 * @param {Array} history - Session history
 * @param {Object} methods - Available timer methods
 */
function renderHistory(history = [], methods = {}) {
  if (!history.length) {
    els.history.textContent = 'No history yet';
    els.history.classList.add('empty-state');
    return;
  }
  els.history.classList.remove('empty-state');
  els.history.innerHTML = '';
  history.slice(0, 6).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('role', 'listitem');
    const label = document.createElement('div');
    label.innerHTML = `<strong>${
      methods[entry.methodKey]?.label || entry.methodKey
    }</strong> | ${capitalize(entry.phase)}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const date = new Date(entry.endedAt || entry.createdAt || Date.now());
    meta.textContent = `${formatDuration(entry.durationMs)} | ${date.toLocaleTimeString()}`;
    item.append(label, meta);
    els.history.append(item);
  });
}

/**
 * Apply theme from settings to document
 */
function applyThemeFromSettings() {
  const mode = appState.settings?.theme || 'system';
  const resolved =
    mode === 'system'
      ? window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : mode;
  document.documentElement.dataset.theme = resolved;
}

/**
 * Toggle between light and dark themes
 */
async function toggleTheme() {
  const current = appState.settings?.theme || 'system';
  const next = current === 'light' ? 'dark' : 'light';
  await chrome.runtime.sendMessage({
    type: 'updateSettings',
    settings: { theme: next },
  });
  appState.settings = { ...(appState.settings || {}), theme: next };
  applyThemeFromSettings();
  updateThemeToggle();
}

/**
 * Update theme toggle button label
 */
function updateThemeToggle() {
  if (!els.themeToggle) {
    return;
  }
  const mode = appState.settings?.theme || 'system';
  const resolved =
    mode === 'system'
      ? window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : mode;
  const iconPath = resolved === 'light' ? '../assets/moon.svg' : '../assets/sun.svg';
  const label = resolved === 'light' ? 'Dark' : 'Light';
  
  // Clear and rebuild button content safely
  els.themeToggle.textContent = '';
  const icon = document.createElement('img');
  icon.src = iconPath;
  icon.width = 14;
  icon.height = 14;
  icon.alt = `${label} mode icon`;
  els.themeToggle.appendChild(icon);
  els.themeToggle.appendChild(document.createTextNode(` ${label}`));
  
  els.themeToggle.setAttribute(
    'title',
    `Switch to ${resolved === 'light' ? 'dark' : 'light'} mode`
  );
  els.themeToggle.setAttribute(
    'aria-label',
    `Switch to ${resolved === 'light' ? 'dark' : 'light'} mode`
  );
}

/**
 * Render statistics dashboard
 * @param {Object} stats - Statistics data
 */
function renderStatistics(stats = {}) {
  if (!els.stats) {
    return;
  }
  const totalSessions = stats.totalSessions || 0;
  const totalFocusHours = Math.floor((stats.totalFocusTime || 0) / 3600000);
  const totalFocusMinutes = Math.floor(((stats.totalFocusTime || 0) % 3600000) / 60000);
  const focusTimeStr = totalFocusHours > 0 ? `${totalFocusHours}h ${totalFocusMinutes}m` : `${totalFocusMinutes}m`;
  const currentStreak = stats.currentStreak || 0;
  const longestSessionMin = Math.floor((stats.longestSession || 0) / 60000);

  els.stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${totalSessions}</div>
      <div class="stat-label">Total Sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${focusTimeStr}</div>
      <div class="stat-label">Focus Time</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${currentStreak}</div>
      <div class="stat-label">Current Streak</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${longestSessionMin}m</div>
      <div class="stat-label">Longest Session</div>
    </div>
  `;
}

/**
 * Export session data as JSON
 */
async function exportData() {
  try {
    const { state } = appState;
    if (!state) {
      return;
    }
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '0.2.0',
      statistics: state.statistics,
      history: state.history,
      tasks: state.tasks,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flexifocus-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export data. Please try again.');
  }
}

/**
 * Show keyboard shortcuts modal
 */
function showShortcuts() {
  if (els.shortcutsModal) {
    els.shortcutsModal.classList.remove('hidden');
    els.closeModal?.focus();
  }
}

/**
 * Hide keyboard shortcuts modal
 */
function hideShortcuts() {
  if (els.shortcutsModal) {
    els.shortcutsModal.classList.add('hidden');
  }
}
