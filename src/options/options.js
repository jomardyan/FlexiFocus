const els = {
  autoWork: document.getElementById('auto-work'),
  autoBreaks: document.getElementById('auto-breaks'),
  lockIn: document.getElementById('lock-in'),
  notifications: document.getElementById('notifications'),
  sound: document.getElementById('sound'),
  volume: document.getElementById('volume'),
  badge: document.getElementById('badge'),
  customWork: document.getElementById('custom-work'),
  customBreak: document.getElementById('custom-break'),
  customLong: document.getElementById('custom-long'),
  customCycles: document.getElementById('custom-cycles'),
  theme: document.getElementById('theme'),
  save: document.getElementById('save'),
  status: document.getElementById('status')
};

let settings = null;

init();

async function init() {
  const data = await chrome.runtime.sendMessage({ type: 'getState' });
  settings = data.settings;
  populateForm(settings);
  els.save.addEventListener('click', saveSettings);
  els.theme.addEventListener('change', () => applyTheme(els.theme.value));
  applyTheme(settings.theme || 'system');
}

function populateForm(s) {
  els.autoWork.checked = !!s.autoStartWork;
  els.autoBreaks.checked = !!s.autoStartBreaks;
  els.lockIn.checked = !!s.lockIn;
  els.notifications.checked = !!s.notifications;
  els.badge.checked = !!s.badge;
  els.sound.value = s.sound || 'none';
  els.volume.value = s.volume ?? 0.7;
  els.theme.value = s.theme || 'system';

  const custom = (s.presets && s.presets.custom) || {};
  els.customWork.value = custom.workMinutes ?? 30;
  els.customBreak.value = custom.shortBreakMinutes ?? custom.breakMinutes ?? 5;
  els.customLong.value = custom.longBreakMinutes ?? 15;
  els.customCycles.value = custom.cyclesBeforeLongBreak ?? 4;
}

async function saveSettings() {
  const payload = {
    autoStartWork: els.autoWork.checked,
    autoStartBreaks: els.autoBreaks.checked,
    lockIn: els.lockIn.checked,
    notifications: els.notifications.checked,
    badge: els.badge.checked,
    sound: els.sound.value === 'none' ? '' : els.sound.value,
    volume: Number(els.volume.value) || 0.7,
    theme: els.theme.value || 'system',
    presets: {
      ...(settings?.presets || {}),
      custom: {
        ...(settings?.presets?.custom || {}),
        workMinutes: Number(els.customWork.value) || 30,
        shortBreakMinutes: Number(els.customBreak.value) || 5,
        longBreakMinutes: Number(els.customLong.value) || 15,
        cyclesBeforeLongBreak: Number(els.customCycles.value) || 4
      }
    }
  };

  await chrome.runtime.sendMessage({ type: 'updateSettings', settings: payload });
  applyTheme(payload.theme);
  els.status.textContent = 'Saved';
  setTimeout(() => { els.status.textContent = ''; }, 1800);
}

function applyTheme(theme) {
  const resolved = theme === 'system'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;
  document.documentElement.dataset.theme = resolved;
}
