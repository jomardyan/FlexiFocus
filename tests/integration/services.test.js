/**
 * Integration tests for service layer
 * Tests services with mocked chrome APIs
 */

import { setupChromeMock } from './chrome-mock.js';
import * as storageModule from '../../src/services/storage.js';
import * as stateModule from '../../src/services/state.js';
import * as timerModule from '../../src/services/timer.js';

// Setup chrome mock before importing modules
setupChromeMock();

describe('Service Integration Tests', () => {
  let chrome;

  beforeEach(() => {
    chrome = global.chrome;
    chrome.storage.local.data = {};
  });

  describe('Storage Service', () => {
    it('should save and load state', async () => {
      const testState = {
        timer: {
          methodKey: 'pomodoro',
          phase: 'work',
          isRunning: false,
          startTime: 0,
          endTime: 0,
          remainingMs: 0,
          cycleCount: 0,
          completedSessions: 0,
          activeTaskId: null,
        },
        tasks: [],
        history: [],
      };

      await storageModule.saveState(testState);
      const loaded = await storageModule.loadState();

      expect(loaded).toEqual(testState);
    });

    it('should validate state on load', async () => {
      const invalidState = { invalid: 'structure' };
      chrome.storage.local.data.state = invalidState;

      const result = await storageModule.loadState();
      expect(result).toBeUndefined();
    });

    it('should handle settings', async () => {
      const testSettings = {
        selectedMethod: 'pomodoro',
        autoStartBreaks: true,
        notifications: true,
        volume: 0.5,
      };

      await storageModule.saveSettings(testSettings);
      const loaded = await storageModule.loadSettings();

      expect(loaded.selectedMethod).toBe('pomodoro');
      expect(loaded.autoStartBreaks).toBe(true);
    });

    it('should load state and settings together', async () => {
      const testState = stateModule.initializeState().state;
      const testSettings = stateModule.initializeState().settings;

      await storageModule.saveStateAndSettings(testState, testSettings);
      const { state, settings } = await storageModule.loadStateAndSettings();

      expect(state).toBeDefined();
      expect(settings).toBeDefined();
    });
  });

  describe('State Service', () => {
    it('should create valid tasks', () => {
      const task = stateModule.createTask('Test task', 3);

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test task');
      expect(task.estimate).toBe(3);
      expect(task.completedSessions).toBe(0);
      expect(task.done).toBe(false);
    });

    it('should update tasks in list', () => {
      const task = stateModule.createTask('Task 1');
      const tasks = [task];

      const updated = stateModule.updateTaskInList(tasks, task.id, {
        completedSessions: 1,
      });

      expect(updated[0].completedSessions).toBe(1);
      expect(updated[0].title).toBe('Task 1');
    });

    it('should remove tasks from list', () => {
      const task1 = stateModule.createTask('Task 1');
      const task2 = stateModule.createTask('Task 2');
      const tasks = [task1, task2];

      const filtered = stateModule.removeTaskFromList(tasks, task1.id);

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(task2.id);
    });

    it('should calculate task completion percentage', () => {
      const task = {
        id: '1',
        title: 'Test',
        estimate: 4,
        completedSessions: 2,
        done: false,
      };

      const percentage = stateModule.getTaskCompletionPercentage(task);

      expect(percentage).toBe(50);
    });

    it('should validate state structure', () => {
      const validState = stateModule.initializeState().state;
      const validation = stateModule.validateState(validState);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid state', () => {
      const invalidState = {
        timer: 'invalid',
        tasks: 'not-array',
        history: null,
      };

      const validation = stateModule.validateState(invalidState);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should calculate history statistics', () => {
      const history = [
        {
          id: '1',
          methodKey: 'pomodoro',
          phase: 'work',
          durationMs: 1500000,
          startedAt: Date.now(),
          endedAt: Date.now(),
          taskId: null,
        },
        {
          id: '2',
          methodKey: 'pomodoro',
          phase: 'break',
          durationMs: 300000,
          startedAt: Date.now(),
          endedAt: Date.now(),
          taskId: null,
        },
      ];

      const stats = stateModule.getHistoryStats(history);

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalTimeMs).toBe(1800000);
      expect(stats.sessionsByPhase.work).toBe(1);
      expect(stats.sessionsByPhase.break).toBe(1);
    });
  });

  describe('Timer Service', () => {
    it('should convert minutes to milliseconds', () => {
      const ms = timerModule.msFromMinutes(25);
      expect(ms).toBe(1500000);
    });

    it('should convert milliseconds to minutes', () => {
      const minutes = timerModule.msToMinutes(1500000);
      expect(minutes).toBe(25);
    });

    it('should compute phase duration for Pomodoro', () => {
      const method = {
        key: 'pomodoro',
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
      };

      expect(timerModule.computePhaseDuration(method, 'work')).toBe(1500000);
      expect(timerModule.computePhaseDuration(method, 'break')).toBe(300000);
      expect(timerModule.computePhaseDuration(method, 'longBreak')).toBe(900000);
    });

    it('should compute phase duration for flexible methods', () => {
      const method = {
        key: 'flowtime',
        flexible: true,
        suggestedBreakMinutes: 30,
      };

      const duration = timerModule.computePhaseDuration(method, 'flow');
      expect(duration).toBe(0);
    });

    it('should determine next phase correctly', () => {
      const method = {
        key: 'pomodoro',
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        cyclesBeforeLongBreak: 4,
      };

      let timer = { phase: 'work', cycleCount: 0 };
      let next = timerModule.nextPhase(timer, method);
      expect(next.phase).toBe('break');
      expect(next.longBreak).toBe(false);

      timer = { phase: 'work', cycleCount: 3 };
      next = timerModule.nextPhase(timer, method);
      expect(next.phase).toBe('longBreak');
      expect(next.longBreak).toBe(true);

      timer = { phase: 'break' };
      next = timerModule.nextPhase(timer, method);
      expect(next.phase).toBe('work');
    });

    it('should get phase labels', () => {
      const method = { key: 'pomodoro', flexible: false };

      expect(timerModule.getPhaseLabel('work', method)).toBe('Focus');
      expect(timerModule.getPhaseLabel('break', method)).toBe('Break');
      expect(timerModule.getPhaseLabel('longBreak', method)).toBe('Long Break');

      const flexMethod = { key: 'flowtime', flexible: true };
      expect(timerModule.getPhaseLabel('flow', flexMethod)).toBe('Flowtime');
    });

    it('should get flow reference milliseconds', () => {
      const method = {
        key: 'flowtime',
        flexible: true,
        suggestedBreakMinutes: 30,
      };

      const reference = timerModule.getFlowReferenceMs(method);
      expect(reference).toBe(1800000); // 30 minutes
    });
  });

  describe('Chrome API Integration', () => {
    it('should interact with chrome.storage', async () => {
      const data = { key: 'value', nested: { prop: 123 } };

      await chrome.storage.local.set(data);
      const stored = await chrome.storage.local.get('key');

      expect(stored.key).toBe('value');
    });

    it('should handle chrome.alarms', async () => {
      await chrome.alarms.create('test-alarm', { when: Date.now() + 1000 });
      const alarm = await chrome.alarms.get('test-alarm');

      expect(alarm).toBeDefined();
      expect(alarm.name).toBe('test-alarm');
    });

    it('should clear chrome.alarms', async () => {
      await chrome.alarms.create('test-alarm', { when: Date.now() + 1000 });
      await chrome.alarms.clear('test-alarm');

      const alarm = await chrome.alarms.get('test-alarm');
      expect(alarm).toBeUndefined();
    });

    it('should create notifications', async () => {
      const notifId = await chrome.notifications.create('test-notif', {
        type: 'basic',
        title: 'Test',
        message: 'Test message',
        iconUrl: 'chrome-extension://icon.png',
      });

      expect(notifId).toBeDefined();
      const all = await chrome.notifications.getAll();
      expect(all['test-notif']).toBeDefined();
    });

    it('should trigger message listeners', () => {
      let capturedMessage;
      let capturedResponse;

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        capturedMessage = message;
        sendResponse({ result: 'ok' });
      });

      const message = { type: 'test', data: 'test-data' };
      const response = chrome.runtime.triggerMessage(message);

      expect(capturedMessage).toEqual(message);
      expect(response).toEqual({ result: 'ok' });
    });
  });
});
