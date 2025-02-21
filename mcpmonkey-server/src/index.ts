import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketServer, WebSocket } from 'ws';

// Create a simple logging utility that writes to stderr (to not interfere with native messaging)
const log = {
  debug: (...args: any[]) => console.error('[DEBUG]', ...args),
  info: (...args: any[]) => console.error('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

// Create the MCP server
const server = new McpServer({
  name: "MCPMonkey",
  version: "0.1.0"
});

// Define the port for our WebSocket server
const WS_PORT = 3025;

// Initialize WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });

// Track connected clients
const clients: Set<WebSocket> = new Set();

// WebSocket server event handlers
wss.on('connection', (ws) => {
  log.info('New WebSocket client connected');
  clients.add(ws);

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
    }
  });

  ws.on('close', () => {
    log.info('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    log.error('WebSocket error:', error);
  });
});

// Add a debug tool to verify the server is working
server.tool(
  "debug",
  "Test if the MCP server is receiving messages",
  async () => {
    log.info("Debug tool was called successfully");
    return {
      content: [
        {
          type: "text",
          text: "MCP Server is working! Debug message received and processed."
        }
      ]
    };
  }
);

// Add a tool to test WebSocket messaging
server.tool(
  "sendWebSocketMessage",
  { message: z.string().describe("Message to send to all WebSocket clients") },
  async ({ message }) => {
    try {
      const broadcastMessage = {
        type: 'executeAction',
        requestId: crypto.randomUUID(),
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
      throw error;
    }
  }
);

// Add a tool to echo back the current server state
server.tool(
  "getServerInfo",
  "Get information about the current server state",
  async () => {
    const info = {
      wsPort: WS_PORT,
      connectedClients: clients.size,
      timestamp: new Date().toISOString()
    };
    
    log.info("Server info requested:", info);
    
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

// Start the server
(async () => {
  try {
    log.info("Starting MCP server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info(`MCP Server successfully started. WebSocket server listening on port ${WS_PORT}`);
  } catch (error) {
    log.error("Failed to initialize MCP server:", error);
    process.exit(1);
  }
})();