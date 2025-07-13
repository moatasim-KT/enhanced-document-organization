# Enhanced Document Organization MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with powerful access to your enhanced document organization system. This server allows AI assistants to search, read, organize, and manage your synchronized documents across multiple cloud platforms.

## Features

### 🔍 **Document Search & Discovery**
- **Semantic Search**: Search through documents by content, filename, or category
- **Category Filtering**: Search within specific categories (AI/ML, Physics, etc.)
- **Relevance Scoring**: Results ranked by relevance and match quality
- **Content Previews**: Quick previews of matching documents

### 📖 **Document Access**
- **Full Content Reading**: Get complete document content with metadata
- **Resource Listing**: Browse all available documents as MCP resources
- **Category Organization**: Documents organized by intelligent categorization
- **Real-time Access**: Direct access to synchronized documents

### 🤖 **Organization & Management**
- **Auto-Organization**: Run the enhanced document organization system
- **Dry-run Mode**: Preview organization changes before applying
- **Force Mode**: Override sync validation for immediate organization
- **Statistics**: Get detailed stats about document organization

### 🔄 **Synchronization**
- **Multi-platform Sync**: Sync across iCloud, Google Drive, and Obsidian
- **Status Monitoring**: Check sync status and health
- **Force Sync**: Manual sync trigger with override capabilities
- **Real-time Updates**: Changes reflect across all sync locations

### ✍️ **Document Creation**
- **Smart Creation**: Create new documents with automatic categorization
- **Category Placement**: Specify categories or use auto-detection
- **Auto-organization**: Optionally run organization after creation
- **Markdown Support**: Full markdown formatting support

## Tools Available

### `search_documents`
Search through organized documents with advanced filtering.

**Parameters:**
- `query` (required): Search query for content, filename, or category
- `category` (optional): Specific category to search within
- `limit` (optional): Maximum results to return (default: 10)

**Example Usage:**
```json
{
  "query": "machine learning transformers",
  "category": "AI_ML",
  "limit": 5
}
```

### `get_document_content`
Retrieve the full content of a specific document.

**Parameters:**
- `file_path` (required): Relative path to document from sync directory

### `organize_documents`
Run the enhanced document organization system.

**Parameters:**
- `dry_run` (optional): Preview mode without making changes
- `force` (optional): Override sync validation checks

### `sync_documents`
Synchronize documents across all configured locations.

**Parameters:**
- `force` (optional): Force sync even during quiet hours

### `get_organization_stats`
Get comprehensive statistics about the document organization system.

### `list_categories`
List all available categories with file counts and contents.

### `create_document`
Create a new document with intelligent placement.

**Parameters:**
- `title` (required): Document title
- `content` (required): Document content in markdown
- `category` (optional): Target category (auto-detected if not specified)
- `auto_organize` (optional): Run organization after creation

## Installation

1. **Navigate to the MCP server directory:**
   ```bash
   cd /Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/mcp-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Test the server:**
   ```bash
   npm start
   ```

## Configuration

### For Claude Desktop

Add this to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "enhanced-document-organization": {
      "command": "node",
      "args": ["/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/mcp-server/server.js"],
      "env": {}
    }
  }
}
```

### For Other MCP Clients

Use the standard MCP connection format:
- **Command**: `node`
- **Args**: `["/path/to/server.js"]`
- **Protocol**: stdio

## Document Categories

The server recognizes these intelligent categories:

**🤖 AI & ML Categories:**
- AI_ML, Agents, LLMs, Computer_Vision, NLP
- Neural_Networks, Transformers, Reinforcement_Learning, MLOps

**🔬 Research Categories:**
- Physics, Neuroscience, Mathematics, Biology

**💻 Development Categories:**
- Computer_Science, Tools_Frameworks, APIs, Kubernetes
- Git, Databases, Frontend, Backend, DevOps

**📝 Content Categories:**
- Articles, Tutorials, Guides, News, Documentation
- Daily_Notes, Literature_Notes, Meeting_Notes, Ideas

**📊 Organization Categories:**
- Projects, Data, Untitled

## Sync Locations

The server manages documents across these synchronized locations:

1. **iCloud Drive**: `/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud`
2. **Google Drive**: `/Users/moatasimfarooque/Downloads/Data_Science/Sync_GoogleDrive`
3. **Obsidian Vault**: `/Users/moatasimfarooque/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync`
4. **Google Drive Cloud**: `/Users/moatasimfarooque/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync`

## Example Interactions

### Search for AI/ML Papers
```json
{
  "tool": "search_documents",
  "arguments": {
    "query": "transformer architecture attention mechanisms",
    "category": "AI_ML",
    "limit": 3
  }
}
```

### Create a New Research Note
```json
{
  "tool": "create_document",
  "arguments": {
    "title": "GPT-4 Architecture Analysis",
    "content": "# GPT-4 Architecture Analysis\n\n## Key Insights\n\n- Multimodal capabilities...",
    "category": "AI_ML",
    "auto_organize": true
  }
}
```

### Get System Statistics
```json
{
  "tool": "get_organization_stats",
  "arguments": {}
}
```

## Advanced Features

### Content-Based Search
The server performs intelligent content analysis:
- **Keyword Matching**: Searches document content and titles
- **Category Intelligence**: Understands document categorization
- **Relevance Scoring**: Ranks results by match quality
- **Context Preservation**: Maintains document relationships

### Real-time Synchronization
- **Multi-platform**: Sync across iCloud, Google Drive, Obsidian
- **Conflict Resolution**: Intelligent handling of sync conflicts
- **Performance Optimization**: Efficient sync with large document collections
- **Health Monitoring**: Continuous sync status monitoring

### Automation Integration
- **Cron Scheduling**: Automated sync every 30 minutes
- **Health Checks**: Hourly system health monitoring
- **Error Recovery**: Automatic recovery from sync issues
- **Logging**: Comprehensive operation logging

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the server has read/write access to all sync directories
2. **Sync Conflicts**: Use `force: true` in sync operations to override conflicts
3. **Large Documents**: The server handles large document collections efficiently
4. **Network Issues**: Sync operations have built-in retry mechanisms

### Debug Mode
Run the server with inspection for debugging:
```bash
npm run dev
```

### Log Files
Check these locations for detailed logs:
- `/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/sync_manager.log`
- `/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/performance.log`

## API Reference

All tools return structured JSON responses with:
- **Success Status**: Operation completion status
- **Data Payload**: Requested information or operation results
- **Metadata**: Timestamps, file paths, categories
- **Error Handling**: Detailed error messages when operations fail

## Security

- **Local Access Only**: Server operates on local documents only
- **No External APIs**: All operations are local filesystem-based
- **Permission Respect**: Honors filesystem permissions
- **Safe Operations**: Dry-run modes prevent accidental changes

## Contributing

The MCP server is designed to be extensible. Key areas for enhancement:
- Additional search algorithms
- Enhanced categorization logic
- Extended sync platform support
- Advanced content analysis features

## License

MIT License - See the main project for full license details.
