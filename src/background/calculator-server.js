import { APIKeyAuthProvider, MCPServer } from "mcp-framework";
import { MCPTool } from "mcp-framework";
import { z } from "zod";

// Calculator tools
class AddTool extends MCPTool {
  name = "add";
  description = "Add two numbers together";

  schema = {
    a: {
      type: z.string(),
      description: "First number to add",
    },
    b: {
      type: z.string(),
      description: "Second number to add"
    }
  };

  async execute({ a, b }) {
    const numA = Number.parseInt(a);
    const numB = Number.parseInt(b);
    const sum = numA + numB;
    return `${numA} + ${numB} = ${sum}`;
  }
}

class SubtractTool extends MCPTool {
  name = "subtract";
  description = "Subtract one number from another";

  schema = {
    a: {
      type: z.string(),
      description: "Number to subtract from",
    },
    b: {
      type: z.string(),
      description: "Number to subtract"
    }
  };

  async execute({ a, b }) {
    const numA = Number.parseInt(a);
    const numB = Number.parseInt(b);
    const difference = numA - numB;
    return `${numA} - ${numB} = ${difference}`;
  }
}

class MultiplyTool extends MCPTool {
  name = "multiply";
  description = "Multiply two numbers together";

  schema = {
    a: {
      type: z.string(),
      description: "First number to multiply",
    },
    b: {
      type: z.string(),
      description: "Second number to multiply"
    }
  };

  async execute({ a, b }) {
    const numA = Number.parseInt(a);
    const numB = Number.parseInt(b);
    const product = numA * numB;
    return `${numA} × ${numB} = ${product}`;
  }
}

class DivideTool extends MCPTool {
  name = "divide";
  description = "Divide one number by another";

  schema = {
    a: {
      type: z.string(),
      description: "Number to divide",
    },
    b: {
      type: z.string(),
      description: "Number to divide by"
    }
  };

  async execute({ a, b }) {
    const numA = Number.parseInt(a);
    const numB = Number.parseInt(b);
    if (numB === 0) {
      throw new Error("Cannot divide by zero");
    }
    const quotient = numA / numB;
    return `${numA} ÷ ${numB} = ${quotient}`;
  }
}

// Server setup
const API_KEY = process.env.API_KEY || "default-key";
const PORT = parseInt(process.env.PORT || "1337", 10);

const server = new MCPServer({
  transport: {
    type: "sse",
    options: {
      port: PORT,
      auth: {
        provider: new APIKeyAuthProvider({ keys: [API_KEY] })
      }
    }
  }
});

// Register tools
server.registerTool(new AddTool());
server.registerTool(new SubtractTool());
server.registerTool(new MultiplyTool());
server.registerTool(new DivideTool());

// Start server
server.start().then(() => {
  console.log(`MCP Calculator server running on port ${PORT}`);
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 