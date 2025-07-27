# Design Document

## Overview

This design addresses the critical bugs in the Enhanced Document Organization System by implementing targeted fixes for path management, configuration handling, performance optimization, and system reliability. The solution maintains the existing architecture while correcting the specific issues that prevent proper functionality.

## Architecture

### Current System Architecture
```
Enhanced Document Organization System
├── drive_sync.sh                    # Main orchestrator
├── config/
│   ├── config.env                   # Central configuration
│   └── organize_config.conf         # Organization rules
├── src/
│   ├── mcp/
│   │   └── server.js               # MCP server (14 tools)
│   ├── organize/
│   │   ├── organize_module.sh      # Organization workflow
│   │   ├── content_consolidator.js # Content merging
│   │   ├── content_analyzer.js     # Content analysis
│   │   └── category_manager.js     # Category management
│   └── sync/
│       └── sync_module.sh          # Cloud synchronization
└── Sync_Hub_New/                   # User's document hub
```

### Problem Areas Identified
1. **Path Management**: Hardcoded paths in content_consolidator.js
2. **Configuration Loading**: Wrong config file path in organize_module.sh
3. **Performance**: Per-file Node.js process spawning
4. **Argument Parsing**: Broken dry-run functionality
5. **MCP Server**: Incomplete implementations and path issues
6. **Module Integration**: Import resolution failures

## Components and Interfaces

### 1. Path Management System

#### Current Issue
The `ContentConsolidator` class uses hardcoded project root and "Sync_Hub_New" instead of the configured SYNC_HUB path.

#### Design Solution
```javascript
// Updated ContentConsolidator constructor
class ContentConsolidator {
    constructor(options = {}) {
        this.syncHubPath = options.syncHubPath; // Receive from caller
        this.projectRoot = options.projectRoot;
        // Remove hardcoded path construction
    }
    
    async createConsolidatedFolder(folderName, sampleAnalysis) {
        const category = this.determineCategory(sampleAnalysis);
        // Use configured sync hub path instead of hardcoded
        const categoryPath = path.join(this.syncHubPath, category);
        const folderPath = path.join(categoryPath, folderName);
        // ... rest of implementation
    }
}
```

#### Interface Changes
- **organize_module.sh** → **ContentConsolidator**: Pass SYNC_HUB path as parameter
- **MCP server** → **ContentConsolidator**: Pass SYNC_HUB path from configuration
- **ContentConsolidator**: Accept syncHubPath in constructor options

### 2. Configuration File Path Resolution

#### Current Issue
The `organize_module.sh` script looks for `organize_config.conf` in `src/` instead of `config/`.

#### Design Solution
```bash
# Current (incorrect)
CONFIG_PATH="$PROJECT_DIR/organize_config.conf"

# Fixed
CONFIG_PATH="$PROJECT_DIR/../config/organize_config.conf"
```

#### Implementation Strategy
- Update all references to config file path in organize_module.sh
- Ensure CategoryManager uses correct config path
- Add validation to check if config file exists at expected location
- Create default config if missing

### 3. Batch File Processing System

#### Current Issue
The organization process spawns a separate Node.js process for each file, causing severe performance degradation.

#### Design Solution
```bash
# Current approach (inefficient)
for file in "${files[@]}"; do
    category=$(node -e "..." "$file")  # Separate process per file
done

# New approach (efficient)
# 1. Collect all files into JSON array
# 2. Single Node.js call to process all files
# 3. Return complete organization plan
# 4. Execute all moves in bash
```

#### Batch Processing Architecture
```
organize_module.sh
├── collect_files_to_process()
├── create_batch_analysis_request()
├── call_node_batch_processor()
│   └── Node.js processes all files at once
├── parse_organization_plan()
└── execute_file_moves()
```

#### Interface Design
```javascript
// New batch processing function
async function batchCategorizeFiles(fileList) {
    const results = [];
    for (const filePath of fileList) {
        const category = await categorizeFile(filePath);
        results.push({ filePath, category });
    }
    return results;
}
```

### 4. Argument Parsing and Dry-Run System

#### Current Issue
The argument parsing in `organize_module.sh` has bugs that prevent dry-run from working correctly.

#### Design Solution
```bash
# Improved argument parsing
parse_arguments() {
    local source_dir=""
    local dry_run="false"
    
    # Handle different calling patterns
    case "$#" in
        0)
            source_dir="$SYNC_HUB"
            ;;
        1)
            if [[ "$1" == "dry-run" ]]; then
                source_dir="$SYNC_HUB"
                dry_run="true"
            else
                source_dir="$1"
            fi
            ;;
        2)
            source_dir="$1"
            if [[ "$2" == "dry-run" || "$2" == "true" ]]; then
                dry_run="true"
            fi
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
    
    echo "$source_dir|$dry_run"
}
```

### 5. MCP Server Reliability System

#### Current Issues
- Incomplete function implementations
- Hardcoded paths
- Missing error handling
- Tool failures

#### Design Solution

##### Path Configuration
```javascript
class DocumentOrganizationServer {
    async initializePaths() {
        // Load from config.env instead of hardcoding
        const configPath = path.join(this.projectRoot, 'config', 'config.env');
        const config = await this.loadConfiguration(configPath);
        this.syncHub = config.SYNC_HUB || this.fallbackSyncHub;
    }
}
```

##### Tool Implementation Completion
```javascript
// Complete missing tool implementations
async consolidateContent(args) {
    try {
        const consolidator = new ContentConsolidator({
            projectRoot: this.projectRoot,
            syncHubPath: this.syncHub, // Pass correct path
            enhanceContent: args.enhance_with_ai
        });
        
        const result = await consolidator.consolidateDocuments(args);
        return this.formatToolResponse(result);
    } catch (error) {
        return this.formatErrorResponse(error);
    }
}
```

##### Error Handling Framework
```javascript
formatErrorResponse(error) {
    this.logError(`Tool error: ${error.message}`);
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                error: true,
                message: error.message,
                timestamp: new Date().toISOString()
            }, null, 2)
        }],
        isError: true
    };
}
```

### 6. Module Integration System

#### Current Issues
- ES module import failures
- Path resolution problems
- Missing error handling for dynamic imports

#### Design Solution

##### Import Error Handling
```javascript
async function safeImport(modulePath) {
    try {
        return await import(modulePath);
    } catch (error) {
        console.error(`Failed to import ${modulePath}: ${error.message}`);
        throw new Error(`Module import failed: ${modulePath}`);
    }
}
```

##### Path Resolution
```bash
# Ensure consistent path resolution
get_absolute_path() {
    local relative_path="$1"
    echo "$(cd "$(dirname "$relative_path")" && pwd)/$(basename "$relative_path")"
}

PROJECT_ROOT="$(get_absolute_path "$SCRIPT_DIR/..")"
```

## Data Models

### Configuration Data Model
```javascript
interface SystemConfiguration {
    syncHub: string;           // SYNC_HUB path
    projectRoot: string;       // Project root directory
    configPath: string;        // organize_config.conf path
    logLevel: string;          // Logging level
    enabledFeatures: {
        duplicateDetection: boolean;
        contentConsolidation: boolean;
        aiEnhancement: boolean;
    };
}
```

### Batch Processing Data Model
```javascript
interface BatchProcessingRequest {
    files: string[];           // List of file paths to process
    options: {
        dryRun: boolean;
        similarityThreshold: number;
    };
}

interface BatchProcessingResponse {
    organizationPlan: Array<{
        filePath: string;
        targetCategory: string;
        confidence: number;
        action: 'move' | 'consolidate' | 'skip';
    }>;
    stats: {
        totalFiles: number;
        processedFiles: number;
        errors: string[];
    };
}
```

### Error Handling Data Model
```javascript
interface SystemError {
    component: string;         // Which component failed
    operation: string;         // What operation was being performed
    message: string;           // Error message
    stack?: string;           // Stack trace if available
    timestamp: string;         // When the error occurred
    context: Record<string, any>; // Additional context
}
```

## Error Handling

### Error Classification System
```javascript
class ErrorHandler {
    static classify(error) {
        if (error.code === 'ENOENT') return 'FILE_NOT_FOUND';
        if (error.code === 'EACCES') return 'PERMISSION_DENIED';
        if (error.message.includes('import')) return 'MODULE_IMPORT_FAILURE';
        if (error.message.includes('config')) return 'CONFIGURATION_ERROR';
        return 'UNKNOWN_ERROR';
    }
    
    static handle(error, context) {
        const classification = this.classify(error);
        const errorInfo = {
            classification,
            message: error.message,
            context,
            timestamp: new Date().toISOString()
        };
        
        this.log(errorInfo);
        return this.createRecoveryStrategy(classification, errorInfo);
    }
}
```

### Recovery Strategies
- **FILE_NOT_FOUND**: Skip file and continue processing
- **PERMISSION_DENIED**: Log warning and attempt with fallback permissions
- **MODULE_IMPORT_FAILURE**: Use fallback implementation or graceful degradation
- **CONFIGURATION_ERROR**: Use default configuration values

## Testing Strategy

### Unit Testing Approach
```javascript
// Test path resolution
describe('ContentConsolidator Path Management', () => {
    it('should use provided syncHubPath instead of hardcoded path', () => {
        const consolidator = new ContentConsolidator({
            syncHubPath: '/custom/sync/path',
            projectRoot: '/project'
        });
        
        const result = consolidator.createConsolidatedFolder('test', analysis);
        expect(result).toContain('/custom/sync/path');
    });
});
```

### Integration Testing
```bash
# Test complete workflow with dry-run
test_complete_workflow() {
    local test_dir="/tmp/test_sync_hub"
    mkdir -p "$test_dir"
    
    # Test with dry-run
    ./src/organize/organize_module.sh "$test_dir" dry-run
    
    # Verify no files were actually moved
    assert_no_files_moved "$test_dir"
}
```

### MCP Server Testing
```javascript
// Test all MCP tools
async function testAllMCPTools() {
    const server = new DocumentOrganizationServer();
    const tools = await server.listTools();
    
    for (const tool of tools) {
        try {
            await server.callTool(tool.name, getTestArgs(tool.name));
            console.log(`✅ ${tool.name} - PASSED`);
        } catch (error) {
            console.error(`❌ ${tool.name} - FAILED: ${error.message}`);
        }
    }
}
```

## Implementation Priority

### Phase 1: Critical Path Fixes (High Priority)
1. Fix ContentConsolidator path management
2. Correct organize_config.conf path resolution
3. Implement batch file processing
4. Fix argument parsing and dry-run functionality

### Phase 2: MCP Server Stability (Medium Priority)
1. Complete missing MCP tool implementations
2. Fix path configuration in MCP server
3. Improve error handling and logging
4. Add comprehensive tool testing

### Phase 3: System Reliability (Low Priority)
1. Enhance module import error handling
2. Add configuration validation
3. Implement recovery strategies
4. Add performance monitoring

## Validation Criteria

### Success Metrics
- All 4 identified bugs are resolved
- MCP server tools work without exceptions
- Organization performance improves significantly
- Dry-run mode works correctly
- Configuration files are read from correct locations
- Consolidated documents appear in configured sync hub

### Testing Checklist
- [ ] ContentConsolidator uses correct SYNC_HUB path
- [ ] organize_config.conf is read from config/ directory
- [ ] Batch processing reduces organization time by >80%
- [ ] Dry-run mode shows preview without making changes
- [ ] All 14 MCP tools execute successfully
- [ ] Module imports resolve correctly
- [ ] Error handling provides useful debugging information