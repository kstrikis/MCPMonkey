import { addOwnCommands } from './init';
import { mcpConnection } from './mcp-connection';

// Helper function to convert chrome.tabs.Tab to our schema
function formatTab(tab) {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    active: tab.active,
    index: tab.index,
    windowId: tab.windowId,
    status: tab.status,
    favIconUrl: tab.favIconUrl,
  };
}

// Helper function to ensure required permissions
async function ensurePermissions(permissions, action, data) {
  const hasPermissions = await browser.permissions.contains({ permissions });
  if (!hasPermissions) {
    // Request permission via MCP server
    await mcpConnection.requestPermission(permissions.join(','), action, data);
    // Verify permissions were granted
    const granted = await browser.permissions.contains({ permissions });
    if (!granted) {
      throw new Error('Required permissions were not granted');
    }
  }
}

// Add browser action commands
addOwnCommands({
  // Get tabs matching the specified criteria
  async GetTabs({ active, windowId, url } = {}) {
    try {
      // Ensure we have tabs permission
      await ensurePermissions(['tabs'], 'getTabs', { active, windowId, url });

      const queryInfo = {};
      
      // Add optional filters
      if (typeof active === 'boolean') queryInfo.active = active;
      if (typeof windowId === 'number') queryInfo.windowId = windowId;
      if (url) queryInfo.url = url;

      // Query tabs
      const tabs = await browser.tabs.query(queryInfo);
      
      // Format response
      return {
        tabs: tabs.map(formatTab),
      };
    } catch (error) {
      console.error('Failed to get tabs:', error);
      throw error;
    }
  },

  // Create a new tab
  async CreateTab({ url, active = true } = {}) {
    try {
      await ensurePermissions(['tabs'], 'createTab', { url, active });
      const tab = await browser.tabs.create({ url, active });
      return formatTab(tab);
    } catch (error) {
      console.error('Failed to create tab:', error);
      throw error;
    }
  },

  // Close specified tabs
  async CloseTabs({ tabIds } = {}) {
    try {
      await ensurePermissions(['tabs'], 'closeTabs', { tabIds });
      await browser.tabs.remove(tabIds);
      return { success: true };
    } catch (error) {
      console.error('Failed to close tabs:', error);
      throw error;
    }
  },

  // Activate (focus) a specific tab
  async ActivateTab({ tabId } = {}) {
    try {
      await ensurePermissions(['tabs'], 'activateTab', { tabId });
      const tab = await browser.tabs.update(tabId, { active: true });
      return formatTab(tab);
    } catch (error) {
      console.error('Failed to activate tab:', error);
      throw error;
    }
  },

  // Reload a specific tab
  async ReloadTab({ tabId } = {}) {
    try {
      await ensurePermissions(['tabs'], 'reloadTab', { tabId });
      const tab = await browser.tabs.reload(tabId);
      return formatTab(tab);
    } catch (error) {
      console.error('Failed to reload tab:', error);
      throw error;
    }
  },

  // Duplicate a specific tab
  async DuplicateTab({ tabId } = {}) {
    try {
      await ensurePermissions(['tabs'], 'duplicateTab', { tabId });
      const tab = await browser.tabs.duplicate(tabId);
      return formatTab(tab);
    } catch (error) {
      console.error('Failed to duplicate tab:', error);
      throw error;
    }
  },
}); 