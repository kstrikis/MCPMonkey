import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketServer, WebSocket } from 'ws';

// Create a simple logging utility that writes to stderr (to not interfere with native messaging)
const log = {
  debug: (...args: any[]) => console.error('[DEBUG]', ...args),
  info: (...args: any[]) => console.error('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.error('[WARN]', ...args)
  // debug: (...args: any[]) => true,
  // info: (...args: any[]) => true,
  // error: (...args: any[]) => true
};

// Create the MCP server
const serverInfo = {
  name: "MCPMonkey",
  version: "1.0.0"
};

const server = new McpServer(serverInfo);

// Define the port for our WebSocket server
const WS_PORT = 3025;

// Initialize WebSocket server
function initWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({ port: WS_PORT });
  
  wss.on('error', (error) => {
    if ('code' in error && error.code === 'EADDRINUSE') {
      log.info(`Port ${WS_PORT} in use - another instance appears to be running. Exiting gracefully.`);
      process.exit(0);
    }
    log.error('WebSocket server error:', error);
  });

  log.info(`WebSocket server started on port ${WS_PORT}`);
  return wss;
}

const wss = initWebSocketServer();

// Track connected clients
const clients: Set<WebSocket> = new Set();
let mostRecentClient: WebSocket | null = null;  // Track most recent client

// Track pending browser action requests
const pendingBrowserActions = new Map<string, {
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// WebSocket server event handlers
wss.on('connection', (ws) => {
  log.info('New WebSocket client connected');
  clients.add(ws);
  mostRecentClient = ws;  // Set as most recent client

  ws.on('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      log.debug('Received WebSocket message:', parsedMessage);

      // Handle the message based on its type
      if (parsedMessage.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          requestId: parsedMessage.requestId,
          timestamp: Date.now()
        }));
      } else if (parsedMessage.type === 'browserActionResponse') {
        // Handle browser action response
        const { requestId, action, data } = parsedMessage;
        const pending = pendingBrowserActions.get(requestId);
        
        if (pending) {
          clearTimeout(pending.timeout);
          pendingBrowserActions.delete(requestId);
          pending.resolve(data);
        } else {
          log.warn('Received response for unknown browser action request:', requestId);
        }
      } else if (parsedMessage.type === 'register') {
        // When a client registers, make it the most recent client
        mostRecentClient = ws;
        log.info('Client registered and set as most recent client');
      } else {
        // Forward other messages to all connected clients
        clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(parsedMessage));
          }
        });
      }
    } catch (error) {
      log.error('Error handling WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing message',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  });

  ws.on('close', () => {
    log.info('WebSocket client disconnected');
    clients.delete(ws);
    if (mostRecentClient === ws) {
      // If the most recent client disconnected, set the next available client as most recent
      mostRecentClient = clients.size > 0 ? Array.from(clients)[clients.size - 1] : null;
      log.info('Most recent client disconnected, updated most recent client');
    }
  });

  ws.on('error', (error) => {
    log.error('WebSocket error:', error);
  });
});

// Add a debug tool to verify the server is working
server.tool(
  "debug",
  "Test if the MCP server is receiving messages",
  {}, // Empty schema for no arguments
  async () => {
    const debugMessage = "MCP Server is working! Debug message received and processed.";
    log.info(debugMessage);
    return {
      content: [
        {
          type: "text",
          text: debugMessage
        }
      ]
    };
  }
);

// Add a tool to test WebSocket messaging
const sendWebSocketMessageSchema = z.object({
  message: z.string().describe("Message to send to all WebSocket clients"),
});

server.tool(
  "sendWebSocketMessage",
  "Send a message to all connected WebSocket clients",
  { message: z.string().describe("Message to send to all WebSocket clients") },
  async ({ message }) => {
    try {
      const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      const broadcastMessage = {
        type: 'executeAction',
        requestId,
        action: 'testMessage',
        data: {
          message,
          timestamp: new Date().toISOString()
        }
      };

      log.info("Broadcasting WebSocket message:", broadcastMessage);

      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(broadcastMessage));
        }
      });

      return {
        content: [
          {
            type: "text",
            text: `Message broadcast to ${clients.size} clients`
          }
        ]
      };
    } catch (error) {
      log.error("Failed to send WebSocket message:", error);
      return {
        isError: true, // Indicate an error occurred
        content: [
          {
            type: "text",
            text: `Failed to send WebSocket message: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Add a tool to echo back the current server state
const getServerInfoSchema = z.object({}); // Empty object for tools with no parameters

server.tool(
  "getServerInfo",
  "Get information about the current server state",
  {}, // Empty schema as raw shape
  async () => {
    const info = {
      wsPort: WS_PORT,
      connectedClients: clients.size,
      timestamp: new Date().toISOString()
    };

    const infoMessage = `Server info requested: ${JSON.stringify(info)}`;
    log.info(infoMessage);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(info, null, 2)
        }
      ]
    };
  }
);

// Add a tool to handle browser tab operations
const TabSchema = z.object({
  id: z.number(),
  windowId: z.number(),
  url: z.string(),
  title: z.string(),
  active: z.boolean(),
  pinned: z.boolean(),
  index: z.number()
});

const browserTabsSchema = z.object({
  action: z.enum(['getTabs', 'createTab', 'closeTabs', 'activateTab', 'duplicateTab'])
    .describe("The browser action to perform"),
  data: z.object({
    // getTabs has no required data
    // createTab data
    url: z.string().url().optional(),
    active: z.boolean().optional(),
    windowId: z.number().optional(),
    // closeTabs data
    tabIds: z.array(z.number()).optional(),
    // activateTab data
    tabId: z.number().optional(),
    // duplicateTab uses tabId as well
  }).optional()
});

server.tool(
  "browserAction",
  `Execute browser-related actions for tab management.
  
  Available actions and their responses:
  
  1. getTabs: Returns an array of all open tabs
     Response: TabSchema[]
     Example: [{ id: 1, windowId: 1, url: "https://example.com", title: "Example", active: true, pinned: false, index: 0 }, ...]
  
  2. createTab: Creates a new tab
     Parameters: { url?: string, active?: boolean, windowId?: number }
     Response: TabSchema
     Example: { id: 2, windowId: 1, url: "https://example.com", title: "Example", active: true, pinned: false, index: 1 }
  
  3. closeTabs: Closes specified tabs
     Parameters: { tabIds: number[] }
     Response: void (success) or throws error
  
  4. activateTab: Activates (focuses) a specific tab
     Parameters: { tabId: number, windowId?: number }
     Response: TabSchema
     Example: { id: 1, windowId: 1, url: "https://example.com", title: "Example", active: true, pinned: false, index: 0 }
  
  5. duplicateTab: Duplicates a specific tab
     Parameters: { tabId: number }
     Response: TabSchema
     Example: { id: 3, windowId: 1, url: "https://example.com", title: "Example", active: true, pinned: false, index: 2 }`,
  { 
    action: z.enum(['getTabs', 'createTab', 'closeTabs', 'activateTab', 'duplicateTab']),
    data: z.object({}).passthrough()
  },
  async ({ action, data }) => {
    try {
      const requestId = crypto.randomUUID();
      const actionMessage = {
        type: 'executeAction',
        requestId,
        action,
        data: data || {}
      };

      log.info(`Sending browser action to most recent client: ${action}`, actionMessage);

      if (!mostRecentClient || mostRecentClient.readyState !== WebSocket.OPEN) {
        throw new Error('No active browser extension client available');
      }

      // Create a promise that will be resolved when we get the response
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingBrowserActions.delete(requestId);
          reject(new Error(`Browser action '${action}' timed out after 30 seconds`));
        }, 30000);

        pendingBrowserActions.set(requestId, { resolve, reject, timeout });
      });

      // Send only to most recent client
      mostRecentClient.send(JSON.stringify(actionMessage));

      // Wait for the response
      const result = await responsePromise;

      // Validate the response based on the action type
      try {
        switch (action) {
          case 'getTabs':
            z.array(TabSchema).parse(result);
            break;
          case 'createTab':
          case 'activateTab':
          case 'duplicateTab':
            TabSchema.parse(result);
            break;
          case 'closeTabs':
            // closeTabs doesn't return data, just verify it's undefined/null
            if (result !== undefined && result !== null) {
              throw new Error('closeTabs should not return data');
            }
            break;
        }
      } catch (error) {
        log.error(`Response validation failed for ${action}:`, error);
        throw new Error(`Invalid response format for ${action}: ${error instanceof Error ? error.message : String(error)}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      log.error("Failed to execute browser action:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to execute browser action: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// --- Add a test resource ---
server.resource(
    "testResource",
    "test://resource",
    async () => {
        const resourceContent = "This is the content of the test resource.";
        log.info("testResource requested");
        return {
            contents: [{
                text: resourceContent,
                uri: "test://resource",
                mimeType: "text/plain"
            }]
        };
    }
);

// --- Add a test prompt ---
const testPromptSchema = z.object({
    name: z.string().describe("The name of the person to greet"),
});

server.prompt(
    "greet",
    "A simple greeting prompt",
    { name: z.string().describe("The name of the person to greet") },
    async ({ name }) => {
        const greeting = `Hello, ${name}!`;
        log.info("Prompt greet called");
        return {
            messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: greeting
                }
            }]
        };
    }
);

// Start the server
(async () => {
  try {
    log.info("Starting MCP server...");
    const transport = new StdioServerTransport();

    // Ensure stdout is only used for JSON messages
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
      // Only allow JSON messages to pass through
      if (typeof chunk === "string" && !chunk.startsWith("{")) {
        return true; // Silently skip non-JSON messages
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    await server.connect(transport);
    log.info("MCP Server Info:", serverInfo);
    log.info(`MCP Server successfully started. WebSocket server listening on port ${WS_PORT}`);
  } catch (error) {
    log.error("Failed to initialize MCP server:", error);
    process.exit(1);
  }
})();