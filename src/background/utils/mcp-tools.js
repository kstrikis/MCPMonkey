// MCP Tools Implementation
import browser from 'webextension-polyfill';

// Logging utility
const LOG_PREFIX = '[MCP Tools]';
const log = {
  info: (...args) => console.log(LOG_PREFIX, ...args),
  warn: (...args) => console.warn(LOG_PREFIX, ...args),
  error: (...args) => console.error(LOG_PREFIX, ...args),
  debug: (...args) => console.debug(LOG_PREFIX, ...args),
};

/**
 * Get information about all open tabs across all windows
 * @returns {Promise<Array<{
 *   id: number,
 *   windowId: number,
 *   url: string,
 *   title: string,
 *   active: boolean,
 *   pinned: boolean,
 *   index: number
 * }>>}
 */
async function getAllTabs() {
  try {
    const windows = await browser.windows.getAll({ populate: true });
    const tabs = windows.flatMap(window => 
      window.tabs.map(tab => ({
        id: tab.id,
        windowId: tab.windowId,
        url: tab.url,
        title: tab.title,
        active: tab.active,
        pinned: tab.pinned,
        index: tab.index
      }))
    );
    
    log.debug('Retrieved all tabs:', tabs);
    return tabs;
  } catch (error) {
    log.error('Failed to get tabs:', error);
    throw error;
  }
}

/**
 * Create a new tab
 * @param {Object} options
 * @param {string} [options.url] - URL to open in the new tab
 * @param {boolean} [options.active] - Whether the tab should be active
 * @param {number} [options.windowId] - ID of the window to create the tab in
 * @returns {Promise<{
 *   id: number,
 *   windowId: number,
 *   url: string,
 *   title: string,
 *   active: boolean,
 *   pinned: boolean,
 *   index: number
 * }>}
 */
async function createTab(options = {}) {
  try {
    const tab = await browser.tabs.create(options);
    const result = {
      id: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      pinned: tab.pinned,
      index: tab.index
    };
    
    log.debug('Created new tab:', result);
    return result;
  } catch (error) {
    log.error('Failed to create tab:', error);
    throw error;
  }
}

/**
 * Close specified tabs
 * @param {Object} options
 * @param {number[]} options.tabIds - IDs of tabs to close
 * @returns {Promise<void>}
 */
async function closeTabs({ tabIds }) {
  try {
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      throw new Error('tabIds must be a non-empty array of tab IDs');
    }
    
    await browser.tabs.remove(tabIds);
    log.debug('Closed tabs:', tabIds);
  } catch (error) {
    log.error('Failed to close tabs:', error);
    throw error;
  }
}

/**
 * Activate (focus) a specific tab
 * @param {Object} options
 * @param {number} options.tabId - ID of the tab to activate
 * @param {number} [options.windowId] - ID of the window containing the tab
 * @returns {Promise<{
 *   id: number,
 *   windowId: number,
 *   url: string,
 *   title: string,
 *   active: boolean,
 *   pinned: boolean,
 *   index: number
 * }>}
 */
async function activateTab({ tabId, windowId }) {
  try {
    if (!tabId) {
      throw new Error('tabId is required');
    }

    // If windowId is provided, focus that window first
    if (windowId) {
      await browser.windows.update(windowId, { focused: true });
    }

    const tab = await browser.tabs.update(tabId, { active: true });
    const result = {
      id: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      pinned: tab.pinned,
      index: tab.index
    };

    log.debug('Activated tab:', result);
    return result;
  } catch (error) {
    log.error('Failed to activate tab:', error);
    throw error;
  }
}

/**
 * Duplicate a tab
 * @param {Object} options
 * @param {number} options.tabId - ID of the tab to duplicate
 * @returns {Promise<{
 *   id: number,
 *   windowId: number,
 *   url: string,
 *   title: string,
 *   active: boolean,
 *   pinned: boolean,
 *   index: number
 * }>}
 */
async function duplicateTab({ tabId }) {
  try {
    if (!tabId) {
      throw new Error('tabId is required');
    }

    const tab = await browser.tabs.duplicate(tabId);
    const result = {
      id: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      pinned: tab.pinned,
      index: tab.index
    };

    log.debug('Duplicated tab:', result);
    return result;
  } catch (error) {
    log.error('Failed to duplicate tab:', error);
    throw error;
  }
}

// Export all MCP tools
export const mcpTools = {
  getAllTabs,
  createTab,
  closeTabs,
  activateTab,
  duplicateTab
}; 