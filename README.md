# Enhanced Document Organization System

A clean, streamlined document management system that automatically synchronizes files across cloud services and organizes them into intelligent categories using AI-powered content analysis.

## Overview

This system provides a complete document workflow:
- **🔄 Automatic Sync** - Bidirectional sync between iCloud, Google Drive, and local hub
- **🧠 Smart Organization** - AI-powered categorization into 5 intuitive categories
- **🤖 AI Integration** - MCP server for AI assistant integration (Claude, etc.)
- **⚡ Automation** - Scheduled background processing via LaunchAgent
- **🛡️ Reliability** - Error handling, logging, and recovery mechanisms

## Quick Start

```bash
# 1. Setup the system
./setup.sh

# 2. Configure your paths (edit config.env)
nano config.env

# 3. Test the system
./drive_sync.sh status

# 4. Run complete workflow
./drive_sync.sh all
```

## Architecture

```
Enhanced Document Organization System
├── drive_sync.sh              # Main entry point & workflow manager
├── config.env                 # Central configuration file
├── setup.sh                   # One-command installation
│
├── sync/                      # Cloud synchronization
│   └── sync_module.sh         # Unison-based bidirectional sync
│
├── organize/                  # Document organization  
│   └── organize_module.sh     # AI-powered categorization
│
├── mcp/                       # AI integration
│   ├── server.js              # MCP server (8 tools)
│   ├── package.json           # Node.js dependencies
│   └── node_modules/          # Dependencies
│
├── unison_icloud.prf          # iCloud sync configuration
├── unison_google_drive.prf    # Google Drive sync configuration
├── organize_config.conf       # Organization rules & patterns
└── com.moatasim....plist      # LaunchAgent for automation
```
## Installation

### Automatic Setup
```bash
git clone <repository-url>
cd Drive_sync
./setup.sh
```

### Manual Setup
```bash
# Install dependencies
brew install unison node

# Install Node.js packages
cd mcp && npm install

# Configure paths in config.env
cp config.env.example config.env
nano config.env

# Test installation
./drive_sync.sh status
```

## Configuration

### Main Configuration (`config.env`)
```bash
# Core Paths
SYNC_HUB="/Users/username/Sync_Hub_New"
ICLOUD_PATH="/Users/username/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync"
GOOGLE_DRIVE_PATH="/Users/username/Library/CloudStorage/GoogleDrive-email@gmail.com/My Drive/Sync"

# Features
SYNC_ENABLED=true
ORGANIZATION_ENABLED=true
MCP_ENABLED=true

# Logging
LOG_LEVEL="INFO"
LOG_RETENTION_DAYS=30
```

### Organization Rules (`organize_config.conf`)
Defines patterns for automatic categorization:
- Keyword matching
- File extension mapping
- Content analysis rules
- Category priorities

## Usage

### Command Line Interface
```bash
# Complete workflow (recommended)
./drive_sync.sh all                    # sync → organize → sync

# Individual operations
./drive_sync.sh sync                   # Sync all cloud services
./drive_sync.sh organize               # Organize documents
./drive_sync.sh status                 # System health check

# Options
./drive_sync.sh organize dry-run       # Preview changes
./drive_sync.sh sync icloud           # Sync specific service
./drive_sync.sh all dry-run           # Preview complete workflow

# MCP Server
./drive_sync.sh mcp start             # Start AI integration server
./drive_sync.sh mcp status            # Check server status
```

### Automation Setup
```bash
# Enable hourly automation
cp com.moatasim.enhanced-document-organization.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.moatasim.enhanced-document-organization.plist

# Check automation status
launchctl list | grep com.moatasim.enhanced-document-organization
```

## Document Categories

The system automatically organizes files into 5 categories:

### 🤖 AI & ML
- Machine learning papers and tutorials
- Data science notebooks and datasets
- AI research documents
- Technical frameworks and tools

### 📚 Research Papers  
- Academic papers (PDF, arXiv)
- Scientific studies and journals
- Research notes and annotations
- Literature reviews

### 🌐 Web Content
- Blog posts and articles
- Tutorials and guides
- Bookmarks and web clippings
- Online resources

### 📝 Notes & Drafts
- Meeting notes and minutes
- Personal thoughts and ideas
- Draft documents
- Quick captures

### 💻 Development
- API documentation
- Code snippets and examples
- Technical specifications
- Programming tutorials

## AI Integration (MCP Server)

The system includes an MCP (Model Context Protocol) server with 8 powerful tools:

### Available Tools
1. **search_documents** - Search by content, category, or filename
2. **get_document_content** - Retrieve full document content
3. **create_document** - Create new documents with auto-categorization
4. **organize_documents** - Run organization system
5. **sync_documents** - Trigger cloud synchronization
6. **get_organization_stats** - System statistics and metrics
7. **list_categories** - Show all categories with file counts
8. **get_system_status** - Health check and system information

### Setup for Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "enhanced-document-organization": {
      "command": "node",
      "args": ["/absolute/path/to/Drive_sync/mcp/server.js"],
      "env": {}
    }
  }
}
```

### Example AI Interactions
```
# Search for machine learning papers
"Find all documents about neural networks in my AI & ML category"

# Get system overview
"Show me my document organization statistics"

# Create and organize new content
"Create a new research note about transformer architectures"
```

## Cloud Storage Configuration

### Supported Services
- **iCloud Drive** - Full bidirectional sync
- **Google Drive** - Full bidirectional sync  
- **Local Hub** - Central management location

### Default Locations
```
Local Hub:     ~/Sync_Hub_New/
iCloud:        ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync/
Google Drive:  ~/Library/CloudStorage/GoogleDrive-*/My Drive/Sync/
```

### Directory Structure
```
Sync_Hub_New/
├── Inbox/                    # New files (unorganized)
├── 🤖 AI & ML/              # AI and machine learning content
├── 📚 Research Papers/       # Academic and research documents  
├── 🌐 Web Content/          # Articles and web resources
├── 📝 Notes & Drafts/       # Personal notes and drafts
└── 💻 Development/          # Technical documentation
```

## System Requirements

### Operating System
- **macOS** 12.0+ (Monterey or later)
- Tested on macOS 14+ (Sonoma/Sequoia)

### Dependencies
- **Unison** 2.52+ - File synchronization
  ```bash
  brew install unison
  ```
- **Node.js** 18+ - MCP server runtime
  ```bash
  brew install node
  ```

### Storage Requirements
- **Minimum**: 1GB free disk space
- **Recommended**: 5GB+ for active document management

### Network
- Stable internet connection for cloud sync
- Cloud storage accounts (iCloud, Google Drive)

## Troubleshooting

### Common Issues

**Sync Failures**
```bash
# Check cloud service status
./drive_sync.sh status

# Test individual services
./drive_sync.sh sync icloud
./drive_sync.sh sync gdrive

# Check Unison configuration
unison -version
```

**Organization Not Working**
```bash
# Test with dry-run
./drive_sync.sh organize dry-run

# Check configuration
cat organize_config.conf
```

**MCP Server Issues**
```bash
# Test server directly
echo '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' | node mcp/server.js

# Check dependencies
cd mcp && npm list
```

**LaunchAgent Problems**
```bash
# Check agent status
launchctl list | grep com.moatasim

# Reload agent
launchctl unload ~/Library/LaunchAgents/com.moatasim.enhanced-document-organization.plist
launchctl load ~/Library/LaunchAgents/com.moatasim.enhanced-document-organization.plist
```

### Getting Help
1. Run `./drive_sync.sh status` for system health
2. Check the project's GitHub issues
3. Review configuration files for typos
4. Ensure all dependencies are properly installed

## Security & Privacy

- **Local Processing** - All organization happens locally
- **No Data Collection** - No telemetry or external data transmission
- **Secure Sync** - Uses official cloud service APIs
- **Permissions** - Minimal system access required

## Performance

- **Fast Sync** - Incremental changes only
- **Smart Organization** - Processes only new/modified files  
- **Low Resource Usage** - Minimal CPU/memory footprint
- **Background Operation** - Non-intrusive automation

## Contributing

This project follows a clean, minimal architecture. When contributing:

1. Maintain the simplified structure
2. Add comprehensive logging
3. Include error handling
4. Test with multiple file types
5. Update documentation

## License

MIT License - see LICENSE file for details.

## Version

Current Version: 2.0.0 (Cleaned & Streamlined)
- Simplified from 100+ files to ~15 essential files
- Removed complex/redundant components
- Enhanced reliability and maintainability
- Improved AI integration with MCP server

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

The system offers flexible document categorization based on content analysis, allowing users to choose between a simplified 5-category system or a more detailed 47+ category structure. This feature ensures that documents are automatically sorted and organized into relevant logical groups.

### Simplified 5-Category System

The system can use a simplified 5-category structure:

1.  **🤖 AI & ML**: Machine learning, neural networks, transformers, LLMs, etc.
2.  **📚 Research Papers**: Academic papers, studies, and research documents
3.  **🌐 Web Content**: Articles, tutorials, guides, and web clips
4.  **📝 Notes & Drafts**: Meeting notes, daily notes, ideas, and drafts
5.  **💻 Development**: Code, APIs, documentation, and technical guides

### Detailed Category System

Alternatively, the system supports a detailed 47+ category structure organized into main groups:

-   **Research Papers**: AI_ML, Physics, Neuroscience, Mathematics, Computer_Science, Biology
-   **AI & ML**: Agents, LLMs, Computer_Vision, NLP, Neural_Networks, Transformers, Reinforcement_Learning, MLOps, Tools_Frameworks
-   **Development**: APIs, Kubernetes, Git, Documentation, Databases, Frontend, Backend, DevOps
-   **Web Content**: Articles, Tutorials, Guides, News, Netclips
-   **Notes & Drafts**: Daily_Notes, Literature_Notes, Meeting_Notes, Ideas, Untitled
-   **Projects, Data, Archives**: Various subcategories for projects, data, and archives

## Cloud Synchronization Capabilities

This system provides robust multi-platform synchronization, ensuring your documents are consistently updated across various cloud services and local storage. It leverages Unison for efficient and reliable file syncing.

### Supported Sync Locations

The system synchronizes documents across these locations:

1.  **iCloud**: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Sync`
2.  **Google Drive**: `~/Library/CloudStorage/GoogleDrive-*/My Drive/Sync`
3.  **Legacy iCloud**: `~/Downloads/Data_Science/Sync_iCloud`
4.  **Legacy Google Drive**: `~/Downloads/Data_Science/Sync_GoogleDrive`
5.  **Central Hub**: `~/Sync_Hub_New` (configurable)

### Sync Mechanism

The synchronization process is managed by Unison, a powerful file-synchronization tool. It ensures that changes made in one location are propagated to all other configured locations, maintaining data consistency and integrity.

### Key Sync Features

-   **Bidirectional Sync**: Changes are synchronized in both directions between all configured locations.
-   **Conflict Resolution**: Unison handles conflicts by prompting the user or applying predefined rules, ensuring no data loss.
-   **Efficient Updates**: Only changed portions of files are transferred, optimizing bandwidth usage.
-   **Resilience**: Integrated with the system's reliability features (Error Classification, Adaptive Retry, Circuit Breaker) to handle network interruptions and service outages gracefully.

For detailed usage of sync commands, refer to the [Sync Management](#sync-management) section.

## Reliability Features

This system incorporates advanced reliability features to ensure robust and automated operation, including intelligent error handling, adaptive retries, and circuit breakers. These features contribute to the system's automation and scheduling capabilities by ensuring tasks are completed reliably and efficiently.

### Error Classification

The system classifies sync errors into specific types:
-   **Transient**: Temporary issues that may resolve with retries
-   **Authentication**: Credential or permission issues
-   **Conflict**: File conflicts and deadlocks
-   **Quota**: Storage or bandwidth limits
-   **Network**: Connectivity issues
-   **Configuration**: Setup or profile issues
-   **Permanent**: Issues that won't resolve with retries

### Adaptive Retry

Implements intelligent retry mechanisms with appropriate backoff strategies:
-   **Exponential**: Increasing delays with jitter
-   **Linear**: Fixed increment delays
-   **Quota-aware**: Service-specific delays based on quota reset times

### Circuit Breaker

Prevents cascading failures by temporarily disabling operations after persistent failures:
-   **Closed**: Normal operation, all requests proceed
-   **Open**: Failure threshold exceeded, requests blocked
-   **Half-open**: Testing if system has recovered

## AI Integration (MCP Server)

The Model Context Protocol (MCP) server is a core component that enables seamless interaction between AI assistants (like Claude) and the document organization system. It exposes a set of tools that AI models can call to manage, search, and interact with your documents through natural language commands.

### How AI Integration Works

1.  **Natural Language Commands**: AI assistants receive user commands in natural language (e.g., "Find all research papers on AI").
2.  **Tool Calling**: The AI assistant identifies the appropriate MCP tool to execute based on the user's request.
3.  **MCP Server Execution**: The MCP server receives the tool call, executes the corresponding system function (e.g., `search_documents`), and returns the results.
4.  **AI Response Generation**: The AI assistant processes the results and generates a natural language response to the user.

### Available AI Tools

1.  **search_documents**: Search through organized documents by content, category, or filename. Allows AI to retrieve relevant documents based on user queries, with enhanced context awareness for improved relevance.
2.  **summarize_document**: Generate a summary of a specific document. Enables AI to quickly grasp the main points of a document without reading the full content.
3.  **batch_create_documents**: Create multiple new documents in the appropriate categories. Supports efficient creation of multiple documents via AI.
4.  **get_document_content**: Retrieve the full content of a specific document. Enables AI to analyze document content for summarization, question-answering, or further processing.
5.  **organize_documents**: Trigger the document organization system on-demand. AI can initiate a re-organization of files based on new rules or user requests.
6.  **sync_documents**: Initiate synchronization across all configured cloud platforms. AI can ensure documents are up-to-date across all services.
7.  **get_organization_stats**: Get comprehensive statistics about document organization and sync status. Provides AI with insights into system health and performance.
8.  **get_system_metrics**: Get detailed system performance metrics, usage patterns, sync efficiency, and error tracking. Allows AI to monitor the overall health and efficiency of the system.
9.  **list_categories**: List all available document categories with file counts. Helps AI understand the existing categorization structure.
10. **create_document**: Create new documents with automatic categorization. AI can generate and store new content directly into the system.

### Setup for Claude Desktop

To enable Claude Desktop to interact with your document organization system, you need to configure the MCP server within Claude's settings. Add the following JSON snippet to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

Replace `/path/to/Drive_sync/` with the actual absolute path to your `Drive_sync` directory. After adding this configuration, restart Claude Desktop for the changes to take effect. Claude will then be able to discover and utilize the MCP tools.

## Automation and Scheduling

The system is designed for automated operation, leveraging macOS LaunchAgents for scheduling and background execution. This ensures that document organization and synchronization tasks run regularly without manual intervention.

### Scheduled Tasks

- **Daily Sync and Organize**: The primary workflow (`drive_sync.sh all`) can be scheduled to run daily, ensuring all documents are synchronized and organized regularly.
- **Continuous Monitoring**: Background processes can continuously monitor for new files or changes, triggering immediate organization or sync operations.

### Configuration for Automation

Automation is primarily managed through `com.moatasim.enhanced-document-organization.plist`, a macOS LaunchAgent configuration file. This file defines when and how the `drive_sync.sh` script is executed.

**Key Automation Settings (within `com.moatasim.enhanced-document-organization.plist`):

- `ProgramArguments`: Specifies the path to `drive_sync.sh` and the command to execute (e.g., `all`).
- `StartCalendarInterval` or `StartInterval`: Defines the schedule for the task (e.g., daily at a specific time, or every X seconds).
- `RunAtLoad`: If set to `true`, the script runs once when the LaunchAgent is loaded.
- `StandardOutPath` and `StandardErrorPath`: Configures logging for the automated tasks.

**Example LaunchAgent Configuration Snippet (simplified):

```xml
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.moatasim.enhanced-document-organization</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/Drive_sync/drive_sync.sh</string>
        <string>all</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>3</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/logs/automation.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync/logs/automation_error.log</string>
</dict>
</plist>
```

For detailed setup instructions, refer to the [Installation](#installation) section under "Set up automation".

-   **config.env**: Environment variables and paths
-   **organize_config.conf**: Organization behavior settings
-   **unison_*.prf**: Sync service profiles

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

-   **OS**: macOS 12+ (tested on macOS 14+)
-   **Shell**: bash/zsh
-   **Node.js**: 18+ (for MCP server)
-   **Unison**: 2.52+ (for sync functionality)
-   **Disk Space**: 2GB+ free for processing and backups

## Troubleshooting

This section provides solutions to common issues you might encounter while using the Enhanced Document Organization System.

### Common Issues and Solutions

#### 1. Sync Failures
- **Issue**: Files are not synchronizing between cloud services.
- **Possible Causes**: Network connectivity issues, incorrect Unison profiles, cloud service API limits, circuit breaker tripped.
- **Solutions**:
    - **Check Network**: Ensure you have a stable internet connection.
    - **Verify Unison Profiles**: Double-check `unison_icloud.prf` and `unison_google_drive.prf` for correct paths and settings.
    - **Reset Circuit Breaker**: If syncs are consistently failing, the circuit breaker might be open. Run `./drive_sync.sh sync reset-circuit` to reset it.
    - **Check Cloud Service Status**: Verify that iCloud and Google Drive services are operational.
    - **Review Logs**: Examine `logs/sync.log` (or similar paths configured in your LaunchAgent) for detailed error messages.

#### 2. Document Organization Issues
- **Issue**: Files are not being categorized correctly or are not moving to their designated folders.
- **Possible Causes**: Incorrect `organize_config.conf` settings, content analysis limitations, file permissions.
- **Solutions**:
    - **Verify `organize_config.conf`**: Ensure your categorization rules are correctly defined and match the file content.
    - **Run Dry Run**: Use `./drive_sync.sh organize dry-run` to preview how files would be organized without making actual changes. This helps in debugging rules.
    - **Check File Permissions**: Ensure the script has read/write permissions for the source and destination directories.
    - **Adjust `CONTENT_ANALYSIS_DEPTH`**: For very short documents, increase `CONTENT_ANALYSIS_DEPTH` in `config.env` to allow more content to be analyzed.

#### 3. MCP Server Not Responding
- **Issue**: AI assistant cannot connect to or interact with the MCP server.
- **Possible Causes**: MCP server not running, incorrect `claude_desktop_config.json` path, port conflicts.
- **Solutions**:
    - **Start Server**: Ensure the MCP server is running by executing `./drive_sync.sh mcp start`.
    - **Verify `claude_desktop_config.json`**: Confirm that the `command` and `args` paths in your Claude Desktop configuration are correct and point to the `server.js` file.
    - **Check Port Usage**: Ensure no other application is using the port configured for the MCP server.
    - **Review MCP Logs**: Check the MCP server's output for any error messages during startup or operation.

### Performance Optimization Tips

To ensure the system runs efficiently, consider the following optimization strategies:

- **Incremental Processing**: Enable `ENABLE_INCREMENTAL_PROCESSING=true` in `config.env` to process only newly added or modified files, significantly reducing processing time.
- **Adjust `INCREMENTAL_THRESHOLD`**: Fine-tune this setting in `config.env` to control how frequently files are re-scanned for changes.
- **Optimize `organize_config.conf`**: Streamline your categorization rules. Complex regex patterns or a very large number of rules can impact performance.
- **Exclude Unnecessary Paths**: Use `.gitignore` or specific exclusion rules in your sync and organize configurations to prevent processing of irrelevant files (e.g., `node_modules`, temporary directories).
- **Monitor Disk Space**: Ensure sufficient free disk space, especially in processing and cache directories, to prevent performance degradation.

## Maintenance Guide

Regular maintenance ensures the smooth and reliable operation of your document organization system.

### Ongoing Maintenance Tasks

- **Regular Log Review**: Periodically check logs (e.g., `logs/automation.log`, `logs/sync.log`) for any recurring errors or warnings.
- **Configuration Backup**: Regularly back up your `config.env`, `organize_config.conf`, and `unison_*.prf` files.
- **Cache Management**: The `.cache/` directory stores processed file information. While designed to be efficient, large caches might occasionally benefit from a manual cleanup if issues arise (e.g., `rm -rf .cache/*`).
- **Software Updates**: Keep Node.js, Unison, and your macOS operating system updated to their latest stable versions.
- **Review Categories**: Periodically review your document categories and rules to ensure they remain relevant to your needs.

### System Monitoring and Health Check Procedures

- **Sync Health**: Use `./drive_sync.sh sync health` to get a quick overview of the synchronization status.
- **Organization Status**: Use `./drive_sync.sh organize status` to check the last organization run and any pending files.
- **MCP Server Status**: Use `./drive_sync.sh mcp status` to verify the MCP server is running.
- **Disk Usage**: Regularly monitor disk space on your sync locations and the central hub.
- **Automation Logs**: Check the output logs configured in your LaunchAgent (`StandardOutPath`, `StandardErrorPath`) to ensure automated tasks are completing successfully.

## Development and Contribution

We welcome contributions to enhance the Enhanced Document Organization System!

### How to Contribute

1.  **Fork the Repository**: Start by forking the main repository to your GitHub account.
2.  **Clone Your Fork**: Clone your forked repository to your local machine.
3.  **Create a New Branch**: Create a new branch for your feature or bug fix: `git checkout -b feature/your-feature-name` or `git checkout -b bugfix/issue-description`.
4.  **Make Changes**: Implement your changes, adhering to the existing code style and conventions.
5.  **Write Tests**: If you're adding new features or fixing bugs, please write appropriate unit and/or integration tests.
6.  **Run Tests**: Ensure all existing tests pass and your new tests pass: `npm test` (for MCP server) and run relevant shell script tests.
7.  **Update Documentation**: If your changes affect functionality or configuration, update the `README.md` or other relevant documentation.
8.  **Commit Changes**: Commit your changes with a clear and concise commit message.
9.  **Push to Your Fork**: Push your branch to your forked repository: `git push origin feature/your-feature-name`.
10. **Create a Pull Request**: Open a pull request from your branch to the `main` branch of the original repository. Provide a detailed description of your changes and why they are necessary.

### Coding Guidelines

-   **Shell Scripts**: Follow standard shell scripting best practices. Use clear variable names, add comments for complex logic, and ensure scripts are idempotent where possible.
-   **JavaScript (MCP Server)**: Adhere to modern JavaScript conventions. Use meaningful variable and function names.
-   **Error Handling**: Implement robust error handling in all scripts and modules.
-   **Modularity**: Keep functions and scripts modular and focused on a single responsibility.
-   **Configuration**: Externalize configurable parameters to `config.env` or `organize_config.conf` where appropriate.

### Reporting Bugs

If you find a bug, please open an issue on the GitHub repository. Provide as much detail as possible, including:

-   A clear and concise description of the bug.
-   Steps to reproduce the behavior.
-   Expected behavior.
-   Screenshots or error messages (if applicable).
-   Your system configuration (OS, Node.js version, Unison version).

### Feature Requests

We welcome ideas for new features! Please open an issue on GitHub to propose new features. Describe:

-   The problem your feature solves.
-   How you envision the feature working.
-   Any potential benefits or use cases.

Thank you for contributing to the Enhanced Document Organization System!
