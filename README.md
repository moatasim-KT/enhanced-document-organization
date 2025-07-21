# 🚀 Enhanced Document Organization System v2.0

A comprehensive, intelligent document organization system with advanced features for content analysis, deduplication, sync management, and **Model Context Protocol (MCP) server** for AI assistant integration.

## 🌟 System Overview

This system provides:
- **🧠 Smart Content Analysis**: Automatically categorizes files based on content
- **🔄 Incremental Processing**: Only processes changed files for efficiency  
- **🔍 Advanced Deduplication**: Content-hash based duplicate detection
- **📊 Comprehensive Reporting**: Detailed statistics and progress tracking
- **🛡️ Enhanced Safety**: Automatic backups and integrity checking
- **🌐 Multi-location Sync**: Supports iCloud, Google Drive, and local folders
- **🤖 MCP Server**: AI assistant integration for natural language document management

## 🚀 Quick Start

### 1. **Setup and Configuration**
```bash
# Clone the repository
git clone https://github.com/moatasim-KT/enhanced-document-organization.git
cd enhanced-document-organization

# Run interactive setup (configures paths for your system)
./setup.sh
```

### 2. **Test the System**
```bash
./mcp_manager.sh test          # Test MCP server
./organize_manager.sh status   # Check organization system  
./sync_manager.sh status       # Check sync system
```

### 3. **Run Organization**
```bash
./organize_manager.sh run      # Organize documents with smart categorization
```

### 4. **Use with AI Assistants (Optional)**
- The setup creates configuration for Claude Desktop
- Restart Claude Desktop to use MCP tools
- Ask Claude to search, organize, or manage your documents

## 📁 System Components

### 🔧 Core Scripts
- **`organize_documents_enhanced.sh`** - Main enhanced organization script
- **`organize_manager.sh`** - Management utility with command interface
- **`sync_manager.sh`** - Sync management (if using Unison)
- **`mcp_manager.sh`** - MCP server management
- **`setup.sh`** - Interactive system configuration

### ⚙️ Configuration
- **`organize_config.conf`** - Comprehensive configuration file
- **`config.env.example`** - Environment configuration template
- **`config.env`** - Your custom configuration (created by setup.sh)
- **`unison_*.prf`** - Unison profiles (if using Unison sync)

### 🤖 MCP Server
- **`mcp-server/server.js`** - Model Context Protocol server
- **`mcp-server/package.json`** - Node.js dependencies
- **`mcp-server/README.md`** - Detailed MCP documentation

### 📖 Documentation
- **`README.md`** - This file with complete system documentation
- **`MCP_SETUP_GUIDE.md`** - Quick MCP setup guide

## 🛠️ Configuration System

The system uses environment variables for configuration, making it portable across different users and systems.

### Default Paths (Configurable)
```bash
# Project paths
PROJECT_ROOT="${HOME}/Downloads/Programming/CascadeProjects/Drive_sync"
DATA_SCIENCE_ROOT="${HOME}/Downloads/Data_Science"

# Sync directories  
SYNC_ICLOUD="${DATA_SCIENCE_ROOT}/Sync_iCloud"
SYNC_GDRIVE="${DATA_SCIENCE_ROOT}/Sync_GoogleDrive"
SYNC_OBSIDIAN="${HOME}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"
SYNC_GDRIVE_CLOUD="${HOME}/Library/CloudStorage/GoogleDrive-${GOOGLE_DRIVE_EMAIL}/My Drive/Sync"
```

### Manual Configuration
If you prefer manual setup, copy and customize:
```bash
cp config.env.example config.env
# Edit config.env with your paths and email
```

## 📂 Document Categories

The system intelligently organizes documents into these categories:

### 🤖 **AI & ML**
- **Agents**: AI agent development and research
- **LLMs**: Large Language Models and transformers  
- **Computer_Vision**: Image processing and analysis
- **NLP**: Natural Language Processing
- **Neural_Networks**: Deep learning architectures
- **Reinforcement_Learning**: RL algorithms and applications
- **MLOps**: Machine Learning operations and deployment

### 📚 **Research Papers**
- **AI_ML**: Artificial Intelligence and Machine Learning
- **Physics**: Physics research and papers
- **Neuroscience**: Brain science and cognitive research
- **Mathematics**: Mathematical research and proofs
- **Computer_Science**: CS theory and algorithms
- **Biology**: Life sciences and biotechnology

### 💻 **Development**
- **Tools_Frameworks**: Development tools and frameworks
- **APIs**: API documentation and references
- **Kubernetes**: Container orchestration
- **Git**: Version control and workflows
- **Documentation**: Technical documentation
- **Databases**: Database design and queries
- **Frontend**: Web frontend development
- **Backend**: Server-side development
- **DevOps**: Development operations and CI/CD

### 🌐 **Web Content**
- **Articles**: Web articles and blog posts
- **Tutorials**: How-to guides and tutorials
- **Guides**: Step-by-step instructions
- **News**: Technology news and updates
- **Netclips**: Web clips and bookmarks

### 📝 **Notes & Drafts**
- **Daily_Notes**: Daily journaling and notes
- **Literature_Notes**: Research literature notes
- **Meeting_Notes**: Meeting minutes and summaries
- **Ideas**: Brainstorming and concept notes
- **Untitled**: Uncategorized draft documents

### 🔬 **Projects**
- **Active**: Currently active projects
- **Completed**: Finished projects
- **Ideas**: Project ideas and proposals

### 📊 **Data**
- **Datasets**: Data files and collections
- **Analysis**: Data analysis results
- **Visualizations**: Charts, graphs, and plots

## ⚡ Management Commands

### 📋 Organization Management
```bash
./organize_manager.sh run       # Run full organization
./organize_manager.sh dry-run   # Preview changes
./organize_manager.sh status    # System status
./organize_manager.sh stats     # View statistics
./organize_manager.sh backup    # Create manual backup
./organize_manager.sh validate  # Validate organization
```

### 🔄 Sync Management  
```bash
./sync_manager.sh sync          # Run synchronization
./sync_manager.sh status        # Check sync status
./sync_manager.sh health        # Health monitoring
./sync_manager.sh performance   # Performance metrics
```

### 🤖 MCP Server Management
```bash
./mcp_manager.sh status         # Check server readiness
./mcp_manager.sh test           # Test functionality
./mcp_manager.sh test-interactive # Interactive testing
./mcp_manager.sh config         # Show configuration
./mcp_manager.sh install        # Install dependencies
```

## 🌟 AI Integration Features

With the MCP server, you can use natural language to:

### 🔍 **Search Documents**
- "Find all documents about machine learning transformers"
- "Search for papers about neural networks in the AI category"
- "Show me recent documents about kubernetes"

### 📖 **Read Content**
- "Get the content of the GPT-4 architecture document"
- "Show me the full text of documents about reinforcement learning"

### 🤖 **Organize Documents**
- "Organize all my documents automatically"
- "Run organization in dry-run mode to preview changes"

### ✍️ **Create Documents**
- "Create a new research note about transformer attention mechanisms"
- "Add a document about Docker containerization to the DevOps category"

### 📊 **Get Statistics**
- "Show me statistics about my document collection"
- "How many documents do I have in each category?"

## 🔧 Advanced Features

### 📈 **Performance Optimization**
- **Incremental Processing**: Only processes changed files
- **Content Hashing**: Efficient duplicate detection
- **Parallel Processing**: Multi-threaded operations
- **Memory Management**: Optimized for large collections

### 🛡️ **Safety & Reliability**
- **Automatic Backups**: Before each organization run
- **Integrity Checking**: Validates file operations
- **Error Recovery**: Robust error handling
- **Dry-run Mode**: Preview changes before applying

### 📊 **Monitoring & Analytics**
- **Comprehensive Logging**: Detailed operation logs
- **Performance Metrics**: Processing time and throughput
- **Health Monitoring**: System status checks
- **Statistical Reports**: Organization insights

## 🚀 Automation

### Automated Sync (Optional)
The system can be configured for automatic synchronization:

```bash
# Add to crontab for automated sync every 30 minutes
*/30 * * * * /path/to/sync_manager.sh sync

# Health monitoring every hour  
15 * * * * /path/to/sync_manager.sh health
```

### Background Processing
- Documents are organized automatically when added to sync folders
- Cross-platform synchronization happens transparently
- AI categorization runs without user intervention

## 🔍 Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure read/write access to all sync directories
2. **Node.js Missing**: Install Node.js 18+ for MCP server functionality
3. **Sync Conflicts**: Use force mode or check sync validation settings
4. **Missing Directories**: Run `./setup.sh` to create required directories

### Debug Mode
```bash
# Enable verbose output
export VERBOSE_OUTPUT="true"
./organize_manager.sh run

# Check system status
./organize_manager.sh validate
```

### Log Files
- **Sync logs**: `sync_manager.log`
- **Performance logs**: `performance.log`  
- **MCP server logs**: `mcp-server/server.log`

## 📄 License

MIT License - Feel free to use, modify, and distribute.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🆘 Support

- **Documentation**: Check `mcp-server/README.md` for detailed MCP information
- **Issues**: Report bugs and feature requests on GitHub
- **Configuration**: Use `./setup.sh` for interactive configuration help

---

**Made with ❤️ for intelligent document organization and AI integration**
