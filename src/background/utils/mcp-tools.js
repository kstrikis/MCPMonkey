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
  STYLE_REQUEST: 'MM_ext:styleRequest',
  STYLE_RESPONSE: 'MM_us:styleResponse'
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
 * Inject the content script bridge for userscript communication
 * @param {number} tabId - ID of the tab to inject into
 */
async function injectContentBridge(tabId) {
  await browser.tabs.executeScript(tabId, {
    code: `
      // Minimal bridge to forward messages to extension
      window.addEventListener('message', function(event) {
        // Only forward userscript messages to the extension
        if (event.source === window && event.data?.type?.startsWith('MM_us:')) {
          browser.runtime.sendMessage(event.data).catch(error => {
            console.error('Failed to forward message to extension:', error);
          });
        }
      });
      
      console.log('MCP message bridge active');
    `
  });
  
  log.debug('Injected message bridge into tab:', tabId);
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

    log.info('Requesting styles from tab:', tabId);

    // Ensure content bridge is injected
    await injectContentBridge(tabId);

    // Set up message listener before sending request
    const styleData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        log.error('Style extraction timed out for tab:', tabId);
        cleanup();
        reject(new Error('Style extraction timed out'));
      }, 5000);

      function handleMessage(message) {
        log.debug('Extension received message:', message);
        
        if (message.type === MESSAGE_TYPES.STYLE_RESPONSE) {
          log.info('Received style response from userscript:', message);
          
          // Extract the actual style data from the response
          const extractedStyles = message.data?.styles;
          if (!extractedStyles) {
            log.error('No style data in response:', message);
            cleanup();
            reject(new Error('No style data received from userscript'));
            return;
          }

          log.info('Extracted style data:', extractedStyles);
          cleanup();
          resolve({ styles: extractedStyles });  // Return object with styles property
        }
      }

      function cleanup() {
        log.debug('Cleaning up message listener');
        browser.runtime.onMessage.removeListener(handleMessage);
        clearTimeout(timeout);
      }

      // Listen for response
      log.debug('Adding message listener');
      browser.runtime.onMessage.addListener(handleMessage);

      // Generate UUID for this request
      const messageId = crypto.randomUUID();

      // Send request via content script
      log.debug('Sending style request to content script');
      browser.tabs.executeScript(tabId, {
        code: `
          window.postMessage({
            type: '${MESSAGE_TYPES.STYLE_REQUEST}',
            messageId: '${messageId}',
            data: {
              timestamp: Date.now()
            }
          }, '*');
        `
      });
    });

    return styleData;
  } catch (error) {
    log.error('Failed to get tab styles:', error);
    throw error;
  }
}

// Export all MCP tools
export const mcpTools = {
  getAllTabs,
  createTab,
  closeTabs,
  activateTab,
  duplicateTab,
  getTabStyles,
  injectContentBridge,
  // Export storage utilities for other modules
  storage: {
    getValue,
    setValue,
    addStorageListener,
    STORAGE_KEYS
  }
}; 