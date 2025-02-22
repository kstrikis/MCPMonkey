#!/bin/bash

# Store the PID file location
PID_FILE="/tmp/mcpmonkey-server.pid"
PWD_FILE="/tmp/mcpmonkey-server-pwd.txt"
MCP_FILE="~/Documents/gauntlet/MCPMonkey/mcpmonkey-server/build/index.js"

# Find and kill any existing MCP server process
pkill -f "node build/index.js" || true

# Wait a moment for the port to be freed
sleep 0.5

# Start the MCP server
node "$MCP_FILE"

# Wait for the server process
wait