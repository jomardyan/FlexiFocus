/**
 * Unit tests for state.js utilities
 */

import {
  mergeDefaults,
  createTask,
  updateTaskInList,
  removeTaskFromList,
  getTaskCompletionPercentage,
  isTaskComplete,
  trimHistory,
  getHistoryStats,
  validateState,
  validateSettings,
} from '../../src/state.js';

describe('State Utilities', () => {
  describe('mergeDefaults', () => {
    test('merges shallow objects', () => {
      const current = { a: 1 };
      const defaults = { a: 0, b: 2 };
      expect(mergeDefaults(current, defaults)).toEqual({ a: 1, b: 2 });
    });

    test('preserves arrays', () => {
      const current = { tasks: [1, 2] };
      const defaults = { tasks: [3, 4] };
      expect(mergeDefaults(current, defaults)).toEqual({ tasks: [1, 2] });
    });

    test('preserves null values', () => {
      const current = { activeTaskId: null };
      const defaults = { activeTaskId: 'id123' };
      expect(mergeDefaults(current, defaults)).toEqual({ activeTaskId: null });
    });

    test('deep merges nested objects', () => {
      const current = { timer: { phase: 'break' } };
      const defaults = { timer: { phase: 'work', isRunning: false } };
      expect(mergeDefaults(current, defaults)).toEqual({
        timer: { phase: 'break', isRunning: false },
      });
    });
  });

  describe('Task Management', () => {
    test('createTask creates task with defaults', () => {
      const task = createTask('Test Task', 2);
      expect(task).toMatchObject({
        title: 'Test Task',
        estimate: 2,
        completedSessions: 0,
        done: false,
      });
      expect(task.id).toBeTruthy();
    });

    test('updateTaskInList updates target task', () => {
      const tasks = [
        { id: '1', title: 'Task 1', done: false },
        { id: '2', title: 'Task 2', done: false },
      ];
      const updated = updateTaskInList(tasks, '1', { done: true });
      expect(updated).toEqual([
        { id: '1', title: 'Task 1', done: true },
        { id: '2', title: 'Task 2', done: false },
      ]);
    });

    test('removeTaskFromList filters target task', () => {
      const tasks = [
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' },
      ];
      const updated = removeTaskFromList(tasks, '1');
      expect(updated).toEqual([{ id: '2', title: 'Task 2' }]);
    });

    test('getTaskCompletionPercentage calculates correctly', () => {
      expect(getTaskCompletionPercentage({ estimate: 4, completedSessions: 2 })).toBe(50);
      expect(getTaskCompletionPercentage({ estimate: 4, completedSessions: 4 })).toBe(100);
      expect(getTaskCompletionPercentage({ estimate: 4, completedSessions: 0 })).toBe(0);
    });

    test('isTaskComplete checks completion', () => {
      expect(isTaskComplete({ estimate: 2, completedSessions: 2 })).toBe(true);
      expect(isTaskComplete({ estimate: 2, completedSessions: 1 })).toBe(false);
    });
  });

  describe('History Management', () => {
    test('trimHistory limits entries', () => {
      const history = Array(300)
        .fill(null)
        .map((_, i) => ({ id: i }));
      const trimmed = trimHistory(history, 200);
      expect(trimmed.length).toBe(200);
    });

    test('getHistoryStats calculates totals', () => {
      const history = [
        { methodKey: 'pomodoro', phase: 'work', durationMs: 1500000 },
        { methodKey: 'pomodoro', phase: 'break', durationMs: 300000 },
        { methodKey: 'flowtime', phase: 'flow', durationMs: 1800000 },
      ];
      const stats = getHistoryStats(history);
      expect(stats.totalSessions).toBe(3);
      expect(stats.totalTimeMs).toBe(3600000);
      expect(stats.totalTimeMinutes).toBe(60);
      expect(stats.sessionsByPhase.work).toBe(1);
      expect(stats.sessionsByMethod.pomodoro).toBe(2);
    });
  });

  describe('Validation', () => {
    test('validateState accepts valid state', () => {
      const state = {
        timer: { phase: 'work', isRunning: false },
        tasks: [],
        history: [],
      };
      const result = validateState(state);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('validateState rejects invalid state', () => {
      const result = validateState({ tasks: 'not-array' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('validateSettings accepts valid settings', () => {
      const settings = {
        autoStartBreaks: true,
        notifications: true,
        volume: 0.5,
      };
      const result = validateSettings(settings);
      expect(result.valid).toBe(true);
    });

    test('validateSettings rejects invalid settings', () => {
      const result = validateSettings({
        volume: 2, // out of range
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
