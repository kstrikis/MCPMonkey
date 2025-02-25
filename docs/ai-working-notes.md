# AI Working Notes

## README Correction: Installation Order and Cursor Setup (2025-02-24)

### Correction Details
- Reorganized installation instructions to emphasize correct order:
  - MCP Server must be installed first
  - Browser Extension installed second
- Clarified server installation with two distinct options:
  - Option 1: Using npm package (with specific Cursor configuration)
  - Option 2: Building from source (with different Cursor configuration)
- Added detailed Cursor setup instructions for each method:
  - Proper name, type, and command fields for each installation method
  - When using built server, command requires absolute path
- Added link to npm package page (https://www.npmjs.com/package/mcpmonkey-server)
- Updated Cursor integration section to reference proper installation order

### Implementation Details
- Cursor configuration for npm package:
  - Name: mcpmonkey-server
  - Type: command
  - Command: `npx mcpmonkey-server`
- Cursor configuration for built server:
  - Name: mcpmonkey-server 
  - Type: command
  - Command: `node /absolute/path/to/mcpmonkey-server/build/index.js`

## README Correction: Implemented vs. Planned Features (2025-02-24)

### Correction Details
- Restructured README to clearly separate current features from planned future features:
  - Created new "Current Features" section highlighting only implemented functionality:
    - Tab Management via browserAction tool
    - Page Style Extraction via getPageStyles tool
    - User Script Support (from Violentmonkey)
  - Created "Planned Features" section for future development items
  - Removed misleading references to features not yet implemented
  - Corrected Technical Details section to reflect only implemented components

### Implementation Status Clarification
- Currently implemented:
  - browserAction tool for tab management
  - getPageStyles tool for style extraction
  - WebSocket communication (internal)
  - Content script bridge
  - Stdio transport for Cursor integration
  
- Not yet implemented (moved to "Planned Features"):
  - MCP Server Management interface
  - Access to browsing history
  - Access to bookmarks
  - Dev console log reading
  - Other extension control
  - Permissions control system
  - Community hub

## README Correction: Server Usage with MCP Inspector (2025-02-24)

### Correction Details
- Fixed incorrect information about the server installation and usage:
  - Removed recommendation to install the server globally as this is not the intended usage
  - Removed standalone server execution instructions (not intended use case)
  - Added proper usage with the MCP inspector for debugging: `npx @modelcontextprotocol/inspector node build/index.js`
  - Clarified that the server is primarily used through npx when needed with Cursor

### Technical Clarification
- The mcpmonkey-server is not meant to be installed globally
- For development and debugging, it should be used with the MCP inspector
- The WebSocket server on port 3025 is only for internal communication with the browser extension
- The intended usage pattern is through direct npx execution or with the inspector

## README Correction: Package Name and Yarn Usage (2025-02-24)

### Correction Details
- Fixed incorrect package information in the README:
  - Corrected npm package name to "mcpmonkey-server" (not @mcpmonkey/server)
  - Updated all commands to use the correct package name
  - Changed server development instructions to use yarn instead of npm
  - Updated the Cursor integration command to `npx mcpmonkey-server`

### Technical Clarification
- The project consistently uses yarn throughout for dependency management
- Server package published to npm as "mcpmonkey-server"
- All server development commands should use yarn (yarn build, yarn dev)

## README Correction: MCP Transport Methods (2025-02-24)

### Correction Details
- Fixed incorrect information about transport methods in the README:
  - Removed reference to SSE transport which is not supported
  - Clarified that Cursor can only connect to MCPMonkey using stdio transport
  - Removed incorrect configuration example for WebSocket/SSE transport
  - Note: The WebSocket connection (port 3025) is only used internally between the browser extension and the MCP server, not for external clients like Cursor

### Technical Clarification
- MCP server supports two transport mechanisms:
  - stdio: Used for connecting external MCP clients like Cursor to the server
  - WebSocket: Used internally for communication between the browser extension and the MCP server
- SSE is not supported for MCP communication

## README Updates for npm Package and Technical Details (2025-02-24)

### Changes Made
- Updated README.md with comprehensive information about the MCPMonkey server:
  - Added details about the npm package (`mcpmonkey-server`)
  - Included installation instructions for both global install and npx usage
  - Updated configuration instructions for Cursor with specific commands
  
- Improved technical documentation:
  - Renamed "Tab Management" to "browserAction Tool" for accuracy
  - Renamed "Page Content Access" to "getPageStyles Tool" for clarity
  - Added details about WebSocket communication on port 3025
  - Added a new Technical Details section covering:
    - WebSocket Communication
    - Content Script Bridge
    - Zod Schema Validation
    - Multiple Transport Support
  
- Enhanced development instructions:
  - Split development section into Extension and Server sections
  - Added detailed server development instructions
  - Improved clarity on how the components work together

### Implementation Details
- The server package is published to npm as `mcpmonkey-server`
- Server implements both stdio and WebSocket transports
- WebSocket server runs on port 3025
- Content script bridge enables communication with web pages
- Zod schema validation ensures data integrity

## README Updates for Cursor MCP Integration (2025-02-24)

### Changes Made
- Updated README.md with information about Cursor's MCP server support:
  - Added details about Cursor's native MCP support (added in version 0.45.7)
  - Included instructions for setting up Cursor with MCPMonkey
  - Noted that Cursor supports both `stdio` and `sse` transports for MCP communication
  
- Documented MCPMonkey's browser tools capabilities:
  - Added details about tab management functions (getAllTabs, createTab, closeTabs, activateTab, duplicateTab)
  - Highlighted page content access features, particularly `getTabStyles()` for style extraction
  - Emphasized that these tools enable AI models to have context-aware interactions with browser sessions

- Added new key features to the feature list:
  - Browser Action Support via browser toolbar button
  - Page Style Extraction for AI analysis

### Research Notes
- Cursor added MCP support in version 0.45.7, based on forum posts
- Cursor's MCP implementation supports two transport methods:
  - stdio (command-line based)
  - sse (Server-Sent Events)
- MCP tools in Cursor are primarily available to the Agent in Composer
- Setting up MCP servers in Cursor requires going to Settings > Features > MCP Servers

### Implementation Details
- The mcp-tools.js module provides several browser interaction functions:
  - Tab management (getAllTabs, createTab, closeTabs, activateTab, duplicateTab)
  - Content access (getTabStyles, injectContentBridge)
  - Storage utilities (getValue, setValue, addStorageListener)
- Communication between content scripts and the extension is facilitated through browser ports and message passing
- Style extraction uses a message-based protocol with request/response pattern

## Project Status - 2024-02-18

### Completed Changes
1. Rebranding from Violentmonkey to MCPMonkey:
   - Updated README.md with new project goals and installation instructions
   - Replaced instances of "Violentmonkey" with "MCPMonkey" in:
     - Localization files (fr, ko, es, etc.)
     - Action helper script
     - Bug report template
     - Various JavaScript files
   - Updated GitHub repository references to point to kstrikis/MCPMonkey

2. Installation Process:
   - Removed store badges and links (Chrome, Firefox, Edge)
   - Added manual installation instructions for Firefox
   - Updated build instructions for development setup

3. Documentation:
   - Added clear acknowledgment of Violentmonkey as base project
   - Updated project description to focus on MCP integration
   - Added use cases for both developers and users
   - Added link to Model Context Protocol (MCP) repository

### Current Configuration
- Node.js version: matches package.json
- Build system: Yarn v1.x
- Development mode: `yarn dev`
- Build commands: 
  - Normal release: `yarn build`
  - Self-hosted: `yarn build:selfHosted`

### Pending Tasks
1. Code Changes:
   - Review and potentially fork @violentmonkey/shortcut package
   - Review and potentially fork @violentmonkey/types package
   - Update any remaining instances of "Violentmonkey" in:
     - Source code comments
     - Documentation files
     - Test files

2. MCP Integration:
   - Implement MCP server management interface
   - Add browser resource access capabilities
   - Develop permissions system for MCP servers
   - Create .mcp.js file handling

3. Documentation Needs:
   - Add Chrome/Edge installation instructions
   - Create detailed MCP server setup guide
   - Document permissions system
   - Add development setup troubleshooting guide

4. Community:
   - Set up community hub website
   - Create contribution guidelines
   - Establish documentation for MCP server development

### Notes
- Currently maintaining compatibility with Violentmonkey's userscript functionality
- Installation requires manual loading through browser debugging tools
- Project focuses on extending functionality rather than replacing existing features
- Need to maintain clear documentation of changes from base project

## ESLint Test Fix and Restricted Syntax Insights (2024-03-21)

### ESLint Test Configuration Fix
- Fixed failing ESLint test by simplifying the test configuration
- Removed Babel parser dependency in test since we only need basic syntax parsing
- Configuration now uses:
  ```javascript
  {
    useEslintrc: false,
    baseConfig: {
      parserOptions: { ecmaVersion: 2021 },
      rules: { 'no-restricted-syntax': ['error', ...restrictedSyntax] }
    }
  }
  ```

### Restricted Syntax Rule Analysis
- The `code` property in restrictedSyntax rules is intentionally hidden using `Object.defineProperty` with `enumerable: false`
  - This prevents ESLint from complaining about invalid schema while keeping test cases with the rules
  - Example: `Object.defineProperty(r, 'code', { enumerable: false, value: r.code })`

- Rule effectiveness verified through enhanced tests:
  1. All restricted patterns are properly caught
  2. Safe code passes without errors
  3. Specific unsafe patterns are caught thoroughly

- Discovered that rules like `Object.assign()` are caught at two levels:
  ```javascript
  selector: '[callee.object.name="Object"], MemberExpression[object.name="Object"]'
  ```
  - Catches the function call (`CallExpression`)
  - Catches the property access (`MemberExpression`)
  - This dual-level detection provides more thorough security coverage

### Security Implications
- The restricted syntax rules are designed to prevent usage of potentially unsafe JavaScript features
- Examples of restricted patterns:
  - Destructuring via Symbol.iterator
  - Spreading via Symbol.iterator
  - Using potentially spoofed Object methods
  - Unsafe prototype descriptor manipulation
- Each restriction has a clear security rationale documented in the error messages
