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

// Export all MCP tools
export const mcpTools = {
  getAllTabs
}; 