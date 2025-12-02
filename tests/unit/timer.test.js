/**
 * Unit tests for timer.js utilities
 */

import {
  msFromMinutes,
  msToMinutes,
  computePhaseDuration,
  nextPhase,
  getPhaseLabel,
  getPhaseStatus,
  computeProgress,
  computeRemaining,
  getFlowReferenceMs,
  isWorkPhase,
  isBreakPhase,
  canPauseTimer,
  canResumeTimer,
  canStartTimer,
} from '../../src/services/timer.js';

describe('Timer Utilities', () => {
  describe('Time Conversions', () => {
    test('msFromMinutes converts minutes to ms', () => {
      expect(msFromMinutes(0)).toBe(0);
      expect(msFromMinutes(1)).toBe(60000);
      expect(msFromMinutes(25)).toBe(1500000);
    });

    test('msToMinutes converts ms to minutes', () => {
      expect(msToMinutes(0)).toBe(0);
      expect(msToMinutes(60000)).toBe(1);
      expect(msToMinutes(1500000)).toBe(25);
    });
  });

  describe('Phase Duration', () => {
    const pomodoroMethod = {
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
    };

    const flowtimeMethod = {
      flexible: true,
      suggestedBreakMinutes: 10,
    };

    test('computePhaseDuration for work phase', () => {
      expect(computePhaseDuration(pomodoroMethod, 'work')).toBe(1500000); // 25 min
    });

    test('computePhaseDuration for short break', () => {
      expect(computePhaseDuration(pomodoroMethod, 'break')).toBe(300000); // 5 min
    });

    test('computePhaseDuration for long break', () => {
      expect(computePhaseDuration(pomodoroMethod, 'longBreak')).toBe(900000); // 15 min
    });

    test('computePhaseDuration for flexible method returns 0', () => {
      expect(computePhaseDuration(flowtimeMethod, 'flow')).toBe(0);
    });
  });

  describe('Phase Transitions', () => {
    const pomodoroMethod = {
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
    };

    test('nextPhase from work to break', () => {
      const timer = { phase: 'work', cycleCount: 0 };
      const next = nextPhase(timer, pomodoroMethod);
      expect(next.phase).toBe('break');
      expect(next.longBreak).toBe(false);
    });

    test('nextPhase from work to long break on cycle boundary', () => {
      const timer = { phase: 'work', cycleCount: 3 };
      const next = nextPhase(timer, pomodoroMethod);
      expect(next.phase).toBe('longBreak');
      expect(next.longBreak).toBe(true);
    });

    test('nextPhase from break to work', () => {
      const timer = { phase: 'break', cycleCount: 0 };
      const next = nextPhase(timer, pomodoroMethod);
      expect(next.phase).toBe('work');
    });

    test('nextPhase for flowtime always goes to flow', () => {
      const timer = { phase: 'work', cycleCount: 0 };
      const flowtimeMethod = { flexible: true };
      const next = nextPhase(timer, flowtimeMethod);
      expect(next.phase).toBe('flow');
    });
  });

  describe('Phase Labels', () => {
    test('getPhaseLabel for work phase', () => {
      expect(getPhaseLabel('work', {})).toBe('Focus');
    });

    test('getPhaseLabel for break phase', () => {
      expect(getPhaseLabel('break', {})).toBe('Break');
    });

    test('getPhaseLabel for long break', () => {
      expect(getPhaseLabel('longBreak', {})).toBe('Long Break');
    });

    test('getPhaseLabel for flowtime', () => {
      const method = { flexible: true };
      expect(getPhaseLabel('flow', method)).toBe('Flowtime');
    });
  });

  describe('Phase Classification', () => {
    test('isWorkPhase identifies work phases', () => {
      expect(isWorkPhase('work')).toBe(true);
      expect(isWorkPhase('flow')).toBe(true);
      expect(isWorkPhase('break')).toBe(false);
      expect(isWorkPhase('longBreak')).toBe(false);
    });

    test('isBreakPhase identifies break phases', () => {
      expect(isBreakPhase('break')).toBe(true);
      expect(isBreakPhase('longBreak')).toBe(true);
      expect(isBreakPhase('work')).toBe(false);
      expect(isBreakPhase('flow')).toBe(false);
    });
  });

  describe('Timer State Checks', () => {
    test('canPauseTimer when running', () => {
      const timer = { isRunning: true };
      expect(canPauseTimer(timer)).toBe(true);
    });

    test('canPauseTimer when paused', () => {
      const timer = { isRunning: false };
      expect(canPauseTimer(timer)).toBe(false);
    });

    test('canResumeTimer with remaining time', () => {
      const timer = { isRunning: false, remainingMs: 100000 };
      expect(canResumeTimer(timer)).toBe(true);
    });

    test('canResumeTimer in non-work phase', () => {
      const timer = { isRunning: false, remainingMs: 0, phase: 'break' };
      expect(canResumeTimer(timer)).toBe(true);
    });

    test('canResumeTimer with no time and work phase', () => {
      const timer = { isRunning: false, remainingMs: 0, phase: 'work' };
      expect(canResumeTimer(timer)).toBe(false);
    });

    test('canStartTimer when paused', () => {
      const timer = { isRunning: false };
      expect(canStartTimer(timer)).toBe(true);
    });

    test('canStartTimer when running', () => {
      const timer = { isRunning: true };
      expect(canStartTimer(timer)).toBe(false);
    });
  });

  describe('Flow Reference', () => {
    test('getFlowReferenceMs uses suggested break time', () => {
      const method = { suggestedBreakMinutes: 15 };
      expect(getFlowReferenceMs(method)).toBe(30 * 60 * 1000);
    });

    test('getFlowReferenceMs enforces minimum', () => {
      const method = { suggestedBreakMinutes: 5 };
      expect(getFlowReferenceMs(method)).toBe(30 * 60 * 1000); // minimum
    });

    test('getFlowReferenceMs defaults to 30 minutes', () => {
      const method = {};
      expect(getFlowReferenceMs(method)).toBe(30 * 60 * 1000);
    });
  });
});
