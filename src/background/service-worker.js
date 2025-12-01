const ALARM_NAME = 'flexifocus-timer';
const BADGE_ALARM = 'flexifocus-badge';

const DEFAULT_METHODS = {
  pomodoro: {
    key: 'pomodoro',
    label: 'Pomodoro',
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4
  },
  fiftyTwoSeventeen: {
    key: 'fiftyTwoSeventeen',
    label: '52 / 17',
    workMinutes: 52,
    shortBreakMinutes: 17,
    longBreakMinutes: 17,
    cyclesBeforeLongBreak: 1
  },
  ultradian: {
    key: 'ultradian',
    label: 'Ultradian 90 / 20',
    workMinutes: 90,
    shortBreakMinutes: 20,
    longBreakMinutes: 20,
    cyclesBeforeLongBreak: 1
  },
  flowtime: {
    key: 'flowtime',
    label: 'Flowtime',
    flexible: true,
    suggestedBreakMinutes: 10
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    workMinutes: 30,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4
  }
};

const DEFAULT_SETTINGS = {
  selectedMethod: 'pomodoro',
  presets: { ...DEFAULT_METHODS },
  autoStartBreaks: true,
  autoStartWork: true,
  lockIn: false,
  notifications: true,
  sound: 'chime',
  volume: 0.7,
  breakEnforcement: false,
  badge: true,
  theme: 'system'
};

const DEFAULT_STATE = {
  timer: {
    methodKey: DEFAULT_SETTINGS.selectedMethod,
    phase: 'work',
    isRunning: false,
    startTime: 0,
    endTime: 0,
    remainingMs: 0,
    cycleCount: 0,
    completedSessions: 0,
    activeTaskId: null
  },
  tasks: [],
  history: []
};

const SOUNDS = {
  chime: { type: 'triangle', frequency: 880, duration: 0.7 },
  softBell: { type: 'sine', frequency: 660, duration: 0.9 }
};

async function loadState() {
  const stored = await chrome.storage.local.get(['state', 'settings']);
  return {
    state: mergeDefaults(stored.state ?? {}, DEFAULT_STATE),
    settings: mergeDefaults(stored.settings ?? {}, DEFAULT_SETTINGS)
  };
}

async function saveState(state, settings) {
  await chrome.storage.local.set({ state, settings });
}

function mergeDefaults(current, defaults) {
  return structuredClone({
    ...defaults,
    ...current,
    ...(current && typeof current === 'object' ? Object.entries(current).reduce((acc, [key, value]) => {
      if (Array.isArray(value) || value === null) {
        acc[key] = value;
      } else if (typeof value === 'object') {
        acc[key] = mergeDefaults(value, defaults[key] ?? {});
      }
      return acc;
    }, {}) : {})
  });
}

function msFromMinutes(minutes = 0) {
  return Math.max(0, minutes) * 60 * 1000;
}

function getMethodConfig(methodKey, settings) {
  const preset = settings.presets?.[methodKey];
  return preset ?? DEFAULT_METHODS[methodKey] ?? DEFAULT_METHODS.pomodoro;
}

function computePhaseDuration(method, phase) {
  if (method.flexible) return 0;
  if (phase === 'longBreak') return msFromMinutes(method.longBreakMinutes);
  if (phase === 'break') return msFromMinutes(method.shortBreakMinutes);
  return msFromMinutes(method.workMinutes);
}

function nextPhase(timer, method) {
  if (method.flexible) {
    return { phase: 'flow', longBreak: false };
  }
  if (timer.phase === 'work') {
    const longBreakDue = (timer.cycleCount + 1) % (method.cyclesBeforeLongBreak || 4) === 0;
    return { phase: longBreakDue ? 'longBreak' : 'break', longBreak: longBreakDue };
  }
  return { phase: 'work', longBreak: false };
}

function buildHistoryEntry(timer, methodKey, phase, durationMs, taskId) {
  return {
    id: crypto.randomUUID(),
    methodKey,
    phase,
    durationMs,
    startedAt: timer.startTime,
    endedAt: Date.now(),
    taskId
  };
}

async function startTimer(methodKey, phaseOverride) {
  const { state, settings } = await loadState();
  const method = getMethodConfig(methodKey ?? state.timer.methodKey, settings);
  const phase = phaseOverride ?? state.timer.phase ?? 'work';

  if (method.flexible) {
    const timer = {
      ...state.timer,
      methodKey: method.key,
      phase: 'flow',
      isRunning: true,
      startTime: Date.now(),
      endTime: 0,
      remainingMs: 0
    };
    await chrome.alarms.clear(ALARM_NAME);
    await saveAndBroadcast({ ...state, timer }, settings);
    await ensureBadgeUpdates(timer, settings);
    return { timer, settings };
  }

  const durationMs = computePhaseDuration(method, phase);
  const endTime = Date.now() + durationMs;
  const timer = {
    ...state.timer,
    methodKey: method.key,
    phase,
    isRunning: true,
    startTime: Date.now(),
    endTime,
    remainingMs: 0
  };

  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await saveAndBroadcast({ ...state, timer }, settings);
  await ensureBadgeUpdates(timer, settings);
  return { timer, settings };
}

async function pauseTimer() {
  const { state, settings } = await loadState();
  if (!state.timer.isRunning) return { state, settings };

  const method = getMethodConfig(state.timer.methodKey, settings);
  if (settings.lockIn && state.timer.phase === 'work' && !method.flexible) {
    throw new Error('Lock-In Mode is enabled; pause is blocked during focus.');
  }

  const remainingMs = method.flexible
    ? Math.max(0, Date.now() - (state.timer.startTime || Date.now()))
    : Math.max(0, state.timer.endTime - Date.now());

  const timer = {
    ...state.timer,
    isRunning: false,
    remainingMs,
    startTime: 0,
    endTime: 0
  };

  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(BADGE_ALARM);
  await chrome.action.setBadgeText({ text: '' });
  await saveAndBroadcast({ ...state, timer }, settings);
  return { timer, settings };
}

async function resumeTimer() {
  const { state, settings } = await loadState();
  const method = getMethodConfig(state.timer.methodKey, settings);
  if (method.flexible) {
    const elapsed = Math.max(0, state.timer.remainingMs || 0);
    const timer = {
      ...state.timer,
      isRunning: true,
      startTime: Date.now() - elapsed,
      endTime: 0,
      remainingMs: elapsed
    };
    await saveAndBroadcast({ ...state, timer }, settings);
    await ensureBadgeUpdates(timer, settings);
    return { timer, settings };
  }
  const baseDuration = state.timer.remainingMs || computePhaseDuration(method, state.timer.phase);
  const endTime = Date.now() + baseDuration;
  const timer = { ...state.timer, isRunning: true, startTime: Date.now(), endTime, remainingMs: 0 };
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await saveAndBroadcast({ ...state, timer }, settings);
  await ensureBadgeUpdates(timer, settings);
  return { timer, settings };
}

async function resetTimer() {
  const { state, settings } = await loadState();
  if (settings.lockIn && state.timer.phase === 'work' && state.timer.isRunning) {
    throw new Error('Lock-In Mode is enabled; reset is blocked during focus.');
  }
  const timer = {
    ...DEFAULT_STATE.timer,
    methodKey: settings.selectedMethod
  };
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(BADGE_ALARM);
  await chrome.action.setBadgeText({ text: '' });
  await saveAndBroadcast({ ...state, timer }, settings);
  return { timer, settings };
}

async function completeFlowtime() {
  const { state, settings } = await loadState();
  if (!state.timer.isRunning || state.timer.methodKey !== 'flowtime') return { state, settings };

  const durationMs = Math.max(1, Date.now() - state.timer.startTime);
  const entry = buildHistoryEntry(state.timer, 'flowtime', 'flow', durationMs, state.timer.activeTaskId);
  const history = [entry, ...(state.history ?? [])].slice(0, 200);
  const timer = {
    ...state.timer,
    isRunning: false,
    startTime: 0,
    endTime: 0,
    remainingMs: 0,
    phase: 'break'
  };

  await chrome.alarms.clear(BADGE_ALARM);
  await chrome.action.setBadgeText({ text: '' });
  await saveAndBroadcast({ ...state, timer, history }, settings);
  await maybeNotify(settings, 'Flow session saved', formatDuration(durationMs));
  return { timer, history, settings };
}

async function handleAlarm(name) {
  if (name !== ALARM_NAME && name !== BADGE_ALARM) return;
  const { state, settings } = await loadState();
  const method = getMethodConfig(state.timer.methodKey, settings);

  if (name === BADGE_ALARM) {
    await updateBadge(state.timer, settings);
    return;
  }

  if (!state.timer.isRunning) return;
  const durationMs = Math.max(0, state.timer.endTime - state.timer.startTime);
  const entry = buildHistoryEntry(state.timer, method.key, state.timer.phase, durationMs, state.timer.activeTaskId);
  const history = [entry, ...(state.history ?? [])].slice(0, 200);

  const incrementedCycle = state.timer.phase === 'work' ? state.timer.cycleCount + 1 : state.timer.cycleCount;
  const next = nextPhase(state.timer, method);
  const timer = {
    ...state.timer,
    isRunning: false,
    startTime: 0,
    endTime: 0,
    remainingMs: 0,
    phase: next.phase,
    cycleCount: next.phase === 'work' ? incrementedCycle : state.timer.cycleCount,
    completedSessions: state.timer.phase === 'work' ? state.timer.completedSessions + 1 : state.timer.completedSessions
  };

  let newState = { ...state, timer, history };
  await chrome.action.setBadgeText({ text: '' });
  await chrome.alarms.clear(ALARM_NAME);

  await maybeNotify(settings, `${capitalize(state.timer.phase)} done`, `Next: ${next.phase === 'work' ? 'Focus' : 'Break'}`);
  await enforceBreak(next.phase, settings);
  await updateTaskProgress(state, timer);

  const shouldStart =
    (timer.phase === 'work' && settings.autoStartWork) ||
    (timer.phase !== 'work' && settings.autoStartBreaks);

  if (shouldStart && !method.flexible) {
    await saveAndBroadcast(newState, settings);
    await startTimer(method.key, timer.phase);
    return;
  }

  newState = { ...newState, timer };
  await saveAndBroadcast(newState, settings);
}

async function updateTaskProgress(previousState, timer) {
  if (!previousState.timer.activeTaskId || previousState.timer.phase !== 'work') return;
  const { state, settings } = await loadState();
  const tasks = (state.tasks ?? []).map(task => {
    if (task.id !== previousState.timer.activeTaskId) return task;
    return {
      ...task,
      completedSessions: (task.completedSessions ?? 0) + 1,
      done: task.done || ((task.completedSessions ?? 0) + 1) >= (task.estimate ?? 1)
    };
  });
  await saveState({ ...state, tasks }, settings);
  await broadcastState();
}

async function maybeNotify(settings, title, message) {
  if (!settings.notifications) return;
  await chrome.notifications.create({
    type: 'basic',
    title,
    message,
    iconUrl: chrome.runtime.getURL('src/assets/icon-128.png')
  });
  await playSound(settings);
}

async function enforceBreak(phase, settings) {
  if (!settings.breakEnforcement) return;
  if (phase !== 'break' && phase !== 'longBreak') return;
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/break.html'), active: true });
  } catch (error) {
    console.error('Break enforcement failed', error);
  }
}

async function playSound(settings) {
  const profile = SOUNDS[settings.sound];
  if (!profile || typeof AudioContext === 'undefined') return;
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = profile.type;
  oscillator.frequency.value = profile.frequency;
  gain.gain.value = settings.volume ?? 0.7;
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + profile.duration);
}

async function ensureBadgeUpdates(timer, settings) {
  if (!settings.badge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  await updateBadge(timer, settings);
  await chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 1 / 6, when: Date.now() + 5000 });
}

async function updateBadge(timer, settings) {
  if (!settings.badge || !timer.isRunning) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const remaining = timer.endTime ? Math.max(0, timer.endTime - Date.now()) : 0;
  if (remaining === 0 && timer.methodKey !== 'flowtime') {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const minutes = timer.methodKey === 'flowtime'
    ? 'FL'
    : Math.max(0, Math.ceil(remaining / 60000)).toString();
  await chrome.action.setBadgeBackgroundColor({ color: timer.phase === 'work' ? '#2563eb' : '#10b981' });
  await chrome.action.setBadgeText({ text: minutes.slice(0, 4) });
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return `${Math.round(ms / 1000)}s`;
  return `${minutes}m`;
}

async function saveAndBroadcast(state, settings) {
  await saveState(state, settings);
  await broadcastState();
}

async function broadcastState() {
  const { state, settings } = await loadState();
  const payload = { type: 'stateUpdated', state, settings, methods: DEFAULT_METHODS };
  await chrome.runtime.sendMessage(payload).catch(() => {});
}

function remainingMs(timer) {
  if (timer.isRunning) {
    if (timer.endTime) return Math.max(0, timer.endTime - Date.now());
    if (timer.startTime) return Math.max(0, Date.now() - timer.startTime);
  }
  if (timer.endTime) return Math.max(0, timer.endTime - Date.now());
  return timer.remainingMs ?? 0;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case 'getState': {
        const { state, settings } = await loadState();
        sendResponse({ state, settings, methods: DEFAULT_METHODS, remaining: remainingMs(state.timer) });
        return;
      }
      case 'startTimer':
        await startTimer(message.methodKey, message.phase);
        sendResponse({ ok: true });
        return;
      case 'pauseTimer':
        await pauseTimer();
        sendResponse({ ok: true });
        return;
      case 'resumeTimer':
        await resumeTimer();
        sendResponse({ ok: true });
        return;
      case 'resetTimer':
        await resetTimer();
        sendResponse({ ok: true });
        return;
      case 'completeFlowtime':
        await completeFlowtime();
        sendResponse({ ok: true });
        return;
      case 'setMethod': {
        const { state, settings } = await loadState();
        const timer = { ...state.timer, methodKey: message.methodKey, phase: 'work' };
        await saveAndBroadcast({ ...state, timer }, { ...settings, selectedMethod: message.methodKey });
        sendResponse({ ok: true });
        return;
      }
      case 'updateSettings': {
        const { state, settings } = await loadState();
        const updatedSettings = mergeDefaults(message.settings, settings);
        await saveAndBroadcast(state, updatedSettings);
        sendResponse({ ok: true });
        return;
      }
      case 'addTask': {
        const { state, settings } = await loadState();
        const task = {
          id: crypto.randomUUID(),
          title: message.title,
          estimate: message.estimate ?? 1,
          completedSessions: 0,
          done: false
        };
        await saveAndBroadcast({ ...state, tasks: [task, ...state.tasks] }, settings);
        sendResponse({ ok: true, task });
        return;
      }
      case 'updateTask': {
        const { state, settings } = await loadState();
        const tasks = state.tasks.map(task => task.id === message.id ? { ...task, ...message.updates } : task);
        await saveAndBroadcast({ ...state, tasks }, settings);
        sendResponse({ ok: true });
        return;
      }
      case 'deleteTask': {
        const { state, settings } = await loadState();
        const tasks = state.tasks.filter(task => task.id !== message.id);
        await saveAndBroadcast({ ...state, tasks }, settings);
        sendResponse({ ok: true });
        return;
      }
      case 'setActiveTask': {
        const { state, settings } = await loadState();
        const timer = { ...state.timer, activeTaskId: message.id };
        await saveAndBroadcast({ ...state, timer }, settings);
        sendResponse({ ok: true });
        return;
      }
      default:
        sendResponse({ error: 'Unknown message' });
    }
  };

  handler().catch(err => {
    console.error(err);
    sendResponse({ error: err?.message || 'Unhandled error' });
  });

  return true;
});

chrome.alarms.onAlarm.addListener(alarm => {
  handleAlarm(alarm.name).catch(console.error);
});

chrome.commands.onCommand.addListener(async command => {
  try {
    if (command === 'flexifocus-start-pause') {
      const { state } = await loadState();
      if (state.timer.isRunning) {
        await pauseTimer();
      } else {
        await resumeTimer();
      }
    }
    if (command === 'flexifocus-reset') {
      await resetTimer();
    }
  } catch (error) {
    console.error('Command error', error);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const { state, settings } = await loadState();
  await saveAndBroadcast(state, settings);
});
