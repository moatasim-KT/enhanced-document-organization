# Enhanced Document Organization System

A comprehensive, intelligent document organization system with advanced reliability features for content analysis, synchronization across cloud services, and AI-powered assistance.

## Overview

This system provides automated organization and synchronization of documents across multiple cloud platforms (iCloud, Google Drive) with intelligent categorization, reliability enhancements, and AI integration through a Model Context Protocol (MCP) server.

### Key Features

- **Smart Content Analysis**: Automatically categorizes files based on content
- **Multi-Platform Sync**: Seamless synchronization across iCloud and Google Drive
- **Enhanced Reliability**: Circuit breaker pattern, adaptive retry, and automated recovery
- **AI Integration**: MCP server for AI assistants to manage documents intelligently
- **Simplified Categories**: Option for 5 main categories or detailed 47+ category system

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Document Organization                      │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │Content Analysis │  │  Categorization │  │  Deduplication  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Sync Reliability Layer                     │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │Error Classification│  │Adaptive Retry   │  │Circuit Breaker  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │Recovery Engine  │  │Health Monitoring│  │Self-Healing     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloud Synchronization                      │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   iCloud Sync   │  │ Google Drive Sync│  │  Local Storage  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI Integration                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   MCP Server    │  │Document Search  │  │Content Creation  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
Drive_sync/
├── drive_sync.sh              # Main entry point script
├── config.env                 # Environment configuration
├── organize_config.conf       # Organization settings
├── README.md                  # This file
│
├── organize/                  # Organization module
│   └── organize_module.sh     # Consolidated organization script
│
├── sync/                      # Sync module
│   └── sync_module.sh         # Consolidated sync script
│
├── mcp/                       # MCP module
│   ├── mcp_manager.sh         # MCP server management
│   ├── server.js              # MCP server implementation
│   └── package.json           # MCP server dependencies
│
├── tests/                     # Test scripts
│   ├── test_category_patterns_simple.sh
│   ├── test_recovery_action_registry.sh
│   ├── test_recovery_engine.sh
│   └── test_simplified_categorization.sh
│
└── .cache/                    # Processing cache
    ├── processed_files.db     # Database of processed files
    └── content_hashes.db      # Database of content hashes
```

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Drive_sync
   ```

2. **Install dependencies**:
   ```bash
   # Install Unison for sync
   brew install unison
   
   # Install Node.js for MCP server
   brew install node
   
   # Install MCP server dependencies
   cd mcp
   npm install
   cd ..
   ```

3. **Configure paths**:
   Edit `config.env` to set your specific paths for iCloud, Google Drive, and local directories.

4. **Set up sync profiles**:
   ```bash
   # Copy Unison profiles to ~/.unison/
   cp unison_icloud.prf ~/.unison/icloud.prf
   cp unison_google_drive.prf ~/.unison/google_drive.prf
   ```

5. **Set up automation** (optional):
   ```bash
   # Copy LaunchAgent plist to ~/Library/LaunchAgents/
   cp com.moatasim.enhanced-document-organization.plist ~/Library/LaunchAgents/
   
   # Load the LaunchAgent
   launchctl load ~/Library/LaunchAgents/com.moatasim.enhanced-document-organization.plist
   ```

## Usage

### Main Command

```bash
# Show help
./drive_sync.sh help

# Run complete workflow (sync → organize → sync)
./drive_sync.sh all
```

### Document Organization

```bash
# Run document organization
./drive_sync.sh organize run

# Test organization without making changes
./drive_sync.sh organize dry-run

# Check organization status
./drive_sync.sh organize status

# Create a new custom category
./drive_sync.sh organize create-category "Data Science" "📊" "data science,machine learning,statistics"
```

### Sync Management

```bash
# Run sync process
./drive_sync.sh sync sync

# Check sync health
./drive_sync.sh sync health

# Reset circuit breakers
./drive_sync.sh sync reset-circuit

# Show sync status
./drive_sync.sh sync status
```

### MCP Server (AI Integration)

```bash
# Start MCP server
./drive_sync.sh mcp start

# Check MCP server status
./drive_sync.sh mcp status

# Test MCP server
./drive_sync.sh mcp test
```

## Document Categories

### Simplified 5-Category System

The system can use a simplified 5-category structure:

1. **🤖 AI & ML**: Machine learning, neural networks, transformers, LLMs, etc.
2. **📚 Research Papers**: Academic papers, studies, and research documents
3. **🌐 Web Content**: Articles, tutorials, guides, and web clips
4. **📝 Notes & Drafts**: Meeting notes, daily notes, ideas, and drafts
5. **💻 Development**: Code, APIs, documentation, and technical guides

### Detailed Category System

Alternatively, the system supports a detailed 47+ category structure organized into main groups:

- **Research Papers**: AI_ML, Physics, Neuroscience, Mathematics, Computer_Science, Biology
- **AI & ML**: Agents, LLMs, Computer_Vision, NLP, Neural_Networks, Transformers, Reinforcement_Learning, MLOps, Tools_Frameworks
- **Development**: APIs, Kubernetes, Git, Documentation, Databases, Frontend, Backend, DevOps
- **Web Content**: Articles, Tutorials, Guides, News, Netclips
- **Notes & Drafts**: Daily_Notes, Literature_Notes, Meeting_Notes, Ideas, Untitled
- **Projects, Data, Archives**: Various subcategories for projects, data, and archives

## Sync Locations

The system synchronizes documents across these locations:

1. **iCloud**: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync`
2. **Google Drive**: `~/Library/CloudStorage/GoogleDrive-*/My Drive/Sync`
3. **Legacy iCloud**: `~/Downloads/Data_Science/Sync_iCloud`
4. **Legacy Google Drive**: `~/Downloads/Data_Science/Sync_GoogleDrive`
5. **Central Hub**: `~/Sync_Hub_New` (configurable)

## Reliability Features

### Error Classification

The system classifies sync errors into specific types:
- **Transient**: Temporary issues that may resolve with retries
- **Authentication**: Credential or permission issues
- **Conflict**: File conflicts and deadlocks
- **Quota**: Storage or bandwidth limits
- **Network**: Connectivity issues
- **Configuration**: Setup or profile issues
- **Permanent**: Issues that won't resolve with retries

### Adaptive Retry

Implements intelligent retry mechanisms with appropriate backoff strategies:
- **Exponential**: Increasing delays with jitter
- **Linear**: Fixed increment delays
- **Quota-aware**: Service-specific delays based on quota reset times

### Circuit Breaker

Prevents cascading failures by temporarily disabling operations after persistent failures:
- **Closed**: Normal operation, all requests proceed
- **Open**: Failure threshold exceeded, requests blocked
- **Half-open**: Testing if system has recovered

## AI Integration (MCP Server)

The MCP server allows AI assistants like Claude to interact with the document organization system through natural language.

### Available AI Tools

1. **search_documents**: Search through organized documents by content or category
2. **get_document_content**: Retrieve full document content for analysis
3. **organize_documents**: Run the organization system on-demand
4. **sync_documents**: Synchronize across all platforms
5. **get_organization_stats**: Get comprehensive system statistics
6. **list_categories**: List all document categories with file counts
7. **create_document**: Create new documents with automatic categorization

### Setup for Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "enhanced-document-organization": {
      "command": "node",
      "args": ["/path/to/Drive_sync/mcp/server.js"],
      "env": {}
    }
  }
}
```

## Configuration

### Main Configuration Files

- **config.env**: Environment variables and paths
- **organize_config.conf**: Organization behavior settings
- **unison_*.prf**: Sync service profiles

### Key Settings

```bash
# Feature toggles
ENABLE_SMART_CATEGORIZATION=true
ENABLE_INCREMENTAL_PROCESSING=true
ENABLE_ADVANCED_DEDUPLICATION=true
ENABLE_CROSS_SYNC_VALIDATION=false
ENABLE_SIMPLIFIED_CATEGORIZATION=true  # Use 5-category system

# Processing parameters
MIN_FILE_SIZE=10                    # Minimum file size in bytes
MAX_FILENAME_LENGTH=80              # Warn about long filenames
INCREMENTAL_THRESHOLD=3600          # Process files changed within 1 hour
CONTENT_ANALYSIS_DEPTH=50           # Lines to analyze for categorization
```

## System Requirements

- **OS**: macOS 12+ (tested on macOS 14+)
- **Shell**: bash/zsh
- **Node.js**: 18+ (for MCP server)
- **Unison**: 2.52+ (for sync functionality)
- **Disk Space**: 2GB+ free for processing and backups