# AI Working Notes

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
