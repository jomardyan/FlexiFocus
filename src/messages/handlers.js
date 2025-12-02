/**
 * Message handlers for chrome.runtime.onMessage
 * Each handler is isolated and testable
 */

import * as storage from '../storage.js';
import * as state from '../state.js';
import * as timerLogic from '../timer.js';
import { DEFAULT_METHODS } from '../shared/constants.js';

/**
 * Broadcast state update to all listeners
 * @returns {Promise<void>}
 */
async function broadcastStateUpdate() {
  const { state: loadedState, settings } = await storage.loadStateAndSettings();
  const payload = { 
    type: 'stateUpdated', 
    state: loadedState, 
    settings, 
    methods: DEFAULT_METHODS 
  };
  await chrome.runtime.sendMessage(payload).catch(() => {});
}

/**
 * Handler for 'getState' message
 * @param {Object} _message - Message object (unused)
 * @returns {Promise<{state: Object, settings: Object, methods: Object, remaining: number}>}
 */
export async function handleGetState(_message) {
  const { state: loadedState, settings } = await storage.loadStateAndSettings();
  const defaults = state.initializeState(loadedState, settings);
  const remaining = loadedState?.timer
    ? timerLogic.computeRemaining(loadedState.timer, DEFAULT_METHODS[loadedState.timer.methodKey] || DEFAULT_METHODS.pomodoro)
    : 0;

  return {
    state: defaults.state,
    settings: defaults.settings,
    methods: DEFAULT_METHODS,
    remaining,
  };
}

/**
 * Handler for 'addTask' message
 * @param {Object} message - Message with task data
 * @param {string} message.title - Task title
 * @param {number} message.estimate - Estimated sessions
 * @returns {Promise<{ok: boolean, task: Object}>}
 */
export async function handleAddTask(message) {
  const { state: loadedState, settings } = await storage.loadStateAndSettings();
  const defaults = state.initializeState(loadedState, settings);

  const newTask = state.createTask(message.title, message.estimate);
  const updatedState = {
    ...defaults.state,
    tasks: [newTask, ...defaults.state.tasks],
  };

  await storage.saveState(updatedState);
  await broadcastStateUpdate();
  return { ok: true, task: newTask };
}

/**
 * Handler for 'updateTask' message
 * @param {Object} message - Message with task updates
 * @param {string} message.id - Task ID
 * @param {Object} message.updates - Partial updates
 * @returns {Promise<{ok: boolean}>}
 */
export async function handleUpdateTask(message) {
  const { state: loadedState, settings } = await storage.loadStateAndSettings();
  const defaults = state.initializeState(loadedState, settings);

  const updatedTasks = state.updateTaskInList(
    defaults.state.tasks,
    message.id,
    message.updates
  );
  const updatedState = {
    ...defaults.state,
    tasks: updatedTasks,
  };

  await storage.saveState(updatedState);
  await broadcastStateUpdate();
  return { ok: true };
}

/**
 * Handler for 'deleteTask' message
 * @param {Object} message - Message with task ID
 * @param {string} message.id - Task ID to delete
 * @returns {Promise<{ok: boolean}>}
 */
export async function handleDeleteTask(message) {
  const { state: loadedState, settings } = await storage.loadStateAndSettings();
  const defaults = state.initializeState(loadedState, settings);

  const updatedTasks = state.removeTaskFromList(defaults.state.tasks, message.id);
  const updatedState = {
    ...defaults.state,
    tasks: updatedTasks,
  };

  await storage.saveState(updatedState);
  await broadcastStateUpdate();
  return { ok: true };
}

/**
 * Handler for 'setActiveTask' message
 * @param {Object} message - Message with task ID
 * @param {string} message.id - Task ID to set as active
 * @returns {Promise<{ok: boolean}>}
 */
export async function handleSetActiveTask(message) {
  const { state: loadedState, settings } = await storage.loadStateAndSettings();
  const defaults = state.initializeState(loadedState, settings);

  const updatedState = {
    ...defaults.state,
    timer: {
      ...defaults.state.timer,
      activeTaskId: message.id,
    },
  };

  await storage.saveState(updatedState);
  await broadcastStateUpdate();
  return { ok: true };
}

/**
 * Handler for 'setMethod' message
 * @param {Object} message - Message with method key
 * @param {string} message.methodKey - Method identifier
 * @returns {Promise<{ok: boolean}>}
 */
export async function handleSetMethod(message) {
  const { state: loadedState, settings } = await storage.loadStateAndSettings();
  const defaults = state.initializeState(loadedState, settings);

  const updatedState = {
    ...defaults.state,
    timer: {
      ...defaults.state.timer,
      methodKey: message.methodKey,
      phase: 'work',
    },
  };
  const updatedSettings = {
    ...defaults.settings,
    selectedMethod: message.methodKey,
  };

  await storage.saveStateAndSettings(updatedState, updatedSettings);
  await broadcastStateUpdate();
  return { ok: true };
}

/**
 * Handler for 'updateSettings' message
 * @param {Object} message - Message with settings updates
 * @param {Object} message.settings - Partial settings to merge
 * @returns {Promise<{ok: boolean}>}
 */
export async function handleUpdateSettings(message) {
  const { state: loadedState, settings: currentSettings } = await storage.loadStateAndSettings();
  const defaults = state.initializeState(loadedState, currentSettings);

  const updatedSettings = state.mergeDefaults(message.settings, defaults.settings);

  await storage.saveSettings(updatedSettings);
  await broadcastStateUpdate();
  return { ok: true };
}

/**
 * Map of message types to handlers
 */
export const MESSAGE_HANDLERS = {
  getState: handleGetState,
  addTask: handleAddTask,
  updateTask: handleUpdateTask,
  deleteTask: handleDeleteTask,
  setActiveTask: handleSetActiveTask,
  setMethod: handleSetMethod,
  updateSettings: handleUpdateSettings,
};

/**
 * Dispatch message to appropriate handler
 * @param {Object} message - Chrome runtime message
 * @returns {Promise<*>} Handler result
 * @throws {Error} If message type not found
 */
export async function dispatchMessage(message) {
  const handler = MESSAGE_HANDLERS[message.type];

  if (!handler) {
    throw new Error(`Unknown message type: ${message.type}`);
  }

  try {
    return await handler(message);
  } catch (error) {
    console.error(`Error handling message ${message.type}:`, error);
    throw error;
  }
}
