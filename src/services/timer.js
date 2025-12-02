/**
 * Timer logic and phase management for FlexiFocus
 * Handles phase transitions, duration calculations, and cycle management
 */

import { DEFAULT_METHODS } from '../shared/constants.js';

/**
 * Get method configuration from settings or defaults
 * @param {string} methodKey - Method identifier
 * @param {Object} settings - Current user settings
 * @returns {Object} Method configuration
 */
export function getMethodConfig(methodKey, settings) {
  const preset = settings.presets?.[methodKey];
  return preset ?? DEFAULT_METHODS[methodKey] ?? DEFAULT_METHODS.pomodoro;
}

/**
 * Convert minutes to milliseconds
 * @param {number} minutes - Minutes (default 0)
 * @returns {number} Milliseconds
 */
export function msFromMinutes(minutes = 0) {
  return Math.max(0, minutes) * 60 * 1000;
}

/**
 * Convert milliseconds to minutes
 * @param {number} ms - Milliseconds
 * @returns {number} Minutes
 */
export function msToMinutes(ms) {
  return Math.round(ms / 60000);
}

/**
 * Convert milliseconds to seconds
 * @param {number} ms - Milliseconds
 * @returns {number} Seconds
 */
export function msToSeconds(ms) {
  return Math.round(ms / 1000);
}

/**
 * Compute duration for a given phase
 * @param {Object} method - Timer method config
 * @param {string} phase - Phase type ('work', 'break', 'longBreak')
 * @returns {number} Duration in milliseconds
 */
export function computePhaseDuration(method, phase) {
  if (method.flexible) return 0;
  if (phase === 'longBreak') return msFromMinutes(method.longBreakMinutes);
  if (phase === 'break') return msFromMinutes(method.shortBreakMinutes);
  return msFromMinutes(method.workMinutes);
}

/**
 * Determine the next phase in the cycle
 * @param {Object} timer - Timer state
 * @param {Object} method - Method configuration
 * @returns {{phase: string, longBreak: boolean}} Next phase info
 */
export function nextPhase(timer, method) {
  if (method.flexible) {
    return { phase: 'flow', longBreak: false };
  }
  if (timer.phase === 'work') {
    const longBreakDue = (timer.cycleCount + 1) % (method.cyclesBeforeLongBreak || 4) === 0;
    return { phase: longBreakDue ? 'longBreak' : 'break', longBreak: longBreakDue };
  }
  return { phase: 'work', longBreak: false };
}

/**
 * Get readable label for phase
 * @param {string} phase - Phase type
 * @param {Object} method - Method configuration
 * @returns {string} Readable phase label
 */
export function getPhaseLabel(phase, method) {
  if (method?.flexible && phase === 'flow') return 'Flowtime';
  if (phase === 'work') return 'Focus';
  if (phase === 'longBreak') return 'Long Break';
  if (phase === 'break') return 'Break';
  return phase;
}

/**
 * Get status message for current phase
 * @param {Object} timer - Timer state
 * @param {Object} method - Method configuration
 * @returns {string} Status message
 */
export function getPhaseStatus(timer, method) {
  if (method?.flexible) {
    return timer.isRunning
      ? 'Flowtime running - end when you feel ready.'
      : 'Start flow and end to calculate break.';
  }
  if (timer.phase === 'work') return 'Focus block in progress';
  return 'Recharge break';
}

/**
 * Compute progress percentage for a timer
 * @param {Object} timer - Timer state
 * @param {Object} method - Method configuration
 * @param {number} currentTimeMs - Optional override for current time
 * @returns {number} Progress from 0 to 1
 */
export function computeProgress(timer, method, currentTimeMs) {
  if (method?.flexible) {
    const flowRef = getFlowReferenceMs(method);
    const elapsed = currentTimeMs ?? (timer.isRunning ? Math.max(0, Date.now() - (timer.startTime || Date.now())) : timer.remainingMs || 0);
    return Math.max(0, Math.min(1, elapsed / flowRef));
  }

  const duration = computePhaseDuration(method, timer.phase);
  if (duration <= 0) return 0;

  let remaining;
  if (timer.isRunning && timer.endTime) {
    remaining = Math.max(0, timer.endTime - Date.now());
  } else if (!timer.isRunning && timer.remainingMs) {
    remaining = timer.remainingMs;
  } else {
    remaining = duration;
  }

  return Math.max(0, Math.min(1, remaining / duration));
}

/**
 * Compute remaining time for a timer
 * @param {Object} timer - Timer state
 * @param {Object} method - Method configuration
 * @returns {number} Remaining milliseconds
 */
export function computeRemaining(timer, method) {
  if (method?.flexible) {
    if (!timer.isRunning) return timer.remainingMs || 0;
    return Math.max(0, Date.now() - (timer.startTime || Date.now()));
  }
  if (timer.isRunning && timer.endTime) {
    return Math.max(0, timer.endTime - Date.now());
  }
  if (!timer.isRunning && timer.remainingMs) return timer.remainingMs;
  return Math.max(0, timer.endTime ? timer.endTime - Date.now() : computePhaseDuration(timer, method));
}

/**
 * Get flowtime reference duration for progress calculation
 * @param {Object} method - Flowtime method config
 * @returns {number} Reference duration in milliseconds
 */
export function getFlowReferenceMs(method) {
  const suggested = Number(method.suggestedBreakMinutes);
  const minimumMinutes = 30;
  if (Number.isFinite(suggested) && suggested > 0) {
    return Math.max(suggested * 60000, minimumMinutes * 60000);
  }
  return minimumMinutes * 60000;
}

/**
 * Check if phase is a work phase
 * @param {string} phase - Phase type
 * @returns {boolean} True if work phase
 */
export function isWorkPhase(phase) {
  return phase === 'work' || phase === 'flow';
}

/**
 * Check if phase is a break phase
 * @param {string} phase - Phase type
 * @returns {boolean} True if break phase
 */
export function isBreakPhase(phase) {
  return phase === 'break' || phase === 'longBreak';
}

/**
 * Calculate total elapsed time for a completed session
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {number} Elapsed time in milliseconds
 */
export function calculateElapsedTime(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  return Math.max(0, endTime - startTime);
}

/**
 * Check if timer is in a paused state with no remaining time
 * @param {Object} timer - Timer state
 * @returns {boolean} True if paused and expired
 */
export function isTimerExpired(timer) {
  return !timer.isRunning && timer.remainingMs === 0 && timer.endTime === 0;
}

/**
 * Check if timer can be paused
 * @param {Object} timer - Timer state
 * @returns {boolean} True if currently running
 */
export function canPauseTimer(timer) {
  return timer.isRunning;
}

/**
 * Check if timer can be resumed
 * @param {Object} timer - Timer state
 * @returns {boolean} True if paused with remaining time
 */
export function canResumeTimer(timer) {
  return !timer.isRunning && (timer.remainingMs > 0 || timer.phase !== 'work');
}

/**
 * Check if timer can be started fresh
 * @param {Object} timer - Timer state
 * @returns {boolean} True if not running and at initial state
 */
export function canStartTimer(timer) {
  return !timer.isRunning;
}
