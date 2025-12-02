# FlexiFocus Architecture

## Overview

FlexiFocus is a Chrome extension built with a modular, layered architecture that separates concerns across five key layers: Background orchestration, Services (business logic), UI, Shared utilities, and Type definitions.

## Directory Structure

```
src/
├── background/
│   └── service-worker.js (452 lines)
│       ├── Orchestrates timer, alarms, notifications
│       ├── Manages chrome.runtime message dispatch
│       └── Handles browser events (installation, alarms, commands)
│
├── services/
│   ├── state.js (308 lines)
│   │   ├── State initialization and merging
│   │   ├── Task management (CRUD operations)
│   │   ├── History analytics
│   │   └── Validation functions
│   │
│   ├── timer.js (233 lines)
│   │   ├── Pure timer mathematics (no I/O)
│   │   ├── Phase calculations and transitions
│   │   ├── Progress and duration computations
│   │   └── Timer state queries
│   │
│   ├── storage.js (176 lines)
│   │   ├── Chrome storage abstraction
│   │   ├── Automatic validation on I/O
│   │   ├── Batch operations support
│   │   └── Storage statistics
│   │
│   └── api/
│       └── handlers.js (216 lines)
│           ├── Message routing and dispatch
│           ├── Handler implementations (7 total)
│           ├── State broadcast system
│           └── Error handling
│
├── ui/
│   ├── popup/
│   │   ├── popup.js (451 lines)
│   │   │   ├── UI state management
│   │   │   ├── Event handlers
│   │   │   ├── Ticker (1000ms updates)
│   │   │   └── Theme management
│   │   ├── popup.css
│   │   └── index.html
│   │
│   └── options/
│       ├── options.js
│       │   ├── Settings form management
│       │   ├── Settings persistence
│       │   └── Theme application
│       ├── options.css
│       └── index.html (html/options.html)
│
├── shared/
│   ├── constants.js (71 lines)
│   │   ├── DEFAULT_METHODS (Pomodoro, FlowTime, etc.)
│   │   ├── DEFAULT_SETTINGS
│   │   ├── DEFAULT_STATE
│   │   └── SOUNDS
│   │
│   └── utils.js (40 lines)
│       ├── formatTime()
│       ├── formatDuration()
│       └── capitalize()
│
└── types/
    ├── chrome.d.ts (140 lines)
    │   ├── 12 TypeScript interfaces
    │   ├── TimerState, Task, Settings
    │   ├── Message types
    │   └── Validation result types
    │
    └── chrome-api.d.ts (320 lines)
        ├── chrome.runtime namespace
        ├── chrome.storage namespace
        ├── chrome.alarms namespace
        ├── chrome.notifications namespace
        ├── chrome.tabs namespace
        ├── chrome.action namespace
        └── chrome.commands namespace
```

## Layered Architecture

### Layer 1: Background (Service Worker)
**Role**: Orchestration and event handling
- Initializes on extension load
- Listens for alarms, commands, runtime messages
- Coordinates between services and UI
- Manages long-running timers and state persistence

**Key Responsibilities**:
- Start/pause/reset timer operations
- Update state and trigger notifications
- Broadcast state changes to UI
- Handle keyboard shortcuts
- Initialize extension on install

### Layer 2: Services
**Role**: Pure business logic (stateless, testable)

**state.js**: State management
- Merges and validates state objects
- Creates/updates/removes tasks
- Calculates statistics (completion %, history stats)
- Provides validation functions

**timer.js**: Timer mathematics
- Pure functions (no side effects, no I/O)
- Calculates phase duration, progress, remaining time
- Determines phase transitions
- Queries timer state (expired, can pause, etc.)

**storage.js**: Persistence layer
- Wraps chrome.storage.local API
- Validates on read/write
- Supports batch operations
- Provides storage statistics

**handlers.js**: Message routing
- Defines message handler functions
- Routes incoming messages by type
- Broadcasts state changes
- Handles errors consistently

### Layer 3: UI
**Role**: User interaction and display

**popup/popup.js**: Main timer interface
- Renders timer display with progress ring
- Handles play/pause/reset buttons
- Task management (add, select, remove)
- Ticker updates every 1000ms
- Theme toggling

**options/options.js**: Settings interface
- Form management for all settings
- Settings persistence
- Theme application
- Method configuration

### Layer 4: Shared
**Role**: Cross-cutting concerns

**constants.js**: Application constants
- Timer methods with durations
- Default settings and state
- Sound definitions

**utils.js**: Utility functions
- Time formatting
- String manipulation

### Layer 5: Types
**Role**: Type safety and IDE support

**chrome.d.ts**: Custom types
- Application-specific interfaces
- Message type definitions
- Validation result types

**chrome-api.d.ts**: Chrome namespace types
- Complete chrome API definitions
- Full IntelliSense support
- Exported for JSDoc @param references

## Data Flow

### On Timer Start
```
UI (popup.js)
  ↓ [start-timer message]
Background (service-worker.js)
  ↓ startTimer()
  ├→ storage.loadStateAndSettings() [Storage Layer]
  ├→ timer.getMethodConfig() [Timer Service]
  ├→ state.mergeDefaults() [State Service]
  ├→ storage.saveStateAndSettings() [Storage Layer]
  ├→ chrome.alarms.create() [Browser API]
  ├→ dispatchMessage() [Handler Routing]
  └→ Broadcast state to UI
    ↓
Popup updates with new state and starts ticker
```

### On Alarm Tick (Every second during active timer)
```
Browser (chrome.alarms event)
  ↓ onAlarmListener (service-worker.js)
  ├→ Check if timer still running
  ├→ Update timer state
  └→ Broadcast updated state to popup
    ↓
Popup receives update
  ↓ render()
  ├→ Timer calculations (pure from timer.js)
  ├→ DOM updates (textContent, CSS)
  └→ Visual progress ring updates
```

### On State Change
```
Any operation (start, pause, update task, etc.)
  ↓
state.js computes new state
  ↓
storage.js persists to chrome.storage.local
  ↓
handlers.js broadcasts via chrome.runtime.sendMessage()
  ↓
UI receives update and re-renders
```

## Message Types

### From UI to Background

```javascript
// Start/Resume Timer
{ type: 'START_TIMER', payload: { methodKey?: string, phase?: string } }

// Pause Timer
{ type: 'PAUSE_TIMER' }

// Reset Timer
{ type: 'RESET_TIMER' }

// Add Task
{ type: 'ADD_TASK', payload: { title: string, estimate: number } }

// Update Task
{ type: 'UPDATE_TASK', payload: { taskId: string, updates: {...} } }

// Delete Task
{ type: 'DELETE_TASK', payload: { taskId: string } }

// Get State
{ type: 'GET_STATE' }

// Save Settings
{ type: 'SAVE_SETTINGS', payload: { settings: {...} } }
```

### From Background to UI

```javascript
// State Update (broadcast)
{ type: 'STATE_UPDATE', payload: { state: {...}, settings: {...}, remaining: number } }

// Notification Trigger
{ type: 'SHOW_NOTIFICATION', payload: { title: string, message: string } }

// Alarm Event
{ type: 'ALARM_TRIGGERED', payload: { alarmName: string } }
```

## State Shape

```javascript
{
  timer: {
    methodKey: 'pomodoro',
    phase: 'work',
    isRunning: false,
    startTime: 0,
    endTime: 0,
    remainingMs: 0,
    cycleCount: 0,
    completedSessions: 0,
    activeTaskId: null
  },
  tasks: [
    {
      id: '123',
      title: 'Implement feature',
      estimate: 2,
      completed: false,
      startedAt: 0,
      completedAt: 0
    }
  ],
  history: [
    {
      date: '2024-12-02',
      methodKey: 'pomodoro',
      phasesCompleted: 4,
      totalMinutes: 110,
      breaksTaken: 3
    }
  ]
}
```

## Settings Shape

```javascript
{
  selectedMethod: 'pomodoro',
  autoStartBreaks: false,
  autoStartWork: false,
  lockIn: false,
  notifications: true,
  breakEnforcement: false,
  badge: true,
  sound: 'chime',
  volume: 0.7,
  theme: 'system',
  presets: {
    pomodoro: { workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, ... },
    custom: { workMinutes: 30, breakMinutes: 5, longBreakMinutes: 15, ... }
  }
}
```

## Module Dependencies

### Dependency Graph

```
service-worker.js
├── handlers.js
│   ├── state.js
│   │   └── constants.js
│   └── storage.js
├── timer.js
│   └── constants.js
├── storage.js
├── state.js
│   └── constants.js
└── utils.js

popup.js
├── timer.js
│   └── constants.js
├── utils.js
└── storage.js (indirect via messages)

options.js
├── storage.js
└── state.js
    └── constants.js
```

### No Circular Dependencies ✅

- `storage.js` does not import services
- `timer.js` and `state.js` are independent
- `handlers.js` can import from all services
- Unidirectional dependency flow

## Design Principles

### 1. Separation of Concerns
- Each module has a single responsibility
- Service layer is stateless and testable
- UI layer focuses on rendering and events
- Background orchestrates between layers

### 2. Testability
- Pure functions in timer.js and state.js
- No external I/O in business logic
- Chrome APIs mocked for integration tests
- 65+ unit tests, 30+ integration tests

### 3. Maintainability
- Clear module boundaries
- Consistent naming conventions
- Comprehensive JSDoc comments
- Typed interfaces for all major data structures

### 4. Performance
- Lazy loading of settings
- Batch storage operations
- Debounced state updates
- Minimal DOM manipulation

### 5. Extensibility
- New timer methods added to constants
- New message types added to handlers
- Services don't need modification
- TypeScript foundation for future migration

## Future Improvements

### Short Term
1. E2E tests with Playwright
2. Keyboard shortcut customization UI
3. Export/import history
4. Dark theme variants

### Medium Term
1. Web Worker for timer calculations
2. IndexedDB for large history dataset
3. PWA companion app
4. Sync across devices

### Long Term
1. Full TypeScript migration
2. Build process with bundling
3. Performance monitoring
4. Analytics dashboard

## Technical Debt

### Known Issues
- 6 unused variable warnings (non-critical)
- Options page could be refactored
- Test coverage for UI layer incomplete
- No performance benchmarks in CI/CD

### Addressed Debt ✅
- Code duplication removed
- Monolithic files modularized
- No tests → 115+ tests
- No types → 460+ lines of definitions
- No linting → ESLint + Prettier

