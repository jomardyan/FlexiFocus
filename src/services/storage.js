/**
 * Storage abstraction layer for FlexiFocus
 * Thin wrapper around chrome.storage.local with type hints and error handling
 */

import { validateState, validateSettings } from './state.js';

const STORAGE_KEYS = {
  STATE: 'state',
  SETTINGS: 'settings',
};

/**
 * Load state from chrome storage
 * @returns {Promise<Object>} Stored state object
 * @throws {Error} If storage read fails or state is invalid
 */
export async function loadState() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.STATE]);
    const state = stored[STORAGE_KEYS.STATE];

    if (state) {
      const validation = validateState(state);
      if (!validation.valid) {
        console.warn('Invalid stored state, returning undefined:', validation.errors);
        return undefined;
      }
    }

    return state;
  } catch (error) {
    console.error('Error loading state from storage:', error);
    throw new Error(`Failed to load state: ${error.message}`);
  }
}

/**
 * Load settings from chrome storage
 * @returns {Promise<Object>} Stored settings object
 * @throws {Error} If storage read fails or settings are invalid
 */
export async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
    const settings = stored[STORAGE_KEYS.SETTINGS];

    if (settings) {
      const validation = validateSettings(settings);
      if (!validation.valid) {
        console.warn('Invalid stored settings, returning undefined:', validation.errors);
        return undefined;
      }
    }

    return settings;
  } catch (error) {
    console.error('Error loading settings from storage:', error);
    throw new Error(`Failed to load settings: ${error.message}`);
  }
}

/**
 * Load both state and settings in parallel
 * @returns {Promise<{state: Object|undefined, settings: Object|undefined}>}
 */
export async function loadStateAndSettings() {
  try {
    const results = await Promise.all([loadState(), loadSettings()]);
    return {
      state: results[0],
      settings: results[1],
    };
  } catch (error) {
    console.error('Error loading state and settings:', error);
    throw error;
  }
}

/**
 * Save state to chrome storage
 * @param {Object} state - State to save
 * @returns {Promise<void>}
 * @throws {Error} If validation fails or storage write fails
 */
export async function saveState(state) {
  const validation = validateState(state);
  if (!validation.valid) {
    throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
  }

  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.STATE]: state });
  } catch (error) {
    console.error('Error saving state to storage:', error);
    throw new Error(`Failed to save state: ${error.message}`);
  }
}

/**
 * Save settings to chrome storage
 * @param {Object} settings - Settings to save
 * @returns {Promise<void>}
 * @throws {Error} If validation fails or storage write fails
 */
export async function saveSettings(settings) {
  const validation = validateSettings(settings);
  if (!validation.valid) {
    throw new Error(`Settings validation failed: ${validation.errors.join(', ')}`);
  }

  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  } catch (error) {
    console.error('Error saving settings to storage:', error);
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}

/**
 * Save both state and settings in parallel
 * @param {Object} state - State to save
 * @param {Object} settings - Settings to save
 * @returns {Promise<void>}
 */
export async function saveStateAndSettings(state, settings) {
  const stateValidation = validateState(state);
  const settingsValidation = validateSettings(settings);

  if (!stateValidation.valid || !settingsValidation.valid) {
    const errors = [];
    if (!stateValidation.valid) {
      errors.push(`State: ${stateValidation.errors.join(', ')}`);
    }
    if (!settingsValidation.valid) {
      errors.push(`Settings: ${settingsValidation.errors.join(', ')}`);
    }
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATE]: state,
      [STORAGE_KEYS.SETTINGS]: settings,
    });
  } catch (error) {
    console.error('Error saving state and settings:', error);
    throw new Error(`Failed to save: ${error.message}`);
  }
}

/**
 * Clear all stored data
 * @returns {Promise<void>}
 */
export async function clearStorage() {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw new Error(`Failed to clear storage: ${error.message}`);
  }
}

/**
 * Get storage usage statistics
 * @returns {Promise<{bytesInUse: number, quotaBytes: number}>}
 */
export async function getStorageStats() {
  try {
    const info = await chrome.storage.local.getBytesInUse();
    return {
      bytesInUse: info,
      quotaBytes: 10 * 1024 * 1024, // Chrome extension storage quota
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    throw new Error(`Failed to get storage stats: ${error.message}`);
  }
}
