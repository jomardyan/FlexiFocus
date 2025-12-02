/**
 * Global Chrome Extension API type declarations
 * Provides IntelliSense for chrome.* APIs in vanilla JS projects
 */

declare namespace chrome {
  namespace runtime {
    interface Message {
      type: string;
      [key: string]: any;
    }

    interface Port {
      name: string;
      onDisconnect: Event;
      onMessage: Event;
      postMessage(message: any): void;
      disconnect(): void;
    }

    function sendMessage(
      extensionId: string | undefined,
      message: any,
      options?: { frameId?: number },
      responseCallback?: (response: any) => void
    ): void;

    function sendMessage(
      message: any,
      options?: { frameId?: number },
      responseCallback?: (response: any) => void
    ): void;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: any,
          sendResponse: (response?: any) => void
        ) => void | boolean
      ): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };

    const onInstalled: {
      addListener(callback: (details: any) => void): void;
    };

    function getURL(path: string): string;
  }

  namespace storage {
    namespace local {
      function get(
        keys: string | string[] | { [key: string]: any },
        callback?: (items: { [key: string]: any }) => void
      ): Promise<{ [key: string]: any }>;

      function set(items: { [key: string]: any }, callback?: () => void): Promise<void>;

      function remove(keys: string | string[], callback?: () => void): Promise<void>;

      function clear(callback?: () => void): Promise<void>;

      function getBytesInUse(
        keys?: string | string[] | null,
        callback?: (bytesInUse: number) => void
      ): Promise<number>;
    }

    namespace session {
      function get(
        keys: string | string[] | { [key: string]: any },
        callback?: (items: { [key: string]: any }) => void
      ): Promise<{ [key: string]: any }>;

      function set(items: { [key: string]: any }, callback?: () => void): Promise<void>;
    }

    namespace sync {
      function get(
        keys: string | string[] | { [key: string]: any },
        callback?: (items: { [key: string]: any }) => void
      ): Promise<{ [key: string]: any }>;

      function set(items: { [key: string]: any }, callback?: () => void): Promise<void>;
    }

    const onChanged: {
      addListener(
        callback: (
          changes: { [key: string]: any },
          areaName: string
        ) => void
      ): void;
    };
  }

  namespace alarms {
    interface Alarm {
      name: string;
      scheduledTime: number;
      periodInMinutes?: number;
    }

    function create(name: string, alarmInfo: any, callback?: () => void): Promise<void>;

    function get(name: string, callback?: (alarm?: Alarm) => void): Promise<Alarm | undefined>;

    function getAll(callback?: (alarms: Alarm[]) => void): Promise<Alarm[]>;

    function clear(name?: string, callback?: () => void): Promise<boolean>;

    function clearAll(callback?: () => void): Promise<boolean>;

    const onAlarm: {
      addListener(callback: (alarm: Alarm) => void): void;
    };
  }

  namespace notifications {
    interface NotificationOptions {
      type: 'basic' | 'image' | 'list' | 'progress';
      iconUrl?: string;
      title?: string;
      message?: string;
      contextMessage?: string;
      priority?: number;
      eventTime?: number;
      buttons?: Array<{ title: string; iconUrl?: string }>;
      imageUrl?: string;
      items?: Array<{ title: string; message: string }>;
      progress?: number;
      isClickable?: boolean;
      requireInteraction?: boolean;
    }

    function create(
      notificationId: string | undefined,
      options: NotificationOptions,
      callback?: (notificationId: string) => void
    ): Promise<string>;

    function update(
      notificationId: string,
      options: NotificationOptions,
      callback?: (wasUpdated: boolean) => void
    ): Promise<boolean>;

    function clear(
      notificationId: string,
      callback?: (wasCleared: boolean) => void
    ): Promise<boolean>;

    function getAll(callback?: (notifications: any) => void): Promise<any>;

    const onClosed: {
      addListener(callback: (notificationId: string, byUser: boolean) => void): void;
    };

    const onClicked: {
      addListener(callback: (notificationId: string) => void): void;
    };

    const onButtonClicked: {
      addListener(callback: (notificationId: string, buttonIndex: number) => void): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      openerTabId?: number;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      status?: string;
      title?: string;
      url?: string;
      favIconUrl?: string;
      incognito: boolean;
    }

    function create(
      createProperties: { url?: string; active?: boolean; [key: string]: any },
      callback?: (tab: Tab) => void
    ): Promise<Tab>;

    function get(tabId: number, callback?: (tab: Tab) => void): Promise<Tab>;

    function getCurrent(callback?: (tab: Tab) => void): Promise<Tab>;

    function query(
      queryInfo: any,
      callback?: (tabs: Tab[]) => void
    ): Promise<Tab[]>;

    function update(
      tabId: number | undefined,
      updateProperties: any,
      callback?: (tab: Tab) => void
    ): Promise<Tab>;

    function remove(tabIds: number | number[], callback?: () => void): Promise<void>;

    const onActivated: {
      addListener(callback: (activeInfo: any) => void): void;
    };
  }

  namespace action {
    function setTitle(details: { title: string; tabId?: number }): Promise<void>;

    function getTitle(
      details: { tabId?: number },
      callback?: (result: string) => void
    ): Promise<string>;

    function setIcon(details: {
      path?: string | { [key: number]: string };
      imageData?: any;
      tabId?: number;
    }): Promise<void>;

    function setBadgeText(details: {
      text: string;
      tabId?: number;
    }): Promise<void>;

    function getBadgeText(
      details: { tabId?: number },
      callback?: (result: string) => void
    ): Promise<string>;

    function setBadgeBackgroundColor(details: {
      color: string | number[];
      tabId?: number;
    }): Promise<void>;

    function getBadgeBackgroundColor(
      details: { tabId?: number },
      callback?: (result: number[]) => void
    ): Promise<number[]>;

    function setBadgeTextColor(details: {
      color: string | number[];
      tabId?: number;
    }): Promise<void>;

    const onClicked: {
      addListener(callback: (tab: chrome.tabs.Tab) => void): void;
    };
  }

  namespace commands {
    const onCommand: {
      addListener(callback: (command: string) => void): void;
    };
  }
}

/**
 * Global chrome object is always available in extension context
 */
declare const chrome: typeof chrome;
