/**
 * Type definitions for Chrome Extension APIs
 * Provides comprehensive type hints for chrome namespace
 */

/**
 * Timer state structure
 */
export interface TimerState {
  methodKey: string;
  phase: 'work' | 'break' | 'longBreak' | 'flow';
  isRunning: boolean;
  startTime: number;
  endTime: number;
  remainingMs: number;
  cycleCount: number;
  completedSessions: number;
  activeTaskId: string | null;
}

/**
 * Task structure
 */
export interface Task {
  id: string;
  title: string;
  estimate: number;
  completedSessions: number;
  done: boolean;
}

/**
 * History entry structure
 */
export interface HistoryEntry {
  id: string;
  methodKey: string;
  phase: string;
  durationMs: number;
  startedAt: number;
  endedAt: number;
  taskId: string | null;
}

/**
 * Application state structure
 */
export interface AppState {
  timer: TimerState;
  tasks: Task[];
  history: HistoryEntry[];
}

/**
 * User settings structure
 */
export interface Settings {
  selectedMethod: string;
  presets: Record<string, any>;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  lockIn: boolean;
  notifications: boolean;
  sound: string;
  volume: number;
  breakEnforcement: boolean;
  badge: boolean;
  theme: 'system' | 'light' | 'dark';
}

/**
 * Timer method configuration
 */
export interface TimerMethod {
  key: string;
  label: string;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  flexible?: boolean;
  suggestedBreakMinutes?: number;
}

/**
 * Chrome runtime message types
 */
export interface RuntimeMessage {
  type: string;
  [key: string]: any;
}

/**
 * Chrome storage change event
 */
export interface StorageChange {
  oldValue?: any;
  newValue?: any;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Message handler result
 */
export interface HandlerResult {
  ok?: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Storage stats
 */
export interface StorageStats {
  bytesInUse: number;
  quotaBytes: number;
}

/**
 * History statistics
 */
export interface HistoryStats {
  totalSessions: number;
  totalTimeMs: number;
  totalTimeMinutes: number;
  sessionsByPhase: Record<string, number>;
  sessionsByMethod: Record<string, number>;
}
