/* eslint-disable no-unused-vars */
import { addOwnCommands } from './init';

// Logging utility
const LOG_PREFIX = '[MCP Connection]';
const log = {
  info: (...args) => console.log(LOG_PREFIX, ...args),
  warn: (...args) => console.warn(LOG_PREFIX, ...args),
  error: (...args) => console.error(LOG_PREFIX, ...args),
  debug: (...args) => console.debug(LOG_PREFIX, ...args),
};

// Connection state tracking
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Store pending requests by their requestId
const pendingRequests = new Map();

// Connection management
let port = null;

function connect() {
  try {
    log.info('Attempting to connect to MCP server...');
    port = browser.runtime.connectNative('mcpmonkey');
    connectionAttempts++;
    
    setupMessageHandlers();
    
    log.info('Successfully connected to MCP server');
    connectionAttempts = 0; // Reset counter on successful connection
    
    // Send initial ping to verify connection
    sendPing();
  } catch (error) {
    log.error('Failed to connect to MCP server:', error);
    handleConnectionError(error);
  }
}

function setupMessageHandlers() {
  if (!port) {
    log.error('Cannot setup handlers: port is null');
    return;
  }

port.onMessage.addListener(async (message) => {
  try {
      log.debug('Received message:', message);
      
    if (!message || typeof message !== 'object') {
        log.error('Invalid message received:', message);
      return;
    }

    const { type, requestId, action, data } = message;

      if (type === 'executeAction') {
        if (!requestId || !action) {
          log.error('Invalid executeAction message:', message);
          return;
        }

        try {
          log.info(`Executing action: ${action}`, data);
          const result = await executeAction(action, data);
          log.debug(`Action ${action} completed:`, result);

          // Send the response back with the correct type
          sendResponse({
            type: 'browserActionResponse',
            requestId,
            action,
            data: result
          });
        } catch (error) {
          log.error(`Failed to execute action ${action}:`, error);
          // Send error response with the correct type
          sendResponse({
            type: 'error',
            requestId,
            code: 'ACTION_FAILED',
            message: error.message || 'Action execution failed'
          });
        }
      } else if (type === 'pong') {
        log.debug('Received pong response');
      } else {
        log.warn('Unknown message type received:', type);
      }
    } catch (error) {
      log.error('Error handling MCP server message:', error);
    }
  });

port.onDisconnect.addListener((p) => {
  const error = browser.runtime.lastError;
    log.error('Disconnected from MCP server:', error?.message || 'Unknown reason');
    handleDisconnect(error);
  });
}

function handleConnectionError(error) {
  log.error('Connection error:', error);
  
  if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
    log.info(`Attempting reconnection in ${RECONNECT_DELAY}ms (attempt ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    setTimeout(connect, RECONNECT_DELAY);
  } else {
    log.error('Max reconnection attempts reached. Manual intervention required.');
  }
}

function handleDisconnect(error) {
  port = null;
  
  // Clear all pending requests
  for (const [requestId, { reject }] of pendingRequests) {
    reject(new Error('Connection lost'));
  }
  pendingRequests.clear();

  // Attempt reconnection
  handleConnectionError(error);
}

function sendResponse(response) {
  if (!port) {
    log.error('Cannot send response: port is null');
    return;
  }

  try {
    log.debug('Sending response:', response);
    port.postMessage(response);
  } catch (error) {
    log.error('Failed to send response:', error);
  }
}

// Execute a browser action
async function executeAction(action, data) {
  log.info(`Executing browser action: ${action}`, data);
  
  if (!action) {
    throw new Error('No action specified');
  }

  const actions = {
    getTabs: () => browser.runtime.sendMessage({ cmd: 'GetTabs', data }),
    createTab: () => browser.runtime.sendMessage({ cmd: 'CreateTab', data }),
    closeTabs: () => browser.runtime.sendMessage({ cmd: 'CloseTabs', data }),
    activateTab: () => browser.runtime.sendMessage({ cmd: 'ActivateTab', data }),
    reloadTab: () => browser.runtime.sendMessage({ cmd: 'ReloadTab', data }),
    duplicateTab: () => browser.runtime.sendMessage({ cmd: 'DuplicateTab', data })
  };

  if (action in actions) {
    return actions[action]();
  }

  throw new Error(`Unknown action: ${action}`);
}

// Send ping to verify connection
function sendPing() {
  if (!port) {
    log.error('Cannot send ping: port is null');
    return;
  }

  try {
    log.debug('Sending ping');
    port.postMessage({
      type: 'ping',
      requestId: crypto.randomUUID(),
      timestamp: Date.now()
    });
  } catch (error) {
    log.error('Failed to send ping:', error);
  }
}

// Request permission from the user
async function requestPermission(permission, action, data = {}) {
  log.info(`Permission request for ${permission} to perform ${action}`, data);
  // TODO: Implement proper permission UI in the browser extension
  return Promise.resolve();
}

// Initialize connection
connect();

// Export functions for use in other modules
export const mcpConnection = {
  port,
  requestPermission,
  
  // Expose reconnect function for manual intervention
  reconnect: () => {
    log.info('Manual reconnection requested');
    connectionAttempts = 0; // Reset counter for manual reconnection
    connect();
  }
}; 