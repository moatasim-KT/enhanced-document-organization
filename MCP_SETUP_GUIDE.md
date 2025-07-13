# 🚀 MCP Setup Guide

Quick setup guide for the Enhanced Document Organization MCP Server.

## ⚡ Quick Setup

### 1. **Run Setup Script**
```bash
./setup.sh
```
This configures paths for your system and creates the configuration file.

### 2. **Test MCP Server**  
```bash
./mcp_manager.sh test
```

### 3. **Configure Claude Desktop**
The setup script creates the configuration automatically. If you need to add it manually:

**File**: `~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "enhanced-document-organization": {
      "command": "node",
      "args": ["${PROJECT_ROOT}/mcp-server/server.js"],
      "env": {}
    }
  }
}
```

### 4. **Restart Claude Desktop**

### 5. **Test with Claude**
Ask Claude:
- "Search for documents about machine learning"
- "Show me my document categories"
- "Create a new note about AI research"

### Get System Statistics  
> "Show me statistics about my document organization system"

### Sync Across Platforms
> "Synchronize my documents across all platforms"

## 🛠️ Management Commands

```bash
# Check server status and readiness
./mcp_manager.sh status

# Test server functionality
./mcp_manager.sh test

# Show configuration for MCP clients
./mcp_manager.sh config

# Install/update dependencies
./mcp_manager.sh install

# Interactive testing (for debugging)
./mcp_manager.sh test-interactive
```

## 📋 Available Tools for AI Assistants

1. **search_documents** - Search through organized documents
2. **get_document_content** - Get full document content
3. **organize_documents** - Run organization system
4. **sync_documents** - Synchronize across platforms
5. **get_organization_stats** - Get system statistics
6. **list_categories** - List document categories
7. **create_document** - Create new documents

## 🔄 How It Works with Your Existing System

The MCP server integrates seamlessly with your existing automation:

- **Document Organization**: Uses your `organize_documents_enhanced.sh` script
- **Multi-Platform Sync**: Leverages your `sync_manager.sh` system
- **Automated Processing**: Works with your cron jobs (every 30 minutes)
- **Smart Categorization**: Uses your 47-category classification system

## 📁 Sync Locations Managed

1. **iCloud Drive**: `~/Downloads/Data_Science/Sync_iCloud`
2. **Google Drive**: `~/Downloads/Data_Science/Sync_GoogleDrive`  
3. **Obsidian Vault**: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync`
4. **Google Drive Cloud**: `~/Library/CloudStorage/GoogleDrive-moatasim23android@gmail.com/My Drive/Sync`

## 🎨 Example AI Interactions

### Document Search
**You:** "Find documents about neural networks"
**Claude:** *Uses search_documents tool to find relevant papers and notes*

### Content Creation
**You:** "Create a research note about attention mechanisms"
**Claude:** *Uses create_document tool and auto-organizes into AI_ML category*

### System Management
**You:** "How many documents do I have in each category?"
**Claude:** *Uses list_categories tool to show comprehensive breakdown*

### Organization
**You:** "Organize any new documents I've added"
**Claude:** *Uses organize_documents tool to categorize and structure files*

## 🔧 Troubleshooting

### Server Not Working?
```bash
./mcp_manager.sh test
```

### Dependencies Issues?
```bash
./mcp_manager.sh install
```

### Claude Desktop Not Seeing Server?
1. Check configuration file path and syntax
2. Restart Claude Desktop completely
3. Verify Node.js version (18+ required)

## 🌟 Key Benefits

- **Seamless Integration**: Works with your existing automation
- **AI-Powered Search**: Let AI find exactly what you need
- **Smart Organization**: AI can categorize and organize content
- **Real-time Access**: Changes sync automatically across platforms
- **Zero Maintenance**: Runs on-demand, no background processes

## 📈 What's Next?

Your system now has AI superpowers! You can:

1. **Ask Claude to manage your documents** naturally in conversation
2. **Have AI search and analyze** your knowledge base
3. **Automate content creation** with intelligent categorization
4. **Get insights** about your document collection
5. **Maintain organization** effortlessly through AI assistance

The MCP server bridges your powerful document organization system with AI assistants, making your entire knowledge management workflow intelligent and conversational!

---

**Ready to use?** Just restart Claude Desktop and start asking it to help manage your documents! 🚀
