---
inclusion: always
---

# Project Guidelines

## Development Rules

### Server Management
- Never run servers directly using `node server.js` or similar commands as they will run indefinitely and freeze the terminal
- Use process managers or background execution when testing server functionality
- For MCP server testing, use the test scripts or invoke tools directly rather than starting the server

### Implementation Process
- Always provide a specification document before implementing new features
- Break down complex features into smaller, manageable components
- Document architectural decisions and patterns used

## Code Architecture

### Project Structure
- `src/mcp/` - Model Context Protocol server implementation
- `src/organize/` - Document organization and categorization logic
- `src/sync/` - Cloud synchronization modules
- `config/` - Configuration files for various services
- `Sync_Hub_New/` - Organized document categories

### Key Components
- **Content Analyzer**: Handles document analysis and categorization
- **Content Consolidator**: Manages duplicate detection and content merging
- **Category Manager**: Maintains document category definitions
- **Sync Modules**: Handles iCloud and Google Drive synchronization

## Coding Standards

### File Handling
- Use absolute paths when working with configuration files
- Maintain proper error handling for file operations
- Log operations to appropriate log files in `logs/` directory

### Configuration Management
- Store sensitive configuration in `.env` files
- Use `.plist` files for macOS-specific configurations
- Maintain separate configs for different sync services

### Testing
- Test MCP tools using the provided test scripts
- Validate file operations before executing
- Check sync status before performing bulk operations

## Best Practices

### Document Organization
- Respect existing category structures in `Sync_Hub_New/`
- Use `_category_info.md` files to define category metadata
- Maintain consistent naming conventions across categories

### Synchronization
- Always check sync status before making changes
- Use unison profiles for reliable bidirectional sync
- Handle conflicts gracefully with user input when needed

### Logging
- Use appropriate log levels (INFO, WARN, ERROR)
- Separate logs by functionality (organize, sync, mcp)
- Include timestamps and context in log entries
