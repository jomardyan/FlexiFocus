/**
 * Shared utility functions for FlexiFocus
 * Used across UI and background scripts
 */

/**
 * Format milliseconds to MM:SS display format
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string (e.g., "25:30")
 */
export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds to short duration string
 * @param {number} ms - Milliseconds (default 0)
 * @returns {string} Duration string (e.g., "25m", "30s", "0m")
 */
export function formatDuration(ms = 0) {
  if (!ms) {
    return '0m';
  }
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) {
    return `${Math.max(1, Math.round(ms / 1000))}s`;
  }
  return `${minutes}m`;
}

/**
 * Capitalize first character of string
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 */
export function capitalize(text = '') {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
