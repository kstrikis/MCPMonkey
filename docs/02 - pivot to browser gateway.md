# Pivot to Browser Gateway

## Current State Analysis

### Key Modified Files in Previous Implementation

1. Server Management Core:
   - `src/background/utils/server.js` (255 lines added)
   - `src/background/utils/server-commands.js` (91 lines added)
   - `src/background/utils/storage.js` (modifications for server data persistence)
   - `src/background/utils/db.js` (database utilities for server management)

2. UI Components:
   - `src/options/views/tab-mcp-servers.vue` (393 lines)
   - `src/options/views/edit-server.vue` (211 lines)
   - `src/options/views/server-item.vue` (165 lines)

3. Example Implementation:
   - `src/background/calculator-server.js` (129 lines)

### Pivot Direction

The extension is being refactored from an MCP server manager to a browser gateway that will:
1. NOT host or run MCP servers within the extension
2. Act as a bridge between external MCP servers and browser resources
3. Provide access to browser capabilities including:
   - Tab management and content
   - DOM access and manipulation
   - Browser history
   - Bookmarks
   - Network requests and responses
   - Console logs and errors

## Required Changes

### Files to Refactor/Remove

1. Server Management:
   - `src/background/utils/server.js` - Remove server management, replace with browser gateway functionality
   - `src/background/utils/server-commands.js` - Replace server commands with browser interaction commands
   - `src/background/calculator-server.js` - Remove example server implementation

2. UI Components:
   - Remove server management UI components:
     - `src/options/views/tab-mcp-servers.vue`
     - `src/options/views/edit-server.vue`
     - `src/options/views/server-item.vue`

3. Storage:
   - `src/background/utils/storage.js` - Refocus on storing browser gateway configuration
   - `src/background/utils/db.js` - Remove server-related storage

### New Functionality to Implement

1. Browser Resource Access:
   - Tab management and content access
   - DOM manipulation capabilities
   - History and bookmark access
   - Network request monitoring
   - Console logging interface

2. MCP Protocol Integration:
   - Implement MCP client functionality to connect to external servers
   - Create standardized interfaces for browser resource access
   - Implement secure communication channels

3. Configuration:
   - Connection settings for external MCP servers
   - Permission management for browser resource access
   - Logging and debugging settings

## Security Considerations

1. Permission Management:
   - Careful handling of browser API permissions
   - Clear user consent for resource access
   - Granular control over what resources are exposed

2. Data Privacy:
   - No sensitive data exposure without explicit consent
   - Secure communication with external MCP servers
   - Clear logging of resource access

## Next Steps

1. Remove Server Management:
   - Clean up server management code
   - Remove unused UI components
   - Update storage utilities

2. Implement Gateway:
   - Create browser resource access interfaces
   - Implement MCP client functionality
   - Add configuration management

3. Testing:
   - Create test suite for browser resource access
   - Verify secure communication
   - Test integration with external MCP servers 