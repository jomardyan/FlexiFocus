/**
 * Chrome API mock for integration testing
 * Provides a complete simulation of chrome.* APIs
 */

class ChromeMock {
  constructor() {
    this.storage = new ChromeStorageMock();
    this.alarms = new ChromeAlarmsMock();
    this.runtime = new ChromeRuntimeMock();
    this.notifications = new ChromeNotificationsMock();
    this.tabs = new ChromeTabsMock();
    this.action = new ChromeActionMock();
    this.commands = new ChromeCommandsMock();
  }
}

class ChromeStorageMock {
  constructor() {
    this.data = {};
    const data = this.data;
    this.local = {
      get: async (keys) => {
        if (typeof keys === 'string') {
          return { [keys]: data[keys] };
        }
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(k => (result[k] = data[k]));
          return result;
        }
        if (typeof keys === 'object') {
          const result = { ...keys };
          Object.keys(keys).forEach(k => {
            if (data[k] !== undefined) result[k] = data[k];
          });
          return result;
        }
        return data;
      },
      set: async (items) => {
        Object.assign(data, items);
      },
      remove: async (keys) => {
        if (typeof keys === 'string') {
          delete data[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => delete data[k]);
        }
      },
      clear: async () => {
        Object.keys(data).forEach(k => delete data[k]);
      },
      getBytesInUse: async () => {
        return JSON.stringify(data).length;
      },
    };
  }

  reset() {
    Object.keys(this.data).forEach(k => delete this.data[k]);
  }
}

class ChromeAlarmsMock {
  constructor() {
    this.alarms = {};
    this.onAlarm = {
      listeners: [],
      addListener: (cb) => {
        this.listeners.push(cb);
      },
    };
  }

  async create(name, alarmInfo) {
    const alarm = {
      name,
      scheduledTime: alarmInfo.when || Date.now() + (alarmInfo.delayInMinutes || 0) * 60000,
      periodInMinutes: alarmInfo.periodInMinutes,
    };
    this.alarms[name] = alarm;
  }

  async get(name) {
    return this.alarms[name];
  }

  async getAll() {
    return Object.values(this.alarms);
  }

  async clear(name) {
    if (name) {
      delete this.alarms[name];
      return true;
    }
    this.alarms = {};
    return true;
  }

  async clearAll() {
    this.alarms = {};
    return true;
  }

  triggerAlarm(name) {
    const alarm = this.alarms[name];
    if (alarm && this.onAlarm.listeners) {
      this.onAlarm.listeners.forEach(listener => listener(alarm));
    }
  }
}

class ChromeRuntimeMock {
  constructor() {
    this.messageListeners = [];
    this.installListeners = [];
    this.onMessage = {
      addListener: (cb) => {
        this.messageListeners.push(cb);
      },
    };
    this.onInstalled = {
      addListener: (cb) => {
        this.installListeners.push(cb);
      },
    };
  }

  async sendMessage(message) {
    return { ok: true };
  }

  getURL(path) {
    return `chrome-extension://mock/${path}`;
  }

  triggerMessage(message) {
    const sendResponse = (response) => {
      message._response = response;
    };
    this.messageListeners.forEach(listener => {
      listener(message, {}, sendResponse);
    });
    return message._response;
  }
}

class ChromeNotificationsMock {
  constructor() {
    this.notifications = {};
    this.onClicked = { addListener: () => {} };
    this.onClosed = { addListener: () => {} };
    this.onButtonClicked = { addListener: () => {} };
  }

  async create(notificationId, options) {
    const id = notificationId || `notif-${Date.now()}`;
    this.notifications[id] = options;
    return id;
  }

  async update(notificationId, options) {
    if (this.notifications[notificationId]) {
      this.notifications[notificationId] = options;
      return true;
    }
    return false;
  }

  async clear(notificationId) {
    if (this.notifications[notificationId]) {
      delete this.notifications[notificationId];
      return true;
    }
    return false;
  }

  async getAll() {
    return this.notifications;
  }
}

class ChromeTabsMock {
  constructor() {
    this.tabs = {};
    this.nextTabId = 1;
    this.onActivated = { addListener: () => {} };
  }

  async create(createProperties) {
    const tab = {
      id: this.nextTabId++,
      index: 0,
      windowId: 1,
      highlighted: true,
      active: true,
      pinned: false,
      incognito: false,
      ...createProperties,
    };
    this.tabs[tab.id] = tab;
    return tab;
  }

  async get(tabId) {
    return this.tabs[tabId];
  }

  async getCurrent() {
    return Object.values(this.tabs)[0];
  }

  async query(queryInfo) {
    return Object.values(this.tabs).filter(tab => {
      if (queryInfo.active !== undefined && tab.active !== queryInfo.active) return false;
      if (queryInfo.url && !tab.url?.includes(queryInfo.url)) return false;
      return true;
    });
  }

  async update(tabId, updateProperties) {
    const tab = this.tabs[tabId];
    if (tab) {
      Object.assign(tab, updateProperties);
      return tab;
    }
  }

  async remove(tabIds) {
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    ids.forEach(id => delete this.tabs[id]);
  }
}

class ChromeActionMock {
  constructor() {
    this.badgeText = '';
    this.badgeColor = '#000000';
    this.title = '';
    this.onClicked = { addListener: () => {} };
  }

  async setTitle(details) {
    this.title = details.title;
  }

  async getTitle() {
    return this.title;
  }

  async setIcon(details) {
    // Mock icon setting
  }

  async setBadgeText(details) {
    this.badgeText = details.text;
  }

  async getBadgeText() {
    return this.badgeText;
  }

  async setBadgeBackgroundColor(details) {
    this.badgeColor = details.color;
  }

  async getBadgeBackgroundColor() {
    return this.badgeColor;
  }

  async setBadgeTextColor(details) {
    // Mock text color setting
  }
}

class ChromeCommandsMock {
  constructor() {
    this.onCommand = {
      addListener: () => {},
    };
  }
}

// Export the mock
export function createChromeMock() {
  return new ChromeMock();
}

// Setup global chrome mock
export function setupChromeMock() {
  if (typeof global !== 'undefined') {
    global.chrome = new ChromeMock();
  }
  if (typeof window !== 'undefined') {
    window.chrome = new ChromeMock();
  }
}
