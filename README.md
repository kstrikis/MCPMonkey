# MCPMonkey

MCPMonkey is a fork of [Violentmonkey](https://github.com/violentmonkey/violentmonkey), extending its powerful userscript capabilities to support Model Context Protocol (MCP) servers. This project aims to bridge the gap between AI language models and browser interactions.

## About MCPMonkey

MCPMonkey enhances the browser extension capabilities of Violentmonkey to provide a user-friendly interface for managing and using [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) servers. This allows AI language models like those used in Cursor to interact with your browser in meaningful ways.

### Current Features

MCPMonkey currently implements these key features:

- **Tab Management (browserAction Tool)**:
  - Get information about all open tabs
  - Create new tabs
  - Close tabs
  - Activate (focus) tabs
  - Duplicate tabs
  
- **Page Style Extraction (getPageStyles Tool)**:
  - Extract styling information from web pages for AI analysis
  - Returns structured JSON data about styles
  - Includes global styles, computed styles, color schemes, typography
  
- **User Script Support**: Full compatibility with existing userscripts (inherited from Violentmonkey)

### Planned Features

The following features are planned for future development:

- **MCP Server Management**: Install and manage multiple MCP servers directly from your browser
- **Enhanced Browser Access**: Allow AI tools to interact with:
  - Browsing history
  - Bookmarks
  - Dev console logs
  - Other installed extensions
- **Permissions Control**: Fine-grained control over what resources each MCP server can access
- **Community Hub**: Share and discover MCP servers and scripts

## Cursor MCP Integration

MCPMonkey consists of two main components that need to be installed in the following order:
1. MCP Server
2. Browser Extension

### 1. Adding the MCP Server to Cursor

Using the published NPM package:

- In Cursor, go to `Settings` > `Features` > `MCP Servers`
- Click the `+ Add New MCP Server` button
- Configure the connection with:
   - Name: mcpmonkey-server
   - Type: command
   - Command: `npx mcpmonkey-server`

Or if building yourself:

```sh
# Navigate to the server directory
cd mcpmonkey-server

# Install dependencies
yarn

# Build the server
yarn build

# Run the server
node build/index.js
```

- Configuring in Cursor:
   - Name: mcpmonkey-server
   - Type: command
   - Command: `node /absolute/path/to/mcpmonkey-server/build/index.js`

Cursor connects to the MCPMonkey server using the stdio transport for MCP communication. Once configured, Cursor's Agent in Composer will automatically use available MCP tools when relevant.


### 2. Browser Extension Installation

#### Firefox Installation
1. Build the project following the Development instructions below
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on..."
5. Navigate to the `dist` folder in your MCPMonkey build directory
6. Select any file from the `dist` folder to load the extension

Note: As this is a temporary installation, you'll need to reload the extension each time you restart Firefox.

### 

### MCPMonkey's Browser Tools

Our implementation of MCP tools provides AI language models like those in Cursor with powerful browser interaction capabilities:

- **browserAction Tool**:
  - Get information about all open tabs
  - Create new tabs
  - Close tabs
  - Activate (focus) tabs
  - Duplicate tabs
  
- **getPageStyles Tool**:
  - Extract page styling information (global styles, computed styles, color schemes, typography)
  - Returns structured JSON data for AI analysis
  - Uses content script bridge for communication with web pages

These tools allow AI models to have meaningful, context-aware interactions with your browsing session through a WebSocket connection on port 3025.


For development and testing, you can run the server with the MCP inspector:

```sh
# Run with MCP inspector for debugging
npx @modelcontextprotocol/inspector node build/index.js
```

The server implements both stdio and WebSocket interfaces, with the WebSocket server running on port 3025 for internal communication with the browser extension.

## Use Cases

- **For Developers**:
  - Access browser resources directly from Cursor or other AI tools
  - View console logs and debug information in your AI development environment
  - Create custom MCP servers for specific development needs

- **For Users**:
  - Let your desktop chatbot help you find that website you visited last week
  - Allow AI tools to draft social media messages or emails
  - Automate browser interactions through natural language commands

## Development

### Extension Development

Install [Node.js](https://nodejs.org/) and Yarn v1.x.  
The version of Node.js should match `"node"` key in `package.json`.

```sh
# Install dependencies
$ yarn

# Watch and compile
$ yarn dev
```

Then load the extension from 'dist/'.

### Server Development

The MCP server is implemented in TypeScript and uses the Model Context Protocol SDK:

```sh
# Navigate to the server directory
cd mcpmonkey-server

# Install dependencies
yarn

# Build the server
yarn build

# Run the server in development mode
yarn dev
```

### Build

```sh
# Build for normal releases
$ yarn build

# Build for self-hosted release that has an update_url
$ yarn build:selfHosted
```

## Technical Details

Currently implemented technical components:

- **WebSocket Communication**: The extension and server communicate internally via WebSocket on port 3025
- **Content Script Bridge**: Allows for interaction with web page content through secure messaging
- **Zod Schema Validation**: Ensures data integrity between components with runtime type checking
- **Stdio Transport**: External MCP clients like Cursor connect via stdio transport

## Credits

This project is based on [Violentmonkey](https://github.com/violentmonkey/violentmonkey), an excellent userscript manager that provides the foundation for MCPMonkey's enhanced capabilities. We extend our gratitude to the Violentmonkey team and contributors for their outstanding work.

## Environment Variables

The following environment variables are required for various features:

- `SYNC_GOOGLE_CLIENT_ID` / `SYNC_GOOGLE_CLIENT_SECRET` - Google sync service
- `SYNC_ONEDRIVE_CLIENT_ID` / `SYNC_ONEDRIVE_CLIENT_SECRET` - OneDrive sync service

## Community

Join our community to discuss MCPMonkey, share MCP servers, and get help:

[Community Hub](https://mcpmonkey.org) - Share and discover MCP servers and scripts
[Discord](https://discord.gg/XHtUNSm6Xc) - Join our Discord server for discussions

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the same terms as Violentmonkey. See the [LICENSE](LICENSE) file for details.
