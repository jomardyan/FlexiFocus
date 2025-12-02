/**
 * FlexiFocus Service Worker
 * Orchestrates timer state, alarms, notifications, and storage
 * Delegates to: state.js, timer.js, storage.js, messages/handlers.js
 */

import {
  ALARM_NAME,
  BADGE_ALARM,
  DEFAULT_METHODS,
  SOUNDS,
} from '../shared/constants.js';
import { formatDuration, capitalize } from '../shared/utils.js';
import * as state from '../state.js';
import * as timer from '../timer.js';
import * as storage from '../storage.js';
import { dispatchMessage } from '../messages/handlers.js';



/**
 * Start a timer for the specified method and phase
 * @param {string} methodKey - Timer method to use
 * @param {string} phaseOverride - Optional phase override
 * @returns {Promise<{timer: Object, settings: Object}>} Updated timer and settings
 */
async function startTimer(methodKey, phaseOverride) {
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  const method = timer.getMethodConfig(methodKey ?? currentState.timer.methodKey, settings);
  const phase = phaseOverride ?? currentState.timer.phase ?? 'work';

  if (method.flexible) {
    const newTimer = {
      ...currentState.timer,
      methodKey: method.key,
      phase: 'flow',
      isRunning: true,
      startTime: Date.now(),
      endTime: 0,
      remainingMs: 0
    };
    await chrome.alarms.clear(ALARM_NAME);
    await saveAndBroadcast({ ...currentState, timer: newTimer }, settings);
    await ensureBadgeUpdates(newTimer, settings);
    return { timer: newTimer, settings };
  }

  const durationMs = timer.computePhaseDuration(method, phase);
  const endTime = Date.now() + durationMs;
  const newTimer = {
    ...currentState.timer,
    methodKey: method.key,
    phase,
    isRunning: true,
    startTime: Date.now(),
    endTime,
    remainingMs: 0
  };

  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await saveAndBroadcast({ ...currentState, timer: newTimer }, settings);
  await ensureBadgeUpdates(newTimer, settings);
  return { timer: newTimer, settings };
}

/**
 * Pause running timer (may be blocked by lock-in setting)
 * @returns {Promise<{state: Object, settings: Object}>}
 * @throws {Error} If lock-in mode prevents pausing
 */
async function pauseTimer() {
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  if (!currentState.timer.isRunning) return { state: currentState, settings };

  const method = timer.getMethodConfig(currentState.timer.methodKey, settings);
  if (settings.lockIn && currentState.timer.phase === 'work' && !method.flexible) {
    throw new Error('Lock-In Mode is enabled; pause is blocked during focus.');
  }

  const remainingMs = method.flexible
    ? Math.max(0, Date.now() - (currentState.timer.startTime || Date.now()))
    : Math.max(0, currentState.timer.endTime - Date.now());

  const newTimer = {
    ...currentState.timer,
    isRunning: false,
    remainingMs,
    startTime: 0,
    endTime: 0
  };

  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(BADGE_ALARM);
  await chrome.action.setBadgeText({ text: '' });
  await saveAndBroadcast({ ...currentState, timer: newTimer }, settings);
  return { timer: newTimer, settings };
}

/**
 * Resume a paused timer
 * @returns {Promise<{timer: Object, settings: Object}>}
 */
async function resumeTimer() {
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  const method = timer.getMethodConfig(currentState.timer.methodKey, settings);
  if (method.flexible) {
    const elapsed = Math.max(0, currentState.timer.remainingMs || 0);
    const newTimer = {
      ...currentState.timer,
      isRunning: true,
      startTime: Date.now() - elapsed,
      endTime: 0,
      remainingMs: elapsed
    };
    await saveAndBroadcast({ ...currentState, timer: newTimer }, settings);
    await ensureBadgeUpdates(newTimer, settings);
    return { timer: newTimer, settings };
  }
  const baseDuration = currentState.timer.remainingMs || timer.computePhaseDuration(method, currentState.timer.phase);
  const endTime = Date.now() + baseDuration;
  const newTimer = { ...currentState.timer, isRunning: true, startTime: Date.now(), endTime, remainingMs: 0 };
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await saveAndBroadcast({ ...currentState, timer: newTimer }, settings);
  await ensureBadgeUpdates(newTimer, settings);
  return { timer: newTimer, settings };
}

/**
 * Reset timer to initial state (may be blocked by lock-in setting)
 * @returns {Promise<{timer: Object, settings: Object}>}
 * @throws {Error} If lock-in mode prevents resetting
 */
async function resetTimer() {
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  if (settings.lockIn && currentState.timer.phase === 'work' && currentState.timer.isRunning) {
    throw new Error('Lock-In Mode is enabled; reset is blocked during focus.');
  }
  const newTimer = {
    ...state.initializeTimerState(),
    methodKey: settings.selectedMethod
  };
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(BADGE_ALARM);
  await chrome.action.setBadgeText({ text: '' });
  await saveAndBroadcast({ ...currentState, timer: newTimer }, settings);
  return { timer: newTimer, settings };
}

/**
 * Complete a flowtime session and transition to break phase
 * @returns {Promise<{timer: Object, history: Array, settings: Object}>}
 */
async function completeFlowtime() {
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  if (!currentState.timer.isRunning || currentState.timer.methodKey !== 'flowtime') return { state: currentState, settings };

  const durationMs = Math.max(1, Date.now() - currentState.timer.startTime);
  const entry = state.createHistoryEntry(
    crypto.randomUUID(),
    'flowtime',
    'flow',
    durationMs,
    currentState.timer.startTime,
    Date.now(),
    currentState.timer.activeTaskId
  );
  const history = [entry, ...(currentState.history ?? [])].slice(0, 200);
  const newTimer = {
    ...currentState.timer,
    isRunning: false,
    startTime: 0,
    endTime: 0,
    remainingMs: 0,
    phase: 'break'
  };

  await chrome.alarms.clear(BADGE_ALARM);
  await chrome.action.setBadgeText({ text: '' });
  await saveAndBroadcast({ ...currentState, timer: newTimer, history }, settings);
  await maybeNotify(settings, 'Flow session saved', formatDuration(durationMs));
  return { timer: newTimer, history, settings };
}

/**
 * Handle alarm trigger (timer completion or badge update)
 * @param {string} name - Alarm name
 * @returns {Promise<void>}
 */
async function handleAlarm(name) {
  if (name !== ALARM_NAME && name !== BADGE_ALARM) return;
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  const method = timer.getMethodConfig(currentState.timer.methodKey, settings);

  if (name === BADGE_ALARM) {
    await updateBadge(currentState.timer, settings);
    return;
  }

  if (!currentState.timer.isRunning) return;
  const durationMs = Math.max(0, currentState.timer.endTime - currentState.timer.startTime);
  const entry = state.createHistoryEntry(
    crypto.randomUUID(),
    method.key,
    currentState.timer.phase,
    durationMs,
    currentState.timer.startTime,
    Date.now(),
    currentState.timer.activeTaskId
  );
  const history = [entry, ...(currentState.history ?? [])].slice(0, 200);

  const incrementedCycle = currentState.timer.phase === 'work' ? currentState.timer.cycleCount + 1 : currentState.timer.cycleCount;
  const next = timer.nextPhase(currentState.timer, method);
  const newTimer = {
    ...currentState.timer,
    isRunning: false,
    startTime: 0,
    endTime: 0,
    remainingMs: 0,
    phase: next.phase,
    cycleCount: next.phase === 'work' ? incrementedCycle : currentState.timer.cycleCount,
    completedSessions: currentState.timer.phase === 'work' ? currentState.timer.completedSessions + 1 : currentState.timer.completedSessions
  };

  let newState = { ...currentState, timer: newTimer, history };
  await chrome.action.setBadgeText({ text: '' });
  await chrome.alarms.clear(ALARM_NAME);

  await maybeNotify(settings, `${capitalize(currentState.timer.phase)} done`, `Next: ${next.phase === 'work' ? 'Focus' : 'Break'}`);
  await enforceBreak(next.phase, settings);
  await updateTaskProgress(currentState, newTimer);

  const shouldStart =
    (newTimer.phase === 'work' && settings.autoStartWork) ||
    (newTimer.phase !== 'work' && settings.autoStartBreaks);

  if (shouldStart && !method.flexible) {
    await saveAndBroadcast(newState, settings);
    await startTimer(method.key, newTimer.phase);
    return;
  }

  newState = { ...newState, timer: newTimer };
  await saveAndBroadcast(newState, settings);
}

/**
 * Update task progress when a work session completes
 * @param {Object} previousState - State before session
 * @param {Object} timerState - Updated timer state
 * @returns {Promise<void>}
 */
async function updateTaskProgress(previousState, timerState) {
  if (!previousState.timer.activeTaskId || previousState.timer.phase !== 'work') return;
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  const tasks = (currentState.tasks ?? []).map(task => {
    if (task.id !== previousState.timer.activeTaskId) return task;
    return {
      ...task,
      completedSessions: (task.completedSessions ?? 0) + 1,
      done: task.done || ((task.completedSessions ?? 0) + 1) >= (task.estimate ?? 1)
    };
  });
  await storage.saveState({ ...currentState, tasks }, settings);
  await broadcastState();
}

/**
 * Send notification if enabled in settings
 * @param {Object} settings - User settings
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @returns {Promise<void>}
 */
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

/**
 * Open break enforcement tab if enabled
 * @param {string} phase - Current phase ('break', 'longBreak')
 * @param {Object} settings - User settings
 * @returns {Promise<void>}
 */
async function enforceBreak(phase, settings) {
  if (!settings.breakEnforcement) return;
  if (phase !== 'break' && phase !== 'longBreak') return;
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/break.html'), active: true });
  } catch (error) {
    console.error('Break enforcement failed', error);
  }
}

/**
 * Play notification sound using Web Audio API
 * @param {Object} settings - User settings with sound profile
 * @returns {Promise<void>}
 */
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

/**
 * Set up badge updates if enabled
 * @param {Object} timer - Timer state
 * @param {Object} settings - User settings
 * @returns {Promise<void>}
 */
async function ensureBadgeUpdates(timer, settings) {
  if (!settings.badge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  await updateBadge(timer, settings);
  await chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 1 / 6, when: Date.now() + 5000 });
}

/**
 * Update icon badge with remaining time
 * @param {Object} timer - Timer state
 * @param {Object} settings - User settings
 * @returns {Promise<void>}
 */
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

/**
 * Persist state and broadcast update to all listeners
 * @param {Object} currentState - Application state
 * @param {Object} settings - User settings
 * @returns {Promise<void>}
 */
async function saveAndBroadcast(currentState, settings) {
  await storage.saveState(currentState, settings);
  await broadcastState();
}

/**
 * Send state update message to all runtime listeners
 * @returns {Promise<void>}
 */
async function broadcastState() {
  const { state: currentState, settings } = await storage.loadStateAndSettings();
  const payload = { type: 'stateUpdated', state: currentState, settings, methods: DEFAULT_METHODS };
  await chrome.runtime.sendMessage(payload).catch(() => {});
}

/**
 * Message handler for all runtime requests
 * Routes to centralized handler dispatcher
 * See src/shared/messages.json for message type documentation
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    try {
      // Special case: getState needs to compute remaining time
      if (message.type === 'getState') {
        const { state: currentState, settings } = await storage.loadStateAndSettings();
        const remainingMs = message.type === 'getState' 
          ? (currentState.timer.isRunning ? 
              (currentState.timer.endTime ? Math.max(0, currentState.timer.endTime - Date.now()) :
               currentState.timer.startTime ? Math.max(0, Date.now() - currentState.timer.startTime) : 0)
              : (currentState.timer.remainingMs ?? 0))
          : 0;
        sendResponse({ state: currentState, settings, methods: DEFAULT_METHODS, remaining: remainingMs });
        return;
      }
      // Delegate all other messages to the centralized handler
      const result = await dispatchMessage(message);
      sendResponse({ ok: true, ...result });
    } catch (err) {
      console.error(err);
      sendResponse({ error: err?.message || 'Unhandled error' });
    }
  };

  handler().catch(err => {
    console.error(err);
    sendResponse({ error: err?.message || 'Unhandled error' });
  });

  return true;
});

/**
 * Alarm event listener for timer completion and badge updates
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  handleAlarm(alarm.name).catch(console.error);
});

/**
 * Command listener for keyboard shortcuts
 */
chrome.commands.onCommand.addListener(async (command) => {
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

/**
 * Extension installation hook - initialize state
 */
chrome.runtime.onInstalled.addListener(async () => {
  const { state, settings } = await loadState();
  await saveAndBroadcast(state, settings);
});
