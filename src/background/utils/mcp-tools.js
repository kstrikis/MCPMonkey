/* eslint-disable no-unused-vars */
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

// Store active port connections
const activePorts = new Map();

// Handle port connections from content scripts
browser.runtime.onConnect.addListener((port) => {
  if (port.name === 'pageStyleExtractor') {
    const tabId = port.sender.tab.id;
    activePorts.set(tabId, port);
    
    port.onDisconnect.addListener(() => {
      activePorts.delete(tabId);
      log.debug('Port disconnected for tab:', tabId);
    });

    port.onMessage.addListener((message) => {
      if (message.command === 'styleData') {
        log.debug('Received style data from tab:', tabId, message);
        // Handle the style data - could emit an event or store it
      } else if (message.command === 'testMessage') {
        log.info('Received test message from tab:', tabId);
        log.info('Test message data:', message.data);
        
        // Send acknowledgment back
        port.postMessage({
          command: 'testAck',
          data: {
            receivedTimestamp: message.data.timestamp,
            ackTimestamp: Date.now()
          }
        });
      }
    });

    log.debug('New port connection from tab:', tabId);
  }
});

// Storage keys
const STORAGE_KEYS = {
  MESSAGE: 'styleExtractorMessage',
  RESPONSE: 'styleExtractorResponse',
  TEST_EXT: 'testFromExtension',
  TEST_SCRIPT: 'testFromUserscript'
};

// Message types for communication
const MESSAGE_TYPES = {
  TEST_DATA: 'MCPMonkey:testData',
  TEST_RESPONSE: 'MCPMonkey:testResponse'
};

/**
 * Get a value from storage
 * @param {string} key - Storage key
 * @returns {Promise<any>} The stored value
 */
async function getValue(key) {
  const result = await browser.storage.local.get(key);
  return result[key];
}

/**
 * Set a value in storage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
async function setValue(key, value) {
  await browser.storage.local.set({ [key]: value });
}

/**
 * Add a listener for storage changes
 * @param {string} key - Storage key to watch
 * @param {Function} callback - Callback function
 */
function addStorageListener(key, callback) {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[key]) {
      callback(changes[key].newValue, changes[key].oldValue);
    }
  });
}

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

/**
 * Request page styling information from a specific tab
 * @param {Object} options
 * @param {number} options.tabId - ID of the tab to get styles from
 * @returns {Promise<Object>} The page style information
 */
async function getTabStyles({ tabId }) {
  try {
    if (!tabId) {
      throw new Error('tabId is required');
    }

    // Send request through GM value
    await browser.tabs.executeScript(tabId, {
      code: `
        GM_setValue('${STORAGE_KEYS.MESSAGE}', JSON.stringify({
          command: 'getStyles',
          timestamp: Date.now()
        }));
      `
    });

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Style extraction timed out'));
      }, 5000);

      // Listen for storage changes
      const listener = async (newValue) => {
        if (!newValue) return;
        
        try {
          const response = JSON.parse(newValue);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
          
          // Clean up
          await browser.storage.local.remove(STORAGE_KEYS.RESPONSE);
          browser.storage.onChanged.removeListener(listener);
          clearTimeout(timeout);
        } catch (error) {
          reject(error);
        }
      };

      addStorageListener(STORAGE_KEYS.RESPONSE, listener);
    });
  } catch (error) {
    log.error('Failed to get tab styles:', error);
    throw error;
  }
}

/**
 * Test communication functionality
 */
async function testStorage() {
  try {
    log.info('Starting extension communication test...');
    
    // Inject content script to handle communication
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) {
      throw new Error('No active tab found');
    }
    
    const tabId = tabs[0].id;
    await browser.tabs.executeScript(tabId, {
      code: `
        // Listen for messages from userscript
        window.addEventListener('message', function(event) {
          if (event.data.type === '${MESSAGE_TYPES.TEST_DATA}') {
            console.log('Content script received from userscript:', event.data);
            // Forward to extension
            browser.runtime.sendMessage(event.data);
            
            // Send response back to userscript
            window.postMessage({
              type: '${MESSAGE_TYPES.TEST_RESPONSE}',
              data: {
                received: event.data,
                timestamp: Date.now()
              }
            }, '*');
          }
        });
        
        console.log('Content script injected and listening...');
      `
    });
    
    // Listen for messages from content script
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === MESSAGE_TYPES.TEST_DATA) {
        log.info('Extension received from userscript:', message);
      }
    });
    
    log.info('Extension test initialized...');
    
  } catch (error) {
    log.error('Extension test failed:', error);
  }
}

// Run test on startup
testStorage();

// Export all MCP tools
export const mcpTools = {
  getAllTabs,
  createTab,
  closeTabs,
  activateTab,
  duplicateTab,
  getTabStyles,
  // Export storage utilities for other modules
  storage: {
    getValue,
    setValue,
    addStorageListener,
    STORAGE_KEYS
  }
}; 