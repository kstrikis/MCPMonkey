import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Define message types
type BrowserAction = 'getTabs' | 'createTab' | 'closeTabs' | 'activateTab';

interface BrowserMessage {
  type: 'executeAction';
  requestId: string;
  action: BrowserAction;
  data: unknown;
}

// Define schemas for browser tab information
const TabSchema = z.object({
  id: z.number(),
  url: z.string().url().optional(),
  title: z.string().optional(),
  active: z.boolean(),
  index: z.number(),
  windowId: z.number(),
  status: z.string().optional(),
  favIconUrl: z.string().url().optional(),
});

const TabsResponseSchema = z.object({
  tabs: z.array(TabSchema),
});

type Tab = z.infer<typeof TabSchema>;
type TabsResponse = z.infer<typeof TabsResponseSchema>;

// Define message schemas
const BrowserActionResponseSchema = z.object({
  type: z.literal('browserActionResponse'),
  requestId: z.string(),
  action: z.string(),
  data: z.unknown(),
});

const ErrorResponseSchema = z.object({
  type: z.literal('error'),
  requestId: z.string(),
  code: z.string(),
  message: z.string(),
});

const ResponseSchema = z.discriminatedUnion('type', [
  BrowserActionResponseSchema,
  ErrorResponseSchema,
]);

type BrowserResponse = z.infer<typeof ResponseSchema>;

// Map to store pending requests
const pendingRequests = new Map();

// Create an MCP server
const server = new McpServer({
  name: "MCPMonkey",
  version: "0.1.0"
});

// Helper function to send a message to the browser extension and wait for response
async function sendBrowserMessage(action: BrowserAction, data: unknown = {}): Promise<unknown> {
  const requestId = crypto.randomUUID();
  const message: BrowserMessage = {
    type: 'executeAction',
    requestId,
    action,
    data,
  };

  // Write the message to stdout for the native messaging host
  const messageBuffer = Buffer.from(JSON.stringify(message) + '\n');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
  process.stdout.write(lengthBuffer);
  process.stdout.write(messageBuffer);

  // Wait for response
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timed out'));
    }, 30000);

    pendingRequests.set(requestId, {
      resolve: (data: unknown) => {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        resolve(data);
      },
      reject: (error: Error) => {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        reject(error);
      },
    });
  });
}

// Handle messages from the browser extension
process.stdin.on('data', (data: Buffer) => {
  try {
    const message = JSON.parse(data.toString());
    const result = ResponseSchema.safeParse(message);
    
    if (!result.success) {
      console.error('Invalid message received:', result.error);
      return;
    }

    const { type, requestId } = result.data;
    const request = pendingRequests.get(requestId);
    if (!request) {
      console.error('No pending request found for:', requestId);
      return;
    }

    if (type === 'error') {
      request.reject(new Error(result.data.message));
    } else if (type === 'browserActionResponse') {
      request.resolve(result.data.data);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error handling message:', error.message);
    }
  }
});

// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a tool to get browser tabs
server.tool("getTabs",
  { 
    active: z.boolean().optional(),
    windowId: z.number().optional(),
    url: z.string().url().optional(),
  },
  async (params) => {
    try {
      const response = await sendBrowserMessage('getTabs', params) as TabsResponse;
      return {
        content: [
          { 
            type: "text", 
            text: `Found ${response.tabs.length} tabs:`,
          },
          {
            type: "text", 
            text: JSON.stringify(response.tabs, null, 2),
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get browser tabs: ${error.message}`);
      }
      throw new Error('Failed to get browser tabs: Unknown error');
    }
  }
);

// Add a tool to create a new tab
server.tool("createTab",
  {
    url: z.string().url(),
    active: z.boolean().optional(),
  },
  async (params) => {
    try {
      const tab = await sendBrowserMessage('createTab', params) as Tab;
      return {
        content: [
          {
            type: "text",
            text: `Created new tab: ${tab.url || 'unknown url'}`,
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create tab: ${error.message}`);
      }
      throw new Error('Failed to create tab: Unknown error');
    }
  }
);

// Add a tool to close tabs
server.tool("closeTabs",
  {
    tabIds: z.array(z.number()),
  },
  async (params) => {
    try {
      await sendBrowserMessage('closeTabs', params);
      return {
        content: [
          {
            type: "text",
            text: `Closed ${params.tabIds.length} tab(s)`,
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to close tabs: ${error.message}`);
      }
      throw new Error('Failed to close tabs: Unknown error');
    }
  }
);

// Add a tool to activate a tab
server.tool("activateTab",
  {
    tabId: z.number(),
  },
  async (params) => {
    try {
      const tab = await sendBrowserMessage('activateTab', params) as Tab;
      return {
        content: [
          {
            type: "text",
            text: `Activated tab: ${tab.url || 'unknown url'}`,
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to activate tab: ${error.message}`);
      }
      throw new Error('Failed to activate tab: Unknown error');
    }
  }
);

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);