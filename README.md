# FlexiFocus

A Chrome extension for flexible focus interval timing with multiple work methods.

## Features

- **Multi-Method Timer** - Support for Pomodoro, Flowtime, and custom timing methods
- **Task Tracking** - Manage tasks with time estimates
- **Session History** - Track completed focus sessions
- **Auto-Start** - Automatic work/break transitions
- **Lock-In Mode** - Prevent pause/reset during focus blocks
- **Break Enforcement** - Nudge users to take breaks
- **Theme Support** - Light/dark theme toggle
- **Desktop Notifications** - Get alerted when intervals complete
- **Badge Counter** - Icon badge shows remaining time

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder

## File Structure

```
src/
├── popup/          # Main timer interface
├── options/        # Settings & configuration
├── background/     # Service worker for state management
└── break.html      # Break enforcement page
```

## Usage

- Click the extension icon to open the timer
- Select a focus method and duration
- Add tasks to track your work
- View session history and statistics
- Customize settings via the options page

## Development

Built with vanilla JavaScript, HTML, and CSS. No external dependencies.

### Key Files
- `popup.js` - Timer logic and UI interactions
- `options.js` - Settings management
- `service-worker.js` - Background state and notifications

## Privacy

FlexiFocus respects your privacy. The extension does not collect, store, or transmit any personal data. All settings and timer data are stored locally in your browser. For more details, please see our [Privacy Policy](PRIVACY_POLICY.md).
