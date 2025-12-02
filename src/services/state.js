/**
 * State management utilities for FlexiFocus
 * Handles state initialization, merging, validation, and mutations
 */

import { DEFAULT_STATE, DEFAULT_SETTINGS, DEFAULT_METHODS } from '../shared/constants.js';

/**
 * State schema definitions for runtime validation
 */
const STATE_SCHEMA = {
  timer: {
    methodKey: 'string',
    phase: 'string',
    isRunning: 'boolean',
    startTime: 'number',
    endTime: 'number',
    remainingMs: 'number',
    cycleCount: 'number',
    completedSessions: 'number',
    activeTaskId: 'string|null',
  },
  tasks: 'array',
  history: 'array',
};

const SETTINGS_SCHEMA = {
  selectedMethod: 'string',
  presets: 'object',
  autoStartBreaks: 'boolean',
  autoStartWork: 'boolean',
  lockIn: 'boolean',
  notifications: 'boolean',
  sound: 'string',
  volume: 'number',
  breakEnforcement: 'boolean',
  badge: 'boolean',
  theme: 'string',
};

/**
 * Recursively merge current values with defaults
 * Preserves arrays and null values, deep-merges objects
 * @param {Object} current - Current values (may be partial)
 * @param {Object} defaults - Default/fallback values
 * @returns {Object} Merged object with defaults applied
 */
export function mergeDefaults(current, defaults) {
  return structuredClone({
    ...defaults,
    ...current,
    ...(current && typeof current === 'object'
      ? Object.entries(current).reduce((acc, [key, value]) => {
          if (Array.isArray(value) || value === null) {
            acc[key] = value;
          } else if (typeof value === 'object') {
            acc[key] = mergeDefaults(value, defaults[key] ?? {});
          }
          return acc;
        }, {})
      : {}),
  });
}

/**
 * Initialize timer state to defaults with optional overrides
 * @param {Object} overrides - Partial timer state to merge
 * @returns {Object} Initialized timer state
 */
export function initializeTimerState(overrides = {}) {
  return {
    ...DEFAULT_STATE.timer,
    ...overrides,
  };
}

/**
 * Initialize full application state to defaults
 * @param {Object} stateOverrides - Partial state to merge
 * @param {Object} settingsOverrides - Partial settings to merge
 * @returns {{state: Object, settings: Object}} Initialized state and settings
 */
export function initializeState(stateOverrides = {}, settingsOverrides = {}) {
  return {
    state: mergeDefaults(stateOverrides, DEFAULT_STATE),
    settings: mergeDefaults(settingsOverrides, DEFAULT_SETTINGS),
  };
}

/**
 * Create a new task with defaults
 * @param {string} title - Task title
 * @param {number} estimate - Estimated sessions (default 1)
 * @returns {Object} New task object
 */
export function createTask(title, estimate = 1) {
  return {
    id: crypto.randomUUID(),
    title,
    estimate: Math.max(1, estimate),
    completedSessions: 0,
    done: false,
  };
}

/**
 * Create a new history entry
 * @param {string} id - Unique entry ID
 * @param {string} methodKey - Method used
 * @param {string} phase - Phase type
 * @param {number} durationMs - Duration in milliseconds
 * @param {number} startedAt - Timestamp when started
 * @param {number} endedAt - Timestamp when ended
 * @param {string} taskId - Associated task ID (optional)
 * @returns {Object} History entry
 */
export function createHistoryEntry(
  id,
  methodKey,
  phase,
  durationMs,
  startedAt,
  endedAt,
  taskId = null
) {
  return {
    id,
    methodKey,
    phase,
    durationMs,
    startedAt,
    endedAt,
    taskId,
  };
}

/**
 * Update a task with partial changes
 * @param {Array} tasks - Task list
 * @param {string} taskId - Task ID to update
 * @param {Object} updates - Partial updates to apply
 * @returns {Array} Updated task list
 */
export function updateTaskInList(tasks, taskId, updates) {
  return tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
}

/**
 * Remove task from list by ID
 * @param {Array} tasks - Task list
 * @param {string} taskId - Task ID to remove
 * @returns {Array} Filtered task list
 */
export function removeTaskFromList(tasks, taskId) {
  return tasks.filter((task) => task.id !== taskId);
}

/**
 * Increment work cycle count
 * @param {number} currentCycle - Current cycle count
 * @returns {number} Incremented cycle count
 */
export function incrementCycleCount(currentCycle) {
  return Math.max(0, currentCycle + 1);
}

/**
 * Increment completed sessions count
 * @param {number} currentSessions - Current session count
 * @returns {number} Incremented session count
 */
export function incrementCompletedSessions(currentSessions) {
  return Math.max(0, currentSessions + 1);
}

/**
 * Get task completion percentage
 * @param {Object} task - Task object
 * @returns {number} Percentage from 0-100
 */
export function getTaskCompletionPercentage(task) {
  if (!task || task.estimate <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((task.completedSessions / task.estimate) * 100));
}

/**
 * Check if task should be marked as done
 * @param {Object} task - Task object
 * @returns {boolean} True if completedSessions >= estimate
 */
export function isTaskComplete(task) {
  return task && task.completedSessions >= task.estimate;
}

/**
 * Trim history to max entries
 * @param {Array} history - History list
 * @param {number} maxEntries - Maximum entries to keep (default 200)
 * @returns {Array} Trimmed history
 */
export function trimHistory(history, maxEntries = 200) {
  return history.slice(0, maxEntries);
}

/**
 * Get statistics from history
 * @param {Array} history - History entries
 * @returns {Object} Statistics object with totals and breakdowns
 */
export function getHistoryStats(history) {
  if (!history || history.length === 0) {
    return {
      totalSessions: 0,
      totalTimeMs: 0,
      totalTimeMinutes: 0,
      sessionsByPhase: {},
      sessionsByMethod: {},
    };
  }

  const stats = {
    totalSessions: history.length,
    totalTimeMs: 0,
    sessionsByPhase: {},
    sessionsByMethod: {},
  };

  history.forEach((entry) => {
    stats.totalTimeMs += entry.durationMs || 0;
    stats.sessionsByPhase[entry.phase] = (stats.sessionsByPhase[entry.phase] || 0) + 1;
    stats.sessionsByMethod[entry.methodKey] = (stats.sessionsByMethod[entry.methodKey] || 0) + 1;
  });

  stats.totalTimeMinutes = Math.round(stats.totalTimeMs / 60000);
  return stats;
}

/**
 * Validate state structure matches schema
 * @param {Object} state - State to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateState(state) {
  const errors = [];

  if (!state || typeof state !== 'object') {
    errors.push('State must be an object');
    return { valid: false, errors };
  }

  if (!state.timer || typeof state.timer !== 'object') {
    errors.push('State.timer must be an object');
  }
  if (!Array.isArray(state.tasks)) {
    errors.push('State.tasks must be an array');
  }
  if (!Array.isArray(state.history)) {
    errors.push('State.history must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate settings structure matches schema
 * @param {Object} settings - Settings to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateSettings(settings) {
  const errors = [];

  if (!settings || typeof settings !== 'object') {
    errors.push('Settings must be an object');
    return { valid: false, errors };
  }

  if (typeof settings.autoStartBreaks !== 'boolean') {
    errors.push('Settings.autoStartBreaks must be boolean');
  }
  if (typeof settings.notifications !== 'boolean') {
    errors.push('Settings.notifications must be boolean');
  }
  if (typeof settings.volume !== 'number' || settings.volume < 0 || settings.volume > 1) {
    errors.push('Settings.volume must be number 0-1');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Deep clone state for immutability
 * @param {Object} state - State to clone
 * @returns {Object} Cloned state
 */
export function cloneState(state) {
  return structuredClone(state);
}

/**
 * Deep clone settings for immutability
 * @param {Object} settings - Settings to clone
 * @returns {Object} Cloned settings
 */
export function cloneSettings(settings) {
  return structuredClone(settings);
}
