/* eslint-disable no-unused-vars */
// import { addOwnCommands } from './init'; // Removed unused import
import { mcpTools } from './mcp-tools';

// Logging utility
const LOG_PREFIX = '[MCP Connection]';
const log = {
  info: (...args) => console.log(LOG_PREFIX, ...args),
  warn: (...args) => console.warn(LOG_PREFIX, ...args),
  error: (...args) => console.error(LOG_PREFIX, ...args),
  debug: (...args) => console.debug(LOG_PREFIX, ...args),
};

// WebSocket configuration
const WS_URL = 'ws://localhost:3025';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Connection state tracking
let connectionAttempts = 0;
let ws = null;
let clientId = crypto.randomUUID(); // Generate a unique client ID for this connection

// Store pending requests by their requestId
const pendingRequests = new Map();

function connect() {
  try {
    log.info('Attempting to connect to MCP server...');
    ws = new WebSocket(WS_URL);
    connectionAttempts++;
    
    setupMessageHandlers();
    
    ws.onopen = () => {
      log.info('Successfully connected to MCP server');
      connectionAttempts = 0; // Reset counter on successful connection
      
      // Send initial registration with our client ID
      ws.send(JSON.stringify({
        type: 'register',
        clientId,
        timestamp: Date.now()
      }));
      
      // Send initial ping to verify connection
      sendPing();
    };

    ws.onclose = (event) => {
      log.error('WebSocket connection closed:', event.code, event.reason);
      handleDisconnect(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
    };

    ws.onerror = (error) => {
      log.error('WebSocket error:', error);
      // No need to call handleDisconnect here, as onerror usually precedes onclose
      handleConnectionError(error);
    };
  } catch (error) {
    log.error('Failed to connect to MCP server:', error);
    handleConnectionError(error);
  }
}

function setupMessageHandlers() {
  if (!ws) {
    log.error('Cannot setup handlers: WebSocket is null');
    return;
  }

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      log.debug('Received message:', message);
      
      if (!message || typeof message !== 'object') {
        log.error('Invalid message received:', message);
        return;
      }

      // Check if this message is intended for our client
      if (message.clientId && message.clientId !== clientId) {
        log.debug('Ignoring message intended for different client:', message.clientId);
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
          
          // Handle test messages specifically
          if (action === 'testMessage') {
            log.info('Received test message:', data.message);
            // Send an acknowledgment back
            sendResponse({
              type: 'browserActionResponse',
              requestId,
              action: 'testMessage',
              data: {
                received: true,
                message: data.message,
                timestamp: new Date().toISOString(),
                echo: `Received your message: ${data.message}`
              }
            });
            return;
          }

          const result = await executeAction(action, data);
          log.debug(`Action ${action} completed:`, result);

          sendResponse({
            type: 'browserActionResponse',
            requestId,
            action,
            data: result
          });
        } catch (error) {
          log.error(`Failed to execute action ${action}:`, error);
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
  };
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
  // No need to call ws.close() here; it's already closing/closed
  if (ws) {
    ws = null;
  }
  
  // Clear all pending requests
  for (const [requestId, { reject }] of pendingRequests) {
    reject(new Error('Connection lost'));
  }
  pendingRequests.clear();

  // Attempt reconnection
  handleConnectionError(error);
}

function sendResponse(response) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log.error('Cannot send response: WebSocket is not connected');
    return;
  }

  try {
    // Always include our clientId in responses
    const responseWithClientId = {
      ...response,
      clientId
    };
    log.debug('Sending response:', responseWithClientId);
    ws.send(JSON.stringify(responseWithClientId));
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
    getTabs: async () => await mcpTools.getAllTabs(),
    createTab: async () => await mcpTools.createTab(data),
    closeTabs: async () => await mcpTools.closeTabs(data),
    activateTab: async () => await mcpTools.activateTab(data),
    duplicateTab: async () => await mcpTools.duplicateTab(data)
  };

  if (action in actions) {
    // Await the result of the action
    return await actions[action]();
  }

  throw new Error(`Unknown action: ${action}`);
}

// Send ping to verify connection
function sendPing() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log.error('Cannot send ping: WebSocket is not connected');
    return;
  }

  try {
    log.debug('Sending ping');
    const requestId = crypto.randomUUID(); // Store requestId
    ws.send(JSON.stringify({
      type: 'ping',
      requestId,
      timestamp: Date.now()
    }));
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
  //  ws, // Don't expose ws directly
  requestPermission,
  
  // Expose reconnect function for manual intervention
  reconnect: () => {
    log.info('Manual reconnection requested');
    connectionAttempts = 0; // Reset counter for manual reconnection
    connect();
  },

    // Add a send function if other modules need to send messages
    send: (message) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                log.error('Failed to send message:', error);
            }
        } else {
            log.error('Cannot send message: WebSocket is not connected');
        }
    }
}; 