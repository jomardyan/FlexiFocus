/**
 * Shared constants and default configurations for FlexiFocus
 */

export const ALARM_NAME = 'flexifocus-timer';
export const BADGE_ALARM = 'flexifocus-badge';

export const DEFAULT_METHODS = {
  pomodoro: {
    key: 'pomodoro',
    label: 'Pomodoro',
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
  },
  fiftyTwoSeventeen: {
    key: 'fiftyTwoSeventeen',
    label: '52 / 17',
    workMinutes: 52,
    shortBreakMinutes: 17,
    longBreakMinutes: 17,
    cyclesBeforeLongBreak: 1,
  },
  ultradian: {
    key: 'ultradian',
    label: 'Ultradian 90 / 20',
    workMinutes: 90,
    shortBreakMinutes: 20,
    longBreakMinutes: 20,
    cyclesBeforeLongBreak: 1,
  },
  flowtime: {
    key: 'flowtime',
    label: 'Flowtime',
    flexible: true,
    suggestedBreakMinutes: 10,
  },
  quick5: {
    key: 'quick5',
    label: 'Quick 5 Min',
    workMinutes: 5,
    shortBreakMinutes: 1,
    longBreakMinutes: 1,
    cyclesBeforeLongBreak: 1,
  },
  quick10: {
    key: 'quick10',
    label: 'Quick 10 Min',
    workMinutes: 10,
    shortBreakMinutes: 2,
    longBreakMinutes: 2,
    cyclesBeforeLongBreak: 1,
  },
  quick15: {
    key: 'quick15',
    label: 'Quick 15 Min',
    workMinutes: 15,
    shortBreakMinutes: 3,
    longBreakMinutes: 3,
    cyclesBeforeLongBreak: 1,
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    workMinutes: 30,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
  },
};

export const DEFAULT_SETTINGS = {
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
  theme: 'system',
};

export const DEFAULT_STATE = {
  timer: {
    methodKey: DEFAULT_SETTINGS.selectedMethod,
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
  statistics: {
    totalSessions: 0,
    totalFocusTime: 0,
    totalBreakTime: 0,
    longestSession: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
  },
};

export const SOUNDS = {
  chime: { type: 'triangle', frequency: 880, duration: 0.7 },
  softBell: { type: 'sine', frequency: 660, duration: 0.9 },
};
