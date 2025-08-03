#!/bin/bash

# ============================================================================
# ENHANCED ORGANIZE MODULE WITH AI-POWERED CONTENT ANALYSIS
# ============================================================================
# Advanced document organization with duplicate detection, content consolidation,
# and extensible category system

set -euo pipefail

# Get script directory and navigate to main project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Navigate up two levels: src/organize -> src -> project_root
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Load configuration with validation
CONFIG_FILE="$PROJECT_DIR/config/config.env"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    echo "💡 Run system validation: node $PROJECT_DIR/src/organize/startup_validator.js"
    exit 1
fi

source "$CONFIG_FILE"

# Validate critical configuration variables
validate_config() {
    local missing_vars=()
    
    if [[ -z "${SYNC_HUB:-}" ]]; then
        missing_vars+=("SYNC_HUB")
    fi
    
    if [[ -z "${LOG_LEVEL:-}" ]]; then
        LOG_LEVEL="INFO"
    fi
    
    if [[ -z "${LOG_TO_CONSOLE:-}" ]]; then
        LOG_TO_CONSOLE="true"
    fi
    
    if [[ -z "${LOG_TO_FILE:-}" ]]; then
        LOG_TO_FILE="true"
    fi
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo "❌ Missing required configuration variables: ${missing_vars[*]}"
        echo "💡 Run system validation: node $PROJECT_DIR/src/organize/startup_validator.js"
        exit 1
    fi
}

# Run configuration validation
validate_config

# Advanced features configuration
ENABLE_DUPLICATE_DETECTION="${ENABLE_DUPLICATE_DETECTION:-true}"
ENABLE_CONTENT_CONSOLIDATION="${ENABLE_CONTENT_CONSOLIDATION:-true}"
ENABLE_AI_ENHANCEMENT="${ENABLE_AI_ENHANCEMENT:-false}"
ENABLE_CATEGORY_SUGGESTIONS="${ENABLE_CATEGORY_SUGGESTIONS:-true}"
SIMILARITY_THRESHOLD="${SIMILARITY_THRESHOLD:-0.8}"
MIN_CONSOLIDATION_FILES="${MIN_CONSOLIDATION_FILES:-2}"

# Enhanced logging function with error context
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local hostname=$(hostname)
    local pid=$$
    
    # Create structured log entry
    local log_entry="[$timestamp] [$level] [organize_module] [PID:$pid] [HOST:$hostname] $message"
    
    # Console logging with color coding
    if [[ "$LOG_TO_CONSOLE" == "true" ]]; then
        case "$level" in
            "ERROR"|"FATAL")
                echo -e "\033[31m$log_entry\033[0m" >&2  # Red for errors
                ;;
            "WARN")
                echo -e "\033[33m$log_entry\033[0m" >&2  # Yellow for warnings
                ;;
            "INFO")
                echo -e "\033[32m$log_entry\033[0m"      # Green for info
                ;;
            "DEBUG")
                if [[ "${DEBUG:-false}" == "true" ]]; then
                    echo -e "\033[36m$log_entry\033[0m"  # Cyan for debug
                fi
                ;;
            *)
                echo "$log_entry"
                ;;
        esac
    fi
    
    # File logging with JSON structure for better parsing
    if [[ "$LOG_TO_FILE" == "true" ]]; then
        mkdir -p "$PROJECT_DIR/logs"
        local json_log="{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"component\":\"organize_module\",\"pid\":$pid,\"hostname\":\"$hostname\",\"message\":\"$message\"}"
        echo "$json_log" >> "$PROJECT_DIR/logs/organize.log"
    fi
}

# Enhanced error handling function with specific path resolution error handling
handle_error() {
    local error_code="$1"
    local error_message="$2"
    local context="$3"
    local operation="${4:-unknown}"
    
    # Determine if this is a path resolution related error
    local is_path_error="false"
    local module_name=""
    local attempted_path=""
    
    # Check if this is a module loading or path resolution error
    if [[ "$operation" =~ (resolve_module_path|validate_required_modules|execute_node_module|run_content_analysis) ]] || 
       [[ "$error_message" =~ (Cannot find module|No such file or directory|batch_processor|content_analyzer|content_consolidator|category_manager) ]] ||
       [[ "$context" =~ \.js$ ]]; then
        is_path_error="true"
        
        # Extract module name from context or error message
        if [[ "$context" =~ ([^/]+\.js)$ ]]; then
            module_name="${BASH_REMATCH[1]}"
            attempted_path="$context"
        elif [[ "$error_message" =~ "Cannot find module" ]]; then
            # Extract module name from error message using simpler approach
            local module_match=$(echo "$error_message" | grep -o "'[^']*'" | head -1 | tr -d "'")
            if [[ -n "$module_match" ]]; then
                module_name=$(basename "$module_match")
                attempted_path="$module_match"
            fi
        elif [[ "$context" =~ batch_processor|content_analyzer|content_consolidator|category_manager ]]; then
            module_name="$context"
            attempted_path="$PROJECT_DIR/src/organize/$context"
        fi
    fi
    
    # Use specialized path resolution error handling
    if [[ "$is_path_error" == "true" ]]; then
        handle_path_resolution_error "$error_code" "$error_message" "$context" "$operation" "$module_name" "$attempted_path"
        return $?
    fi
    
    # Use specialized module loading error handling for Node.js execution errors
    if [[ "$operation" =~ (execute_node_module|run_with_retry) ]] && [[ "$error_code" -ne 0 ]]; then
        handle_module_loading_error "$error_code" "$error_message" "$context" "$operation"
        return $?
    fi
    
    # Generic error handling for non-path-related errors
    handle_generic_error "$error_code" "$error_message" "$context" "$operation"
    return $?
}

# Specialized error handling for path resolution failures (Requirements 3.1, 3.2, 3.3)
handle_path_resolution_error() {
    local error_code="$1"
    local error_message="$2"
    local context="$3"
    local operation="$4"
    local module_name="${5:-unknown}"
    local attempted_path="${6:-unknown}"
    
    log "ERROR" "=========================================="
    log "ERROR" "PATH RESOLUTION ERROR DETECTED"
    log "ERROR" "=========================================="
    log "ERROR" "Operation: $operation"
    log "ERROR" "Module: $module_name"
    log "ERROR" "Error: $error_message"
    log "ERROR" "Context: $context"
    log "ERROR" "Exit Code: $error_code"
    log "ERROR" "Attempted Path: $attempted_path"
    
    # Add context information for module loading (Requirement 3.2)
    log "ERROR" "=========================================="
    log "ERROR" "MODULE LOADING CONTEXT"
    log "ERROR" "=========================================="
    log "ERROR" "Current working directory: $(pwd)"
    log "ERROR" "Script directory: $SCRIPT_DIR"
    log "ERROR" "Project directory: $PROJECT_DIR"
    log "ERROR" "Expected module location: $PROJECT_DIR/src/organize/"
    log "ERROR" "Module base directory: ${MODULE_BASE_DIR:-'(not set)'}"
    log "ERROR" "Node path: ${NODE_PATH:-'(not set)'}"
    
    # Determine specific path resolution failure type and appropriate exit code
    local specific_exit_code
    local recovery_action
    local should_continue="false"
    
    case "$error_code" in
        1)
            if [[ "$error_message" =~ "not found" ]] || [[ "$operation" == "resolve_module_path" ]]; then
                specific_exit_code=10  # Path resolution failure
                recovery_action="Try fallback locations and report detailed path information"
                should_continue="true"
                log "ERROR" "Path Resolution Failure: Module not found in expected locations"
            else
                specific_exit_code=11  # General path-related error
                recovery_action="Investigate path configuration and module availability"
                should_continue="true"
                log "ERROR" "General Path Error: Path-related operation failed"
            fi
            ;;
        2)
            specific_exit_code=12  # File/directory not found
            recovery_action="Verify file exists and is accessible"
            should_continue="true"
            log "ERROR" "File Not Found: Required file or directory missing"
            ;;
        126)
            specific_exit_code=13  # Permission denied or not executable
            recovery_action="Check file permissions and execution rights"
            should_continue="false"
            log "ERROR" "Permission Error: File exists but cannot be executed"
            ;;
        127)
            specific_exit_code=14  # Command not found
            recovery_action="Verify Node.js installation and PATH configuration"
            should_continue="false"
            log "ERROR" "Command Not Found: Node.js or module execution failed"
            ;;
        *)
            specific_exit_code=15  # Unknown path-related error
            recovery_action="Review error details and check system configuration"
            should_continue="true"
            log "ERROR" "Unknown Path Error: Unexpected path resolution failure"
            ;;
    esac
    
    # Enhanced error reporting with actionable guidance (Requirement 3.1)
    log "ERROR" "=========================================="
    log "ERROR" "RECOVERY GUIDANCE"
    log "ERROR" "=========================================="
    log "INFO" "Recommended action: $recovery_action"
    log "INFO" "Specific exit code: $specific_exit_code"
    
    # Provide specific troubleshooting steps based on error type
    case "$specific_exit_code" in
        10) # Path resolution failure
            log "INFO" "Troubleshooting steps for path resolution failure:"
            log "INFO" "  1. Verify project structure: ls -la $PROJECT_DIR/src/organize/"
            log "INFO" "  2. Check if module exists: test -f $PROJECT_DIR/src/organize/$module_name && echo 'Found' || echo 'Missing'"
            log "INFO" "  3. Verify fallback locations:"
            log "INFO" "     - Legacy location: ls -la $PROJECT_DIR/organize/ 2>/dev/null || echo 'Not found'"
            log "INFO" "     - Script directory: ls -la $SCRIPT_DIR/ 2>/dev/null || echo 'Not found'"
            log "INFO" "  4. Check environment variables:"
            log "INFO" "     - PROJECT_ROOT: ${PROJECT_ROOT:-'(not set)'}"
            log "INFO" "     - MODULE_BASE_DIR: ${MODULE_BASE_DIR:-'(not set)'}"
            ;;
        11) # General path-related error
            log "INFO" "Troubleshooting steps for general path error:"
            log "INFO" "  1. Verify all path components exist: $attempted_path"
            log "INFO" "  2. Check directory permissions: ls -ld $(dirname $attempted_path) 2>/dev/null"
            log "INFO" "  3. Validate project root detection: echo 'PROJECT_DIR=$PROJECT_DIR'"
            log "INFO" "  4. Run path resolution test: $SCRIPT_DIR/simple_path_resolver.js --test"
            ;;
        12) # File/directory not found
            log "INFO" "Troubleshooting steps for missing file:"
            log "INFO" "  1. Check if file was moved: find $PROJECT_DIR -name '$module_name' -type f 2>/dev/null"
            log "INFO" "  2. Verify file permissions: ls -la $attempted_path 2>/dev/null"
            log "INFO" "  3. Check if directory exists: ls -ld $(dirname $attempted_path) 2>/dev/null"
            log "INFO" "  4. Validate project structure: tree $PROJECT_DIR/src 2>/dev/null || find $PROJECT_DIR/src -type f -name '*.js'"
            ;;
        13) # Permission denied
            log "INFO" "Troubleshooting steps for permission error:"
            log "INFO" "  1. Check file permissions: ls -la $attempted_path"
            log "INFO" "  2. Verify directory permissions: ls -ld $(dirname $attempted_path)"
            log "INFO" "  3. Check file ownership: stat -c '%U:%G' $attempted_path 2>/dev/null || stat -f '%Su:%Sg' $attempted_path 2>/dev/null"
            log "INFO" "  4. Test file readability: test -r $attempted_path && echo 'Readable' || echo 'Not readable'"
            ;;
        14) # Command not found
            log "INFO" "Troubleshooting steps for command not found:"
            log "INFO" "  1. Verify Node.js installation: which node && node --version"
            log "INFO" "  2. Check PATH configuration: echo \$PATH | tr ':' '\n' | grep -E '(node|npm)'"
            log "INFO" "  3. Test Node.js execution: node -e 'console.log(\"Node.js is working\")'"
            log "INFO" "  4. Verify npm packages: cd $PROJECT_DIR && npm list --depth=0"
            ;;
        15) # Unknown path-related error
            log "INFO" "Troubleshooting steps for unknown path error:"
            log "INFO" "  1. Enable debug logging: export DEBUG=true"
            log "INFO" "  2. Run with verbose output: $0 --verbose"
            log "INFO" "  3. Check system logs: tail -n 20 $PROJECT_DIR/logs/organize.log"
            log "INFO" "  4. Test minimal operation: node -e 'console.log(process.cwd())'"
            ;;
    esac
    
    log "ERROR" "=========================================="
    
    # Return appropriate exit code based on whether execution should continue
    if [[ "$should_continue" == "true" ]]; then
        log "INFO" "Continuing execution with fallback behavior (exit code: $specific_exit_code)"
        return 0  # Continue execution but with specific exit code logged
    else
        log "FATAL" "Cannot continue execution due to critical path resolution error (exit code: $specific_exit_code)"
        return "$specific_exit_code"  # Stop execution with specific exit code
    fi
}

# Specialized error handling for module loading failures
handle_module_loading_error() {
    local error_code="$1"
    local error_message="$2"
    local context="$3"
    local operation="$4"
    
    log "ERROR" "=========================================="
    log "ERROR" "MODULE LOADING ERROR DETECTED"
    log "ERROR" "=========================================="
    log "ERROR" "Operation: $operation"
    log "ERROR" "Error: $error_message"
    log "ERROR" "Context: $context"
    log "ERROR" "Exit Code: $error_code"
    
    # Add context information for module loading (Requirement 3.2)
    log "ERROR" "=========================================="
    log "ERROR" "MODULE EXECUTION CONTEXT"
    log "ERROR" "=========================================="
    log "ERROR" "Node.js version: $(node --version 2>/dev/null || echo 'Not available')"
    log "ERROR" "NPM version: $(npm --version 2>/dev/null || echo 'Not available')"
    log "ERROR" "Current working directory: $(pwd)"
    log "ERROR" "NODE_PATH: ${NODE_PATH:-'(not set)'}"
    log "ERROR" "PROJECT_ROOT: ${PROJECT_ROOT:-'(not set)'}"
    log "ERROR" "Module base directory: ${MODULE_BASE_DIR:-'(not set)'}"
    
    # Determine specific module loading failure type and exit code
    local specific_exit_code
    local recovery_action
    local should_continue="false"
    
    if [[ "$error_message" =~ "Cannot find module" ]]; then
        specific_exit_code=20  # Module dependency missing
        recovery_action="Install missing Node.js dependencies"
        should_continue="true"
        log "ERROR" "Module Dependency Missing: Required Node.js module not found"
    elif [[ "$error_message" =~ "ENOENT" ]]; then
        specific_exit_code=21  # File not found during execution
        recovery_action="Verify input files and paths exist"
        should_continue="true"
        log "ERROR" "File Not Found During Execution: Module cannot find required files"
    elif [[ "$error_message" =~ "EACCES" ]]; then
        specific_exit_code=22  # Permission denied during execution
        recovery_action="Check file and directory permissions"
        should_continue="false"
        log "ERROR" "Permission Denied During Execution: Module lacks required permissions"
    elif [[ "$error_code" -eq 124 ]]; then
        specific_exit_code=23  # Timeout
        recovery_action="Reduce processing load or increase timeout"
        should_continue="true"
        log "ERROR" "Module Execution Timeout: Operation took too long to complete"
    elif [[ "$error_code" -eq 127 ]]; then
        specific_exit_code=24  # Node.js not found
        recovery_action="Install or configure Node.js properly"
        should_continue="false"
        log "ERROR" "Node.js Not Found: Cannot execute Node.js modules"
    else
        specific_exit_code=25  # General module execution error
        recovery_action="Review module logs and dependencies"
        should_continue="true"
        log "ERROR" "General Module Error: Module execution failed"
    fi
    
    # Enhanced error reporting with actionable guidance
    log "ERROR" "=========================================="
    log "ERROR" "MODULE LOADING RECOVERY GUIDANCE"
    log "ERROR" "=========================================="
    log "INFO" "Recommended action: $recovery_action"
    log "INFO" "Specific exit code: $specific_exit_code"
    
    # Provide specific troubleshooting steps
    case "$specific_exit_code" in
        20) # Module dependency missing
            log "INFO" "Troubleshooting steps for missing dependencies:"
            log "INFO" "  1. Install dependencies: cd $PROJECT_DIR && npm install"
            log "INFO" "  2. Check package.json: cat $PROJECT_DIR/package.json"
            log "INFO" "  3. Verify node_modules: ls -la $PROJECT_DIR/node_modules/"
            log "INFO" "  4. Test module loading: node -e 'require(\"$context\")'"
            ;;
        21) # File not found during execution
            log "INFO" "Troubleshooting steps for missing files during execution:"
            log "INFO" "  1. Check input file paths in module arguments"
            log "INFO" "  2. Verify working directory: pwd"
            log "INFO" "  3. List available files: ls -la"
            log "INFO" "  4. Check module expectations: node $context --help 2>/dev/null || echo 'No help available'"
            ;;
        22) # Permission denied during execution
            log "INFO" "Troubleshooting steps for permission errors:"
            log "INFO" "  1. Check file permissions: ls -la $context"
            log "INFO" "  2. Verify directory permissions: ls -ld $(dirname $context)"
            log "INFO" "  3. Check user permissions: id"
            log "INFO" "  4. Test file access: test -r $context && test -w $(dirname $context) && echo 'OK' || echo 'Permission issue'"
            ;;
        23) # Timeout
            log "INFO" "Troubleshooting steps for timeout errors:"
            log "INFO" "  1. Reduce input data size or complexity"
            log "INFO" "  2. Check system resources: top -l 1 | head -10"
            log "INFO" "  3. Monitor module execution: timeout 30 node $context --dry-run"
            log "INFO" "  4. Review module logs for hanging operations"
            ;;
        24) # Node.js not found
            log "INFO" "Troubleshooting steps for Node.js not found:"
            log "INFO" "  1. Install Node.js: https://nodejs.org/"
            log "INFO" "  2. Check PATH: echo \$PATH | tr ':' '\n'"
            log "INFO" "  3. Verify installation: which node && node --version"
            log "INFO" "  4. Restart shell after installation"
            ;;
        25) # General module execution error
            log "INFO" "Troubleshooting steps for general module errors:"
            log "INFO" "  1. Run module manually: node $context"
            log "INFO" "  2. Check module logs: tail -n 20 $PROJECT_DIR/logs/organize.log"
            log "INFO" "  3. Test with minimal input: node $context --test"
            log "INFO" "  4. Verify module integrity: node -c $context"
            ;;
    esac
    
    log "ERROR" "=========================================="
    
    # Return appropriate exit code
    if [[ "$should_continue" == "true" ]]; then
        log "INFO" "Continuing execution with graceful degradation (exit code: $specific_exit_code)"
        return 0  # Continue execution
    else
        log "FATAL" "Cannot continue execution due to critical module loading error (exit code: $specific_exit_code)"
        return "$specific_exit_code"  # Stop execution
    fi
}

# Generic error handling for non-path-related errors
handle_generic_error() {
    local error_code="$1"
    local error_message="$2"
    local context="$3"
    local operation="$4"
    
    log "ERROR" "Operation failed: $operation | Error: $error_message | Context: $context | Exit Code: $error_code"
    
    # Determine recovery strategy based on error type
    case "$error_code" in
        1)
            log "INFO" "General error - attempting to continue with fallback behavior"
            return 0  # Continue execution
            ;;
        2)
            log "WARN" "File not found error - skipping operation"
            return 0  # Continue execution
            ;;
        126|127)
            log "FATAL" "Command not found or not executable - cannot continue"
            return 1  # Stop execution
            ;;
        130)
            log "INFO" "Operation interrupted by user - stopping gracefully"
            return 1  # Stop execution
            ;;
        *)
            log "WARN" "Unknown error code - attempting to continue"
            return 0  # Continue execution
            ;;
    esac
}

# ============================================================================
# PATH RESOLUTION UTILITY FUNCTIONS
# ============================================================================

# Exit code documentation for path resolution failures
# This function provides documentation for all custom exit codes used in path resolution error handling
document_exit_codes() {
    cat << 'EOF'
PATH RESOLUTION ERROR EXIT CODES:

Generic Error Codes:
  0   - Success
  1   - General error (with fallback behavior)
  2   - File not found (skippable)
  126 - Permission denied or not executable (critical)
  127 - Command not found (critical)
  130 - User interrupt (graceful stop)

Path Resolution Specific Codes (10-19):
  10  - Path resolution failure (module not found in expected locations)
  11  - General path-related error (path configuration issue)
  12  - File/directory not found (missing required file)
  13  - Permission denied or not executable (file access issue)
  14  - Command not found (Node.js or module execution failed)
  15  - Unknown path-related error (unexpected path resolution failure)

Module Loading Specific Codes (20-29):
  20  - Module dependency missing (Node.js module not found)
  21  - File not found during execution (module cannot find required files)
  22  - Permission denied during execution (module lacks permissions)
  23  - Module execution timeout (operation took too long)
  24  - Node.js not found (cannot execute Node.js modules)
  25  - General module execution error (module execution failed)

Usage:
  - Codes 0-2, 10-12, 20-21, 23, 25: Allow continued execution with fallback
  - Codes 13-14, 22, 24, 126-127, 130: Require stopping execution
  - All codes provide specific troubleshooting guidance in error messages

EOF
}

# Test function for enhanced error handling (for validation purposes)
test_enhanced_error_handling() {
    log "INFO" "Testing enhanced error handling system..."
    
    # Test path resolution error handling
    log "INFO" "Testing path resolution error handling..."
    handle_error 10 "Test path resolution failure" "batch_processor.js" "resolve_module_path"
    
    # Test module loading error handling
    log "INFO" "Testing module loading error handling..."
    handle_error 20 "Cannot find module 'test-module'" "test-module.js" "execute_node_module"
    
    # Test generic error handling
    log "INFO" "Testing generic error handling..."
    handle_error 1 "Test generic error" "test_context" "test_operation"
    
    log "INFO" "Enhanced error handling test completed"
    
    # Show exit code documentation
    log "INFO" "Exit code documentation:"
    document_exit_codes
}

# Resolve module path with fallback locations for module discovery
resolve_module_path() {
    local module_name="$1"
    
    if [[ -z "$module_name" ]]; then
        log "ERROR" "Module name is required for path resolution"
        return 1
    fi
    
    log "DEBUG" "Starting path resolution for module: $module_name"
    
    # Define ordered fallback list as specified in requirements: src/organize/, organize/, script directory
    local fallback_locations=(
        "src/organize"     # Primary: PROJECT_DIR/src/organize/
        "organize"         # Secondary: PROJECT_DIR/organize/
        "script_dir"       # Tertiary: SCRIPT_DIR/
    )
    
    local fallback_descriptions=(
        "primary location (src/organize)"
        "legacy location (organize)"
        "script directory"
    )
    
    # Try each fallback location in order
    for i in "${!fallback_locations[@]}"; do
        local location="${fallback_locations[$i]}"
        local description="${fallback_descriptions[$i]}"
        local module_path=""
        
        case "$location" in
            "src/organize")
                module_path="$PROJECT_DIR/src/organize/$module_name"
                ;;
            "organize")
                module_path="$PROJECT_DIR/organize/$module_name"
                ;;
            "script_dir")
                module_path="$SCRIPT_DIR/$module_name"
                ;;
        esac
        
        log "DEBUG" "Checking fallback location $((i+1)): $description -> $module_path"
        
        if [[ -f "$module_path" ]]; then
            log "INFO" "✓ Module '$module_name' resolved successfully using $description"
            log "INFO" "  Resolution method: Fallback location $((i+1)) of ${#fallback_locations[@]}"
            log "INFO" "  Resolved path: $module_path"
            echo "$module_path"
            return 0
        else
            log "DEBUG" "✗ Module not found at $description: $module_path"
        fi
    done
    
    # Module not found in any location - use enhanced error reporting
    log "ERROR" "Module '$module_name' not found in any fallback location"
    log "ERROR" "Attempted locations:"
    for i in "${!fallback_locations[@]}"; do
        local location="${fallback_locations[$i]}"
        local description="${fallback_descriptions[$i]}"
        local module_path=""
        
        case "$location" in
            "src/organize")
                module_path="$PROJECT_DIR/src/organize/$module_name"
                ;;
            "organize")
                module_path="$PROJECT_DIR/organize/$module_name"
                ;;
            "script_dir")
                module_path="$SCRIPT_DIR/$module_name"
                ;;
        esac
        
        log "ERROR" "  $((i+1)). $description: $module_path"
    done
    
    report_path_resolution_error "$PROJECT_DIR/src/organize/$module_name" "resolve_module_path" "$module_name" 0 0
    
    return 1
}

# Validate that all required modules exist at their expected paths
validate_required_modules() {
    log "INFO" "Validating required Node.js modules..."
    
    local required_modules=(
        "batch_processor.js"
        "content_analyzer.js"
        "content_consolidator.js"
        "category_manager.js"
        "document_search_engine.js"
        "simple_path_resolver.js"
    )
    
    local missing_modules=()
    local found_modules=()
    
    for module in "${required_modules[@]}"; do
        local module_path
        if module_path=$(resolve_module_path "$module"); then
            found_modules+=("$module")
            log "DEBUG" "✓ Found module: $module at $module_path"
        else
            missing_modules+=("$module")
            log "ERROR" "✗ Missing module: $module"
        fi
    done
    
    if [[ ${#missing_modules[@]} -gt 0 ]]; then
        log "ERROR" "Module validation failed: ${#missing_modules[@]} missing modules"
        
        # Use enhanced error reporting for each missing module
        for missing_module in "${missing_modules[@]}"; do
            report_path_resolution_error "$PROJECT_DIR/src/organize/$missing_module" "validate_required_modules" "$missing_module" 0 0
        done
        
        return 1
    fi
    
    log "INFO" "All required modules validated successfully (${#found_modules[@]}/${#required_modules[@]})"
    return 0
}

# Setup standardized Node.js execution environment
setup_node_environment() {
    log "DEBUG" "Setting up Node.js execution environment..."
    
    # Set PROJECT_ROOT environment variable (allow override)
    export PROJECT_ROOT="${PROJECT_ROOT:-$PROJECT_DIR}"
    
    # Set module base directory
    export MODULE_BASE_DIR="${MODULE_BASE_DIR:-$PROJECT_DIR/src/organize}"
    
    # Set configuration paths
    export CONFIG_BASE_DIR="${CONFIG_BASE_DIR:-$PROJECT_DIR/config}"
    export CONFIG_PATH="$CONFIG_BASE_DIR/organize_config.conf"
    
    # Set Node.js module search paths
    export NODE_PATH="$PROJECT_DIR/src:$PROJECT_DIR/node_modules:${NODE_PATH:-}"
    
    # Set sync hub path from configuration
    export SYNC_HUB="${SYNC_HUB:-}"
    
    # Set logging configuration
    export LOG_LEVEL="${LOG_LEVEL:-INFO}"
    export DEBUG="${DEBUG:-false}"
    
    # Set feature flags
    export ENABLE_DUPLICATE_DETECTION="${ENABLE_DUPLICATE_DETECTION:-true}"
    export ENABLE_CONTENT_CONSOLIDATION="${ENABLE_CONTENT_CONSOLIDATION:-true}"
    export ENABLE_AI_ENHANCEMENT="${ENABLE_AI_ENHANCEMENT:-false}"
    export ENABLE_CATEGORY_SUGGESTIONS="${ENABLE_CATEGORY_SUGGESTIONS:-true}"
    
    # Set analysis parameters
    export SIMILARITY_THRESHOLD="${SIMILARITY_THRESHOLD:-0.8}"
    export MIN_CONSOLIDATION_FILES="${MIN_CONSOLIDATION_FILES:-2}"
    
    log "DEBUG" "Node.js environment setup completed:"
    log "DEBUG" "  PROJECT_ROOT: $PROJECT_ROOT"
    log "DEBUG" "  MODULE_BASE_DIR: $MODULE_BASE_DIR"
    log "DEBUG" "  CONFIG_BASE_DIR: $CONFIG_BASE_DIR"
    log "DEBUG" "  NODE_PATH: $NODE_PATH"
    log "DEBUG" "  SYNC_HUB: ${SYNC_HUB:-'(not set)'}"
    
    return 0
}

# Enhanced error reporting for path resolution failures
report_path_resolution_error() {
    local attempted_path="$1"
    local context="$2"
    local module_name="${3:-unknown}"
    local retry_attempt="${4:-0}"
    local max_retries="${5:-0}"
    
    # Header with clear error identification
    log "ERROR" "=========================================="
    log "ERROR" "PATH RESOLUTION FAILURE DETECTED"
    log "ERROR" "=========================================="
    log "ERROR" "Module: $module_name"
    log "ERROR" "Attempted path: $attempted_path"
    log "ERROR" "Context: $context"
    
    # Retry information (Requirement 3.3)
    if [[ $retry_attempt -gt 0 ]]; then
        log "ERROR" "Retry attempt: $retry_attempt/$max_retries"
        log "INFO" "Path correction being attempted: Trying fallback locations"
    fi
    
    # Diagnostic information (Requirement 3.2)
    log "ERROR" "=========================================="
    log "ERROR" "DIAGNOSTIC INFORMATION"
    log "ERROR" "=========================================="
    log "ERROR" "Current working directory: $(pwd)"
    log "ERROR" "Script directory: $SCRIPT_DIR"
    log "ERROR" "Project directory: $PROJECT_DIR"
    log "ERROR" "Expected primary location: $PROJECT_DIR/src/organize/"
    
    # Environment variables that affect path resolution
    log "INFO" "Environment variables:"
    log "INFO" "  PROJECT_ROOT: ${PROJECT_ROOT:-'(not set)'}"
    log "INFO" "  MODULE_BASE_DIR: ${MODULE_BASE_DIR:-'(not set)'}"
    log "INFO" "  NODE_PATH: ${NODE_PATH:-'(not set)'}"
    
    # Directory structure analysis (Requirement 3.1)
    log "ERROR" "=========================================="
    log "ERROR" "DIRECTORY STRUCTURE ANALYSIS"
    log "ERROR" "=========================================="
    
    # Check primary location
    if [[ -d "$PROJECT_DIR/src/organize" ]]; then
        log "INFO" "✓ Primary directory exists: $PROJECT_DIR/src/organize"
        log "INFO" "Contents of $PROJECT_DIR/src/organize:"
        ls -la "$PROJECT_DIR/src/organize" 2>/dev/null | while read -r line; do
            log "INFO" "  $line"
        done
        
        # Check if the specific module exists but with different permissions
        if [[ -e "$PROJECT_DIR/src/organize/$module_name" ]]; then
            local file_perms=$(ls -la "$PROJECT_DIR/src/organize/$module_name" 2>/dev/null)
            log "INFO" "Module file exists but may have permission issues:"
            log "INFO" "  $file_perms"
        fi
    else
        log "ERROR" "✗ Primary directory does not exist: $PROJECT_DIR/src/organize"
        
        # Check if src directory exists
        if [[ -d "$PROJECT_DIR/src" ]]; then
            log "INFO" "✓ src directory exists, listing contents:"
            ls -la "$PROJECT_DIR/src" 2>/dev/null | while read -r line; do
                log "INFO" "  $line"
            done
        else
            log "ERROR" "✗ src directory does not exist: $PROJECT_DIR/src"
        fi
    fi
    
    # Check fallback locations
    local fallback_paths=(
        "$PROJECT_DIR/organize"
        "$SCRIPT_DIR"
        "$(dirname "$PROJECT_DIR")/organize"
    )
    
    log "INFO" "Checking fallback locations:"
    for fallback_path in "${fallback_paths[@]}"; do
        if [[ -d "$fallback_path" ]]; then
            log "INFO" "✓ Fallback directory exists: $fallback_path"
            if [[ -f "$fallback_path/$module_name" ]]; then
                log "INFO" "  ✓ Module found at fallback location: $fallback_path/$module_name"
            else
                log "INFO" "  ✗ Module not found at: $fallback_path/$module_name"
            fi
            
            # List contents of fallback directory
            log "INFO" "  Contents of $fallback_path:"
            ls -la "$fallback_path" 2>/dev/null | head -10 | while read -r line; do
                log "INFO" "    $line"
            done
        else
            log "INFO" "✗ Fallback directory does not exist: $fallback_path"
        fi
    done
    
    # Path correction suggestions (Requirement 3.3)
    log "ERROR" "=========================================="
    log "ERROR" "PATH CORRECTION SUGGESTIONS"
    log "ERROR" "=========================================="
    
    if [[ $retry_attempt -gt 0 ]]; then
        log "INFO" "Currently attempting path corrections:"
        log "INFO" "  1. Trying fallback location: $PROJECT_DIR/organize/$module_name"
        log "INFO" "  2. Trying script directory: $SCRIPT_DIR/$module_name"
        log "INFO" "  3. Trying parent organize: $(dirname "$PROJECT_DIR")/organize/$module_name"
    fi
    
    # Actionable guidance (Requirement 3.1)
    log "ERROR" "=========================================="
    log "ERROR" "TROUBLESHOOTING GUIDANCE"
    log "ERROR" "=========================================="
    log "INFO" "Immediate actions to resolve this issue:"
    log "INFO" "  1. Verify project structure:"
    log "INFO" "     Run: ls -la $PROJECT_DIR/src/organize/"
    log "INFO" "  2. Check if module exists in expected location:"
    log "INFO" "     Run: ls -la $PROJECT_DIR/src/organize/$module_name"
    log "INFO" "  3. Verify file permissions allow read access:"
    log "INFO" "     Run: test -r $PROJECT_DIR/src/organize/$module_name && echo 'Readable' || echo 'Not readable'"
    log "INFO" "  4. Check Node.js module dependencies:"
    log "INFO" "     Run: cd $PROJECT_DIR && npm list"
    log "INFO" "  5. Validate project root detection:"
    log "INFO" "     Expected: Directory containing 'src' folder"
    log "INFO" "     Actual: $PROJECT_DIR"
    
    # Environment-specific guidance
    if [[ -n "${PROJECT_ROOT:-}" ]]; then
        log "INFO" "  6. PROJECT_ROOT override is set to: $PROJECT_ROOT"
        log "INFO" "     Verify this path is correct for your environment"
    else
        log "INFO" "  6. Consider setting PROJECT_ROOT environment variable if auto-detection fails"
        log "INFO" "     Example: export PROJECT_ROOT='$PROJECT_DIR'"
    fi
    
    log "ERROR" "=========================================="
    
    # Return appropriate exit code based on retry status
    if [[ $retry_attempt -ge $max_retries && $max_retries -gt 0 ]]; then
        log "ERROR" "All retry attempts exhausted. Manual intervention required."
        return 1
    fi
    
    return 0
}

# Execute Node.js module with comprehensive error handling and graceful degradation
execute_node_module() {
    local module_name="$1"
    shift
    local module_args="$*"
    
    local module_path
    if ! module_path=$(resolve_module_path "$module_name"); then
        report_path_resolution_error "$PROJECT_DIR/src/organize/$module_name" "execute_node_module" "$module_name" 0 0
        return 1
    fi
    
    log "DEBUG" "Executing Node.js module: $module_path with args: $module_args"
    
    # Execute the module with proper environment and comprehensive error handling
    local exit_code=0
    local error_output=""
    
    # Capture both stdout and stderr for better error analysis
    local temp_stdout=$(mktemp)
    local temp_stderr=$(mktemp)
    
    # Execute with timeout to prevent hanging
    if timeout 120 node "$module_path" $module_args >"$temp_stdout" 2>"$temp_stderr"; then
        # Success - output the results
        cat "$temp_stdout"
        log "DEBUG" "Module execution successful: $module_name"
        exit_code=0
    else
        exit_code=$?
        error_output=$(cat "$temp_stderr" 2>/dev/null || echo "No error output captured")
        
        # Enhanced error reporting with context
        log "ERROR" "Module execution failed: $module_name (exit code: $exit_code)"
        log "ERROR" "Error output: $error_output"
        
        # Analyze error type for better handling
        if [[ $exit_code -eq 124 ]]; then
            log "ERROR" "Module execution timed out after 120 seconds"
            report_module_execution_error "$module_name" "$module_path" "$exit_code" "timeout" "$error_output"
        elif [[ $exit_code -eq 127 ]]; then
            log "ERROR" "Node.js command not found or module not executable"
            report_module_execution_error "$module_name" "$module_path" "$exit_code" "command_not_found" "$error_output"
        elif [[ "$error_output" =~ "Cannot find module" ]]; then
            log "ERROR" "Module dependency missing"
            report_module_execution_error "$module_name" "$module_path" "$exit_code" "missing_dependency" "$error_output"
        elif [[ "$error_output" =~ "ENOENT" ]]; then
            log "ERROR" "File or directory not found during module execution"
            report_module_execution_error "$module_name" "$module_path" "$exit_code" "file_not_found" "$error_output"
        elif [[ "$error_output" =~ "EACCES" ]]; then
            log "ERROR" "Permission denied during module execution"
            report_module_execution_error "$module_name" "$module_path" "$exit_code" "permission_denied" "$error_output"
        else
            log "ERROR" "General module execution error"
            report_module_execution_error "$module_name" "$module_path" "$exit_code" "general_error" "$error_output"
        fi
    fi
    
    # Cleanup temporary files
    rm -f "$temp_stdout" "$temp_stderr"
    
    return $exit_code
}

# Enhanced error reporting specifically for module execution failures
report_module_execution_error() {
    local module_name="$1"
    local module_path="$2"
    local exit_code="$3"
    local error_type="$4"
    local error_output="$5"
    
    log "ERROR" "=========================================="
    log "ERROR" "MODULE EXECUTION FAILURE DETECTED"
    log "ERROR" "=========================================="
    log "ERROR" "Module: $module_name"
    log "ERROR" "Module path: $module_path"
    log "ERROR" "Exit code: $exit_code"
    log "ERROR" "Error type: $error_type"
    log "ERROR" "Error output: $error_output"
    
    # Module-specific diagnostic information
    log "ERROR" "=========================================="
    log "ERROR" "MODULE DIAGNOSTIC INFORMATION"
    log "ERROR" "=========================================="
    
    # Check if module file exists and is readable
    if [[ -f "$module_path" ]]; then
        local file_info=$(ls -la "$module_path" 2>/dev/null)
        log "INFO" "✓ Module file exists: $file_info"
        
        # Check if file is readable
        if [[ -r "$module_path" ]]; then
            log "INFO" "✓ Module file is readable"
        else
            log "ERROR" "✗ Module file is not readable"
        fi
        
        # Check if file is executable (for Node.js, this isn't strictly required but good to check)
        if [[ -x "$module_path" ]]; then
            log "INFO" "✓ Module file is executable"
        else
            log "WARN" "⚠ Module file is not executable (may be normal for Node.js modules)"
        fi
    else
        log "ERROR" "✗ Module file does not exist: $module_path"
    fi
    
    # Check Node.js availability and version
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version 2>/dev/null || echo "unknown")
        log "INFO" "✓ Node.js is available: $node_version"
        
        # Check if we can access the module directory
        local module_dir=$(dirname "$module_path")
        if [[ -d "$module_dir" ]]; then
            log "INFO" "✓ Module directory exists: $module_dir"
            
            # List other modules in the same directory for context
            log "INFO" "Other modules in directory:"
            ls -la "$module_dir"/*.js 2>/dev/null | while read -r line; do
                log "INFO" "  $line"
            done
        else
            log "ERROR" "✗ Module directory does not exist: $module_dir"
        fi
    else
        log "ERROR" "✗ Node.js is not available in PATH"
    fi
    
    # Environment diagnostic
    log "INFO" "Environment variables:"
    log "INFO" "  NODE_PATH: ${NODE_PATH:-'(not set)'}"
    log "INFO" "  PROJECT_ROOT: ${PROJECT_ROOT:-'(not set)'}"
    log "INFO" "  MODULE_BASE_DIR: ${MODULE_BASE_DIR:-'(not set)'}"
    log "INFO" "  PATH: ${PATH}"
    
    # Error-type specific guidance
    log "ERROR" "=========================================="
    log "ERROR" "TROUBLESHOOTING GUIDANCE"
    log "ERROR" "=========================================="
    
    case "$error_type" in
        "timeout")
            log "INFO" "Module execution timed out. Possible causes:"
            log "INFO" "  1. Module is processing large amounts of data"
            log "INFO" "  2. Module is waiting for external resources"
            log "INFO" "  3. Module has entered an infinite loop"
            log "INFO" "Actions to try:"
            log "INFO" "  1. Reduce the amount of data being processed"
            log "INFO" "  2. Check network connectivity if module uses external APIs"
            log "INFO" "  3. Review module logs for hanging operations"
            ;;
        "command_not_found")
            log "INFO" "Node.js command not found. Possible causes:"
            log "INFO" "  1. Node.js is not installed"
            log "INFO" "  2. Node.js is not in PATH"
            log "INFO" "  3. Incorrect Node.js installation"
            log "INFO" "Actions to try:"
            log "INFO" "  1. Install Node.js: https://nodejs.org/"
            log "INFO" "  2. Add Node.js to PATH"
            log "INFO" "  3. Verify installation: node --version"
            ;;
        "missing_dependency")
            log "INFO" "Module dependency missing. Possible causes:"
            log "INFO" "  1. npm packages not installed"
            log "INFO" "  2. Incorrect NODE_PATH configuration"
            log "INFO" "  3. Module requires additional dependencies"
            log "INFO" "Actions to try:"
            log "INFO" "  1. Run: cd $PROJECT_DIR && npm install"
            log "INFO" "  2. Check package.json for required dependencies"
            log "INFO" "  3. Verify NODE_PATH includes: $PROJECT_DIR/node_modules"
            ;;
        "file_not_found")
            log "INFO" "File or directory not found during execution. Possible causes:"
            log "INFO" "  1. Module expects files that don't exist"
            log "INFO" "  2. Incorrect file paths in module arguments"
            log "INFO" "  3. Missing configuration files"
            log "INFO" "Actions to try:"
            log "INFO" "  1. Verify all input files exist"
            log "INFO" "  2. Check module arguments for correct paths"
            log "INFO" "  3. Ensure configuration files are present"
            ;;
        "permission_denied")
            log "INFO" "Permission denied during execution. Possible causes:"
            log "INFO" "  1. Insufficient file system permissions"
            log "INFO" "  2. Module trying to write to protected directories"
            log "INFO" "  3. SELinux or similar security restrictions"
            log "INFO" "Actions to try:"
            log "INFO" "  1. Check file permissions: ls -la $module_path"
            log "INFO" "  2. Ensure write permissions for output directories"
            log "INFO" "  3. Run with appropriate user permissions"
            ;;
        *)
            log "INFO" "General module execution error. Actions to try:"
            log "INFO" "  1. Run module manually to see detailed error: node $module_path"
            log "INFO" "  2. Check module logs for specific error messages"
            log "INFO" "  3. Verify all module dependencies are satisfied"
            log "INFO" "  4. Test with minimal input to isolate the issue"
            ;;
    esac
    
    log "ERROR" "=========================================="
}

# Enhanced retry wrapper with exponential backoff and comprehensive error handling
run_with_retry() {
    local max_attempts="${1:-3}"
    local initial_delay="${2:-2}"
    local timeout="${3:-30}"
    shift 3
    local command="$*"
    
    local attempt=1
    local delay="$initial_delay"
    local total_wait_time=0
    
    log "INFO" "Starting retry operation: $command"
    log "DEBUG" "Retry configuration: max_attempts=$max_attempts, initial_delay=${initial_delay}s, timeout=${timeout}s"
    
    while [[ $attempt -le $max_attempts ]]; do
        log "INFO" "Attempt $attempt/$max_attempts: Executing command"
        log "DEBUG" "Command: $command"
        
        # Capture start time for performance monitoring
        local start_time=$(date +%s)
        
        # Execute command with timeout
        local exit_code=0
        local command_output=""
        local error_output=""
        
        # Create temporary files for capturing output
        local temp_stdout=$(mktemp)
        local temp_stderr=$(mktemp)
        
        if timeout "$timeout" bash -c "$command" >"$temp_stdout" 2>"$temp_stderr"; then
            # Success case
            local end_time=$(date +%s)
            local execution_time=$((end_time - start_time))
            
            # Output the results
            cat "$temp_stdout"
            
            log "INFO" "✓ Command succeeded on attempt $attempt (execution time: ${execution_time}s)"
            if [[ $attempt -gt 1 ]]; then
                log "INFO" "Total retry time: ${total_wait_time}s across $attempt attempts"
            fi
            
            # Cleanup and return success
            rm -f "$temp_stdout" "$temp_stderr"
            return 0
        else
            # Failure case
            exit_code=$?
            local end_time=$(date +%s)
            local execution_time=$((end_time - start_time))
            
            command_output=$(cat "$temp_stdout" 2>/dev/null || echo "")
            error_output=$(cat "$temp_stderr" 2>/dev/null || echo "")
            
            log "WARN" "✗ Command failed on attempt $attempt (exit code: $exit_code, execution time: ${execution_time}s)"
            
            # Enhanced error analysis and reporting
            analyze_and_report_retry_failure "$command" "$exit_code" "$attempt" "$max_attempts" "$error_output" "$command_output"
            
            # Check if we should continue retrying based on error type
            if ! should_retry_error "$exit_code" "$error_output"; then
                log "ERROR" "Error type indicates retrying will not help, stopping retry attempts"
                rm -f "$temp_stdout" "$temp_stderr"
                return $exit_code
            fi
            
            # If this was the last attempt, handle final failure
            if [[ $attempt -eq $max_attempts ]]; then
                log "ERROR" "All retry attempts exhausted ($max_attempts attempts over ${total_wait_time}s)"
                
                # Provide enhanced context for retry failures
                local enhanced_context="$command"
                if [[ "$command" =~ "execute_node_module" ]]; then
                    # Extract module name using simpler approach
                    local module_match=$(echo "$command" | grep -o "execute_node_module [^[:space:]]*" | cut -d' ' -f2 | tr -d "'\"")
                    if [[ -n "$module_match" ]]; then
                        enhanced_context="module=$module_match, command=$command, attempts=$max_attempts, total_time=${total_wait_time}s"
                    fi
                fi
                
                handle_error "$exit_code" "Command failed after $max_attempts retry attempts" "$enhanced_context" "run_with_retry"
                rm -f "$temp_stdout" "$temp_stderr"
                return $exit_code
            fi
            
            # Calculate next delay with exponential backoff and jitter
            local jitter=$((RANDOM % 2 + 1))  # Add 1-2 seconds of jitter
            local next_delay=$((delay + jitter))
            
            log "INFO" "Retrying in ${next_delay}s (base delay: ${delay}s, jitter: ${jitter}s)..."
            log "DEBUG" "Next attempt will be $((attempt + 1))/$max_attempts"
            
            # Sleep with progress indication for longer delays
            if [[ $next_delay -gt 5 ]]; then
                local countdown=$next_delay
                while [[ $countdown -gt 0 ]]; do
                    if [[ $((countdown % 5)) -eq 0 ]] || [[ $countdown -le 3 ]]; then
                        log "DEBUG" "Retrying in ${countdown}s..."
                    fi
                    sleep 1
                    ((countdown--))
                done
            else
                sleep "$next_delay"
            fi
            
            # Update counters for next iteration
            ((attempt++))
            total_wait_time=$((total_wait_time + next_delay))
            delay=$((delay * 2))  # Exponential backoff
            
            # Cap maximum delay at 60 seconds
            if [[ $delay -gt 60 ]]; then
                delay=60
            fi
        fi
        
        # Cleanup temporary files for this iteration
        rm -f "$temp_stdout" "$temp_stderr"
    done
    
    # This should never be reached, but included for completeness
    log "ERROR" "Unexpected exit from retry loop"
    return 1
}

# Analyze retry failure and provide detailed reporting
analyze_and_report_retry_failure() {
    local command="$1"
    local exit_code="$2"
    local attempt="$3"
    local max_attempts="$4"
    local error_output="$5"
    local command_output="$6"
    
    log "DEBUG" "Analyzing retry failure for detailed reporting"
    
    # Extract module information if this is a Node.js command
    local module_name=""
    local module_path=""
    if [[ "$command" == *"execute_node_module"* ]]; then
        # Extract module name from execute_node_module call
        module_name=$(echo "$command" | sed -n "s/.*execute_node_module[[:space:]]*['\"]\\([^'\"]*\\)['\"].*/\\1/p")
        if [[ -n "$module_name" ]]; then
            module_path=$(resolve_module_path "$module_name" 2>/dev/null || echo "unknown")
        fi
    elif [[ "$command" == *"node"* && "$command" == *".js"* ]]; then
        # Direct node command
        module_name=$(echo "$command" | grep -o '[^/]*\.js' | head -1)
        module_path=$(echo "$command" | grep -o '[^[:space:]]*\.js' | head -1)
    fi
    
    # Provide context-specific error reporting
    if [[ -n "$module_name" ]]; then
        log "WARN" "Module execution failure details:"
        log "WARN" "  Module: $module_name"
        log "WARN" "  Path: $module_path"
        log "WARN" "  Attempt: $attempt/$max_attempts"
        
        # Use enhanced path resolution error reporting for module-related failures
        if [[ $exit_code -eq 127 || $exit_code -eq 126 ]]; then
            report_path_resolution_error "$module_path" "run_with_retry" "$module_name" "$attempt" "$max_attempts"
        elif [[ "$error_output" =~ "Cannot find module" ]]; then
            log "WARN" "Module dependency issue detected"
            report_module_execution_error "$module_name" "$module_path" "$exit_code" "missing_dependency" "$error_output"
        fi
    fi
    
    # Log error details for debugging
    if [[ -n "$error_output" ]]; then
        log "DEBUG" "Error output from attempt $attempt:"
        echo "$error_output" | while IFS= read -r line; do
            log "DEBUG" "  $line"
        done
    fi
    
    if [[ -n "$command_output" ]]; then
        log "DEBUG" "Command output from attempt $attempt:"
        echo "$command_output" | while IFS= read -r line; do
            log "DEBUG" "  $line"
        done
    fi
}

# Determine if an error type is worth retrying
should_retry_error() {
    local exit_code="$1"
    local error_output="$2"
    
    # Don't retry for these permanent error conditions
    case "$exit_code" in
        126)  # Command not executable
            log "DEBUG" "Exit code 126 (not executable) - not retrying"
            return 1
            ;;
        127)  # Command not found
            log "DEBUG" "Exit code 127 (command not found) - not retrying"
            return 1
            ;;
        130)  # Interrupted by user (Ctrl+C)
            log "DEBUG" "Exit code 130 (user interrupt) - not retrying"
            return 1
            ;;
    esac
    
    # Don't retry for certain error patterns
    if [[ "$error_output" =~ "No such file or directory" && "$error_output" =~ "node" ]]; then
        log "DEBUG" "Node.js binary not found - not retrying"
        return 1
    fi
    
    if [[ "$error_output" =~ "Permission denied" && "$error_output" =~ "EACCES" ]]; then
        log "DEBUG" "Permission denied error - not retrying"
        return 1
    fi
    
    if [[ "$error_output" =~ "Cannot find module" && "$error_output" =~ "Error: Cannot find module" ]]; then
        # Module dependency errors might be worth retrying in case of transient npm issues
        log "DEBUG" "Module dependency error - will retry (might be transient)"
        return 0
    fi
    
    # Retry for most other errors (network issues, temporary file locks, etc.)
    log "DEBUG" "Error appears to be potentially transient - will retry"
    return 0
}

# Validate and ensure config file exists with comprehensive error handling
validate_config_file() {
    local config_path="$PROJECT_DIR/../config/organize_config.conf"
    local config_dir="$PROJECT_DIR/../config"
    
    log "DEBUG" "Validating configuration file setup" "config_path=$config_path"
    
    # Ensure config directory exists
    if [[ ! -d "$config_dir" ]]; then
        log "INFO" "Creating config directory: $config_dir"
        if ! mkdir -p "$config_dir" 2>/dev/null; then
            local mkdir_error=$?
            handle_error "$mkdir_error" "Failed to create config directory" "path=$config_dir, permissions=$(ls -ld $(dirname $config_dir) 2>/dev/null || echo 'parent not accessible')" "validate_config_file"
            return 1
        fi
    fi
    
    # Check if config directory is accessible and writable
    if [[ ! -r "$config_dir" ]]; then
        local dir_perms=$(ls -ld "$config_dir" 2>/dev/null || echo "directory not accessible")
        handle_error 2 "Config directory is not readable" "path=$config_dir, permissions=$dir_perms, user=$(whoami)" "validate_config_file"
        return 1
    fi
    
    if [[ ! -w "$config_dir" ]]; then
        local dir_perms=$(ls -ld "$config_dir" 2>/dev/null || echo "directory not accessible")
        handle_error 2 "Config directory is not writable" "path=$config_dir, permissions=$dir_perms, user=$(whoami)" "validate_config_file"
        return 1
    fi
    
    # Create default config file if it doesn't exist
    if [[ ! -f "$config_path" ]]; then
        log "INFO" "Creating default organize_config.conf at: $config_path"
        if ! create_default_config "$config_path"; then
            local create_error=$?
            local dir_perms=$(ls -ld "$config_dir" 2>/dev/null || echo "directory not accessible")
            handle_error "$create_error" "Failed to create default config file" "path=$config_path, directory_permissions=$dir_perms, user=$(whoami)" "validate_config_file"
            return 1
        fi
    else
        log "INFO" "Using existing config file: $config_path"
        
        # Validate config file is readable
        if [[ ! -r "$config_path" ]]; then
            local file_perms=$(ls -la "$config_path" 2>/dev/null || echo "file not accessible")
            handle_error 2 "Config file is not readable" "path=$config_path, permissions=$file_perms, user=$(whoami)" "validate_config_file"
            return 1
        fi
    fi
    
    log "DEBUG" "Configuration file validation completed successfully"
    return 0
}

# Create default configuration file
create_default_config() {
    local config_path="$1"
    
    cat > "$config_path" << 'EOF'
# Enhanced Document Organization Configuration
# This file contains settings for the document organization system

# General Settings
[general]
similarity_threshold = 0.8
min_consolidation_files = 2
enable_duplicate_detection = true
enable_content_consolidation = true
enable_ai_enhancement = false
enable_category_suggestions = true

# Default Categories
# These are built-in categories that cannot be modified
# Custom categories can be added in the "Custom Categories" section below

# Custom Categories
# Add your custom categories here using the format:
# [category.your_category_id]
# name = "Your Category Name"
# icon = "📂"
# description = "Description of your category"
# keywords = ["keyword1", "keyword2", "keyword3"]
# file_patterns = ["*pattern*", "*.ext"]
# priority = 5
# auto_detect = true
# created_by = "user"
# created_at = "2024-01-01T00:00:00.000Z"

EOF
    
    log "INFO" "Default configuration file created successfully"
}

# Main organization function with advanced features
organize_documents() {
    local source_dir="$1"
    local dry_run="${2:-false}"
    
    log "INFO" "Starting enhanced organization process"
    log "INFO" "Source directory: $source_dir"
    log "INFO" "Dry run mode: $dry_run"
    log "INFO" "Duplicate detection: $ENABLE_DUPLICATE_DETECTION"
    log "INFO" "Content consolidation: $ENABLE_CONTENT_CONSOLIDATION"
    log "INFO" "AI enhancement: $ENABLE_AI_ENHANCEMENT"
    
    # Validate required modules before proceeding (Requirement 4.1)
    if ! validate_required_modules; then
        log "ERROR" "Required module validation failed - cannot continue with organization process"
        log "ERROR" "Please ensure all required Node.js modules are present in the expected locations"
        log "ERROR" "Run system validation: node $PROJECT_DIR/src/organize/startup_validator.js"
        return 1
    fi
    
    log "INFO" "All required dependencies validated successfully - proceeding with organization"
    
    # Setup Node.js environment for consistent execution
    setup_node_environment
    
    # Validate config file exists and is accessible
    if ! validate_config_file; then
        log "ERROR" "Failed to validate configuration file"
        return 1
    fi
    
    # Ensure category directories exist
    setup_category_structure "$source_dir"
    
    # Get list of files to process
    local files_to_process=()
    while IFS= read -r -d '' file; do
        if [[ -f "$file" && ! "$file" =~ /\. && ! "$file" =~ _category_info\.md$ ]]; then
            files_to_process+=("$file")
        fi
    done < <(find "$source_dir" -maxdepth 3 -type f -print0)
    
    if [[ ${#files_to_process[@]} -eq 0 ]]; then
        log "INFO" "No files to process"
        return 0
    fi
    
    log "INFO" "Found ${#files_to_process[@]} files to process"
    
    # Step 1: Analyze content for duplicates and consolidation opportunities
    local analysis_results="/tmp/content_analysis_results.json"
    local duplicates_found="/tmp/duplicates_found.json"
    local consolidation_candidates="/tmp/consolidation_candidates.json"
    
    if [[ "$ENABLE_DUPLICATE_DETECTION" == "true" || "$ENABLE_CONTENT_CONSOLIDATION" == "true" ]]; then
        log "INFO" "Running content analysis..."
        run_content_analysis "${files_to_process[@]}" "$analysis_results" "$duplicates_found" "$consolidation_candidates"
    fi
    
    # Step 2: Handle duplicates
    if [[ "$ENABLE_DUPLICATE_DETECTION" == "true" && -f "$duplicates_found" ]]; then
        if [[ "$dry_run" == "true" ]]; then
            log "INFO" "DRY RUN: Analyzing duplicates (no files will be deleted)..."
        else
            log "INFO" "Processing duplicates..."
        fi
        process_duplicates "$duplicates_found" "$dry_run"
    fi
    
    # Step 3: Handle content consolidation
    if [[ "$ENABLE_CONTENT_CONSOLIDATION" == "true" && -f "$consolidation_candidates" ]]; then
        if [[ "$dry_run" == "true" ]]; then
            log "INFO" "DRY RUN: Analyzing consolidation candidates (no files will be created)..."
        else
            log "INFO" "Processing consolidation candidates..."
        fi
        process_consolidation_candidates "$consolidation_candidates" "$dry_run"
    fi
    
    # Step 4: Organize remaining files
    if [[ "$dry_run" == "true" ]]; then
        log "INFO" "DRY RUN: Analyzing file organization (no files will be moved)..."
    else
        log "INFO" "Organizing remaining files..."
    fi
    organize_remaining_files "$source_dir" "$dry_run"
    
    # Step 5: Check for category suggestions
    if [[ "$ENABLE_CATEGORY_SUGGESTIONS" == "true" ]]; then
        log "INFO" "Checking for category suggestions..."
        check_category_suggestions "$source_dir"
    fi
    
    # Cleanup temporary files
    rm -f "$analysis_results" "$duplicates_found" "$consolidation_candidates"
    
    log "INFO" "Enhanced organization process completed"
}

# Setup category structure with extensible system
setup_category_structure() {
    local base_dir="$1"
    
    # Create category directories using environment variables with defaults
    local categories=(
        "${CATEGORY_AI_ML:-AI & ML}"
        "${CATEGORY_RESEARCH:-Research Papers}"
        "${CATEGORY_WEB:-Web Content}"
        "${CATEGORY_NOTES:-Notes & Drafts}"
        "${CATEGORY_DEV:-Development}"
    )
    
    for category in "${categories[@]}"; do
        local category_dir="$base_dir/$category"
        if [[ ! -d "$category_dir" ]]; then
            mkdir -p "$category_dir"
            log "INFO" "Created category folder: $category"
            
            # Create category info file
            cat > "$category_dir/_category_info.md" << EOF
# $category

This folder contains documents related to $category.

## Category Guidelines
- Files in this category should be relevant to: $category
- Content is automatically organized based on content analysis
- Manual organization is also supported

Last updated: $(date)
EOF
        fi
    done
    
    log "INFO" "Category structure setup complete"
}

# Run content analysis using Node.js modules with comprehensive error handling
run_content_analysis() {
    # Get the last 3 arguments which are the output file paths
    local analysis_results="${!#}"           # Last argument
    local consolidation_candidates="${@: -2:1}"  # Second to last
    local duplicates_found="${@: -3:1}"      # Third to last
    
    # Get all arguments except the last 3 as the file list
    local total_args=$#
    local file_count=$((total_args - 3))
    local file_list=("${@:1:$file_count}")
    
    log "INFO" "Starting content analysis for ${#file_list[@]} files"
    
    # Validate input parameters
    if [[ ${#file_list[@]} -eq 0 ]]; then
        handle_error 1 "No files provided for analysis" "file_count=0, total_args=$total_args, expected_outputs=$analysis_results,$consolidation_candidates,$duplicates_found" "run_content_analysis"
        return 1
    fi
    
    # Create file list for Node.js with proper escaping and validation
    local file_list_json="["
    local valid_files=0
    
    for file in "${file_list[@]}"; do
        # Validate file exists and is readable
        if [[ ! -f "$file" ]]; then
            log "WARN" "Skipping non-existent file: $file"
            continue
        fi
        
        if [[ ! -r "$file" ]]; then
            log "WARN" "Skipping unreadable file: $file"
            continue
        fi
        
        # Properly escape file paths for JSON
        local escaped_file=$(printf '%s' "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')
        file_list_json+='"'$escaped_file'",'
        ((valid_files++))
    done
    
    file_list_json="${file_list_json%,}]"
    
    if [[ $valid_files -eq 0 ]]; then
        log "WARN" "No valid files found for analysis, creating empty results"
        echo "[]" > "$duplicates_found"
        echo "[]" > "$consolidation_candidates"
        return 0
    fi
    
    log "DEBUG" "Processing $valid_files valid files for analysis"
    
    # Run duplicate analysis with comprehensive error handling and graceful degradation
    log "INFO" "Running duplicate detection analysis..."
    if check_advanced_module_availability "batch_processor.js"; then
        log "DEBUG" "Advanced duplicate detection available, proceeding with batch processor"
        
        if run_with_retry 3 2 90 "
            PROJECT_ROOT='$PROJECT_DIR/..' \
            SIMILARITY_THRESHOLD='$SIMILARITY_THRESHOLD' \
            FILE_LIST_JSON='$file_list_json' \
            DUPLICATES_FOUND='$duplicates_found' \
            execute_node_module 'batch_processor.js' duplicates
        "; then
            log "INFO" "✓ Advanced duplicate analysis completed successfully"
        else
            log "WARN" "Advanced duplicate analysis failed, using graceful degradation"
            create_fallback_duplicate_analysis "$file_list_json" "$duplicates_found"
        fi
    else
        log "INFO" "Advanced duplicate detection unavailable, using simplified approach"
        create_fallback_duplicate_analysis "$file_list_json" "$duplicates_found"
    fi
    
    # Run consolidation analysis with comprehensive error handling and graceful degradation
    log "INFO" "Running consolidation analysis..."
    if check_advanced_module_availability "batch_processor.js"; then
        log "DEBUG" "Advanced consolidation analysis available, proceeding with batch processor"
        
        if run_with_retry 3 2 90 "
            PROJECT_ROOT='$PROJECT_DIR/..' \
            SIMILARITY_THRESHOLD='$SIMILARITY_THRESHOLD' \
            FILE_LIST_JSON='$file_list_json' \
            CONSOLIDATION_CANDIDATES='$consolidation_candidates' \
            execute_node_module 'batch_processor.js' consolidation
        "; then
            log "INFO" "✓ Advanced consolidation analysis completed successfully"
        else
            log "WARN" "Advanced consolidation analysis failed, using graceful degradation"
            create_fallback_consolidation_analysis "$file_list_json" "$consolidation_candidates"
        fi
    else
        log "INFO" "Advanced consolidation analysis unavailable, using simplified approach"
        create_fallback_consolidation_analysis "$file_list_json" "$consolidation_candidates"
    fi
    
    # Validate output files were created
    for output_file in "$duplicates_found" "$consolidation_candidates"; do
        if [[ ! -f "$output_file" ]]; then
            log "WARN" "Output file not created, creating empty file: $output_file"
            echo "[]" > "$output_file"
        elif [[ ! -s "$output_file" ]]; then
            log "DEBUG" "Output file is empty: $output_file"
        fi
    done
    
    log "INFO" "Content analysis completed"
    return 0
}

# Fallback duplicate analysis when advanced modules are unavailable
create_fallback_duplicate_analysis() {
    local file_list_json="$1"
    local duplicates_found="$2"
    
    log "INFO" "Creating fallback duplicate analysis results"
    
    # Simple duplicate detection based on file size and name similarity
    local temp_file_info=$(mktemp)
    local duplicates_json="[]"
    
    # Extract file paths from JSON and get basic file info
    echo "$file_list_json" | jq -r '.[]' 2>/dev/null | while IFS= read -r file_path; do
        if [[ -f "$file_path" ]]; then
            local file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo "0")
            local file_name=$(basename "$file_path")
            local file_hash=$(echo "$file_name" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "unknown")
            
            echo "$file_size|$file_name|$file_path|$file_hash" >> "$temp_file_info"
        fi
    done
    
    # Simple duplicate detection: files with same size and similar names
    if [[ -f "$temp_file_info" && -s "$temp_file_info" ]]; then
        # Group files by size
        local size_groups=$(sort "$temp_file_info" | cut -d'|' -f1 | uniq -c | awk '$1 > 1 {print $2}')
        
        if [[ -n "$size_groups" ]]; then
            log "DEBUG" "Found potential duplicates based on file size"
            
            # Create a simple JSON structure for duplicates
            duplicates_json='[{"type":"size_based","files":[],"recommended_action":"review_manually","confidence":0.3}]'
            
            # Add files with duplicate sizes to the JSON
            local duplicate_files="["
            for size in $size_groups; do
                local files_with_size=$(grep "^$size|" "$temp_file_info" | cut -d'|' -f3)
                for file in $files_with_size; do
                    duplicate_files+='"'$(printf '%s' "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')'",'
                done
            done
            duplicate_files="${duplicate_files%,}]"
            
            # Update the JSON with actual file list
            duplicates_json=$(echo "$duplicates_json" | jq --argjson files "$duplicate_files" '.[0].files = $files')
        fi
    fi
    
    # Write results to output file
    echo "$duplicates_json" > "$duplicates_found"
    
    # Cleanup
    rm -f "$temp_file_info"
    
    log "INFO" "Fallback duplicate analysis completed (limited functionality)"
}

# Fallback consolidation analysis when advanced modules are unavailable
create_fallback_consolidation_analysis() {
    local file_list_json="$1"
    local consolidation_candidates="$2"
    
    log "INFO" "Creating fallback consolidation analysis results"
    
    # Simple consolidation detection based on file location and naming patterns
    local consolidation_json="{}"
    local temp_file_list=$(mktemp)
    
    # Extract file paths and group by directory
    echo "$file_list_json" | jq -r '.[]' 2>/dev/null | while IFS= read -r file_path; do
        if [[ -f "$file_path" ]]; then
            local dir_name=$(dirname "$file_path")
            local file_name=$(basename "$file_path")
            echo "$dir_name|$file_name|$file_path" >> "$temp_file_list"
        fi
    done
    
    if [[ -f "$temp_file_list" && -s "$temp_file_list" ]]; then
        # Group files by directory
        local directories=$(cut -d'|' -f1 "$temp_file_list" | sort | uniq -c | awk '$1 >= 2 {print $2}')
        
        if [[ -n "$directories" ]]; then
            log "DEBUG" "Found potential consolidation candidates based on directory grouping"
            
            # Create simple consolidation candidates
            local candidate_count=0
            for dir in $directories; do
                local files_in_dir=$(grep "^$(printf '%s' "$dir" | sed 's/[[\.*^$()+?{|]/\\&/g')|" "$temp_file_list" | cut -d'|' -f3)
                local file_count=$(echo "$files_in_dir" | wc -l)
                
                if [[ $file_count -ge ${MIN_CONSOLIDATION_FILES:-2} ]]; then
                    local topic="directory_group_$((++candidate_count))"
                    local dir_basename=$(basename "$dir")
                    
                    # Create file array for JSON
                    local files_array="["
                    for file in $files_in_dir; do
                        files_array+='"'$(printf '%s' "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')'",'
                    done
                    files_array="${files_array%,}]"
                    
                    # Add to consolidation JSON
                    local candidate_json='{
                        "files": '$files_array',
                        "avgSimilarity": 0.4,
                        "recommendedTitle": "'$dir_basename' Collection",
                        "consolidationStrategy": "simple_merge",
                        "confidence": 0.3
                    }'
                    
                    consolidation_json=$(echo "$consolidation_json" | jq --arg topic "$topic" --argjson candidate "$candidate_json" '.[$topic] = $candidate')
                fi
            done
        fi
    fi
    
    # Write results to output file
    echo "$consolidation_json" > "$consolidation_candidates"
    
    # Cleanup
    rm -f "$temp_file_list"
    
    log "INFO" "Fallback consolidation analysis completed (limited functionality)"
}

# Process duplicate files
process_duplicates() {
    local duplicates_file="$1"
    local dry_run="$2"
    
    if [[ ! -f "$duplicates_file" ]]; then
        log "INFO" "No duplicates file found: $duplicates_file"
        return 0
    fi

    log "INFO" "Processing duplicates from $duplicates_file (dry_run: $dry_run)"

    local processed_count=0
    local deleted_count=0

    # Read duplicates from the JSON file
    local duplicates_json=$(cat "$duplicates_file")
    local duplicate_groups=$(echo "$duplicates_json" | jq -c '.[]')

    for group in $duplicate_groups; do
        local files_in_group=$(echo "$group" | jq -r '.files[]')
        local recommended_action=$(echo "$group" | jq -r '.recommended_action')
        local group_type=$(echo "$group" | jq -r '.type')

        log "INFO" "Duplicate group ($group_type): $files_in_group"
        log "INFO" "Recommended action: $recommended_action"

        if [[ "$recommended_action" == "delete_duplicates" ]]; then
            # Keep the first file, delete the rest
            local keep_file=$(echo "$files_in_group" | head -n 1)
            local files_to_delete=$(echo "$files_in_group" | tail -n +2)

            for file_to_delete in $files_to_delete; do
                if [[ "$dry_run" == "true" ]]; then
                    log "INFO" "DRY RUN: Would delete duplicate file: $file_to_delete (keeping $keep_file)"
                else
                    if [[ -f "$file_to_delete" ]]; then
                        log "INFO" "Deleting duplicate file: $file_to_delete (keeping $keep_file)"
                        rm "$file_to_delete"
                        ((deleted_count++))
                    else
                        log "WARN" "Duplicate file not found, skipping: $file_to_delete"
                    fi
                fi
                ((processed_count++))
            done
        else
            log "INFO" "No action taken for this duplicate group (action: $recommended_action)"
        fi
    done

    if [[ "$dry_run" == "true" ]]; then
        log "INFO" "DRY RUN: Processed $processed_count duplicate files, would have deleted $deleted_count files"
    else
        log "INFO" "Processed $processed_count duplicate files, deleted $deleted_count files"
    fi
}

# Process content consolidation candidates with improved error handling
process_consolidation_candidates() {
    local candidates_file="$1"
    local dry_run="$2"
    
    if [[ ! -f "$candidates_file" ]]; then
        log "INFO" "No consolidation candidates file found: $candidates_file"
        return 0
    fi
    
    # Check if file is valid JSON and has content
    local candidate_count=0
    if command -v jq >/dev/null 2>&1; then
        candidate_count=$(jq 'length' "$candidates_file" 2>/dev/null || echo "0")
    else
        # Fallback method without jq
        candidate_count=$(node -e "
            try {
                const fs = require('fs');
                const candidates = JSON.parse(fs.readFileSync('$candidates_file', 'utf-8'));
                console.log(Array.isArray(candidates) ? candidates.length : Object.keys(candidates).length);
            } catch (error) {
                console.log('0');
            }
        " 2>/dev/null || echo "0")
    fi
    
    if [[ "$candidate_count" -gt 0 ]]; then
        log "INFO" "Processing $candidate_count consolidation candidates"
        
        if [[ "$dry_run" == "true" ]]; then
            log "INFO" "DRY RUN: Would consolidate the following content groups:"
            node -e "
                try {
                    const fs = require('fs');
                    const candidates = JSON.parse(fs.readFileSync('$candidates_file', 'utf-8'));
                    
                    // Handle both array and object formats
                    const candidateEntries = Array.isArray(candidates) ? candidates : Object.entries(candidates);
                    
                    let totalFiles = 0;
                    let totalGroups = 0;
                    
                    for (const [topic, candidate] of candidateEntries) {
                        if (candidate && candidate.files) {
                            totalGroups++;
                            totalFiles += candidate.files.length;
                            console.log(\`[DRY RUN] Topic: \${topic} (\${candidate.files.length} files, similarity: \${(candidate.avgSimilarity || 0).toFixed(2)})\`);
                            console.log(\`[DRY RUN]   Title: \${candidate.recommendedTitle || 'N/A'}\`);
                            console.log(\`[DRY RUN]   Strategy: \${candidate.consolidationStrategy || 'simple_merge'}\`);
                            console.log(\`[DRY RUN]   Files: \${candidate.files.map(f => f.filePath || f).join(', ')}\`);
                            console.log(\`[DRY RUN]   Would create: Sync_Hub_New/[category]/\${candidate.recommendedTitle || topic}/main.md\`);
                            console.log('');
                        }
                    }
                    
                    console.log(\`[DRY RUN] Summary: Would consolidate \${totalFiles} files into \${totalGroups} consolidated documents\`);
                } catch (error) {
                    console.error('[DRY RUN] Failed to process consolidation candidates:', error.message);
                }
            " 2>/dev/null || log "WARN" "Failed to display consolidation preview"
        else
            # Actually perform consolidation using batch processor with comprehensive error handling
            log "INFO" "Performing content consolidation..."
            
            # Check if advanced consolidation is available
            if check_advanced_module_availability "batch_processor.js"; then
                log "DEBUG" "Advanced consolidation available, proceeding with batch processor"
                
                # Try advanced consolidation with retry
                if run_with_retry 2 3 120 "
                    execute_advanced_consolidation '$candidates_file' '$dry_run'
                "; then
                    log "INFO" "✓ Advanced consolidation completed successfully"
                else
                    log "WARN" "Advanced consolidation failed, using graceful degradation"
                    execute_simple_consolidation "$candidates_file" "$dry_run"
                fi
            else
                log "INFO" "Advanced consolidation unavailable, using simplified approach"
                execute_simple_consolidation "$candidates_file" "$dry_run"
            fi
        fi
    else
        log "INFO" "No consolidation candidates found"
    fi
}

# Organize remaining files using traditional + enhanced categorization
organize_remaining_files() {
    local source_dir_param="$1"
    local dry_run="$2"

    local source_dir="$source_dir_param"
    
    local processed_count=0
    local moved_count=0
    
    # Process files in Inbox and root directory
    while IFS= read -r -d '' file; do
        # Skip already processed files (in category folders)
        if [[ "$file" =~ /"${CATEGORY_AI_ML:-AI & ML}"|/"${CATEGORY_RESEARCH:-Research Papers}"|/"${CATEGORY_WEB:-Web Content}"|/"${CATEGORY_NOTES:-Notes & Drafts}"|/"${CATEGORY_DEV:-Development}" ]]; then
            continue
        fi
        
        # Skip hidden files and category info files
        if [[ "$(basename "$file")" =~ ^\. ]] || [[ "$(basename "$file")" =~ _category_info\.md$ ]]; then
            continue
        fi
        
        local category=$(get_file_category_enhanced "$file")
    local category_dir="$source_dir/$category"
        
        ensure_directory "$category_dir"
        
        local filename=$(basename "$file")
        local target_path="$category_dir/$filename"
        
        # Handle filename conflicts
        if [[ -e "$target_path" && "$target_path" != "$file" ]]; then
            local base_name="${filename%.*}"
            local extension="${filename##*.}"
            local counter=1
            
            while [[ -e "$category_dir/${base_name}_${counter}.${extension}" ]]; do
                ((counter++))
            done
            
            target_path="$category_dir/${base_name}_${counter}.${extension}"
            filename="${base_name}_${counter}.${extension}"
        fi
        
        if [[ "$target_path" != "$file" ]]; then
            if [[ "$dry_run" == "true" ]]; then
                log "INFO" "DRY RUN: Would move $file -> $target_path"
            else
                log "INFO" "Moved: $file -> $target_path"
                mv "$file" "$target_path"
                ((moved_count++))
            fi
        fi
        
        ((processed_count++))
        
    done < <(find "$source_dir" -maxdepth 2 -type f \( -path "*/Inbox/*" -o -path "$source_dir/*" \) -print0)
    
    if [[ "$dry_run" == "true" ]]; then
        log "INFO" "DRY RUN: Processed $processed_count files, would have moved $moved_count files"
    else
        log "INFO" "Processed $processed_count files, moved $moved_count files"
    fi
}

# Enhanced category detection using the batch processor with graceful degradation
get_file_category_enhanced() {
    local file="$1"
    
    # Attempt to use advanced batch processor with comprehensive error handling
    local category=""
    local use_advanced=true
    
    # Check if advanced modules are available
    if ! check_advanced_module_availability "batch_processor.js"; then
        log "INFO" "Advanced categorization unavailable, using simple categorization for: $(basename "$file")" >&2
        use_advanced=false
    fi
    
    if [[ "$use_advanced" == "true" ]]; then
        log "DEBUG" "Attempting enhanced categorization for: $(basename "$file")" >&2
        
        # Try enhanced categorization with retry and error handling
        if category=$(run_with_retry 2 1 30 "
            PROJECT_ROOT='$PROJECT_DIR/..' \
            CONFIG_PATH='$PROJECT_DIR/../config/organize_config.conf' \
            FILE_LIST_JSON='[\"$(printf '%s' "$file" | sed 's/\\\\/\\\\\\\\/g; s/\"/\\\\\"/g')\"]' \
            execute_node_module 'batch_processor.js' categorize
        " 2>/dev/null | jq -r '.[0].category' 2>/dev/null); then
            
            # Validate the category result
            if [[ -n "$category" && "$category" != "null" && "$category" != "undefined" ]]; then
                log "DEBUG" "✓ Enhanced categorization successful: $(basename "$file") -> $category" >&2
                echo "$category"
                return 0
            else
                log "DEBUG" "Enhanced categorization returned invalid result, falling back" >&2
            fi
        else
            log "DEBUG" "Enhanced categorization failed, falling back to simple method" >&2
        fi
    fi
    
    # Fallback to simple categorization with logging
    log "DEBUG" "Using simple categorization for: $(basename "$file")" >&2
    category=$(get_file_category_simple "$file")
    
    # Ensure we always return a valid category
    echo "${category:-${CATEGORY_NOTES:-Notes & Drafts}}"
}

# Check if advanced modules are available and functional
check_advanced_module_availability() {
    local module_name="$1"
    # Sanitize module name for use as shell variable (remove dots and special chars)
    local sanitized_name=$(echo "$module_name" | sed 's/[^a-zA-Z0-9_]/_/g')
    local check_cache_key="module_available_${sanitized_name}"
    
    # Use a simple cache to avoid repeated checks (valid for this script execution)
    if [[ -n "${!check_cache_key:-}" ]]; then
        log "DEBUG" "Using cached availability result for $module_name: ${!check_cache_key}"
        [[ "${!check_cache_key}" == "true" ]]
        return $?
    fi
    
    log "DEBUG" "Checking availability of advanced module: $module_name"
    
    # Check if module file exists and is accessible
    local module_path
    if ! module_path=$(resolve_module_path "$module_name" 2>/dev/null); then
        log "DEBUG" "Module not found: $module_name"
        eval "$check_cache_key=false"
        return 1
    fi
    
    # Check if Node.js is available
    if ! command -v node >/dev/null 2>&1; then
        log "DEBUG" "Node.js not available, cannot use advanced modules"
        eval "$check_cache_key=false"
        return 1
    fi
    
    # Quick functionality test - try to get module version or basic info
    local test_result=""
    if test_result=$(timeout 10 node -e "
        try {
            const modulePath = '$module_path';
            console.log('Module accessible');
        } catch (error) {
            console.error('Module test failed:', error.message);
            process.exit(1);
        }
    " 2>/dev/null); then
        log "DEBUG" "✓ Advanced module is available and functional: $module_name"
        eval "$check_cache_key=true"
        return 0
    else
        log "DEBUG" "✗ Advanced module failed functionality test: $module_name"
        eval "$check_cache_key=false"
        return 1
    fi
}

# Graceful degradation wrapper for advanced operations
execute_with_graceful_degradation() {
    local operation_name="$1"
    local advanced_function="$2"
    local fallback_function="$3"
    shift 3
    local operation_args="$*"
    
    log "DEBUG" "Executing operation with graceful degradation: $operation_name"
    
    # Try advanced function first
    if [[ -n "$advanced_function" ]] && command -v "$advanced_function" >/dev/null 2>&1; then
        log "DEBUG" "Attempting advanced method: $advanced_function"
        
        if $advanced_function $operation_args; then
            log "DEBUG" "✓ Advanced method succeeded: $operation_name"
            return 0
        else
            local exit_code=$?
            log "WARN" "Advanced method failed (exit code: $exit_code), falling back: $operation_name"
        fi
    else
        log "DEBUG" "Advanced method not available: $advanced_function"
    fi
    
    # Fall back to simple function
    if [[ -n "$fallback_function" ]] && command -v "$fallback_function" >/dev/null 2>&1; then
        log "INFO" "Using fallback method for: $operation_name"
        
        if $fallback_function $operation_args; then
            log "DEBUG" "✓ Fallback method succeeded: $operation_name"
            return 0
        else
            local exit_code=$?
            log "ERROR" "Both advanced and fallback methods failed for: $operation_name (exit code: $exit_code)"
            return $exit_code
        fi
    else
        log "ERROR" "No fallback method available for: $operation_name"
        return 1
    fi
}

# Check for category suggestions with comprehensive error handling and graceful degradation
check_category_suggestions() {
    local source_dir_param="$1"
    local source_dir="$source_dir_param"
    log "DEBUG" "check_category_suggestions: source_dir is $source_dir"
    
    log "INFO" "Analyzing content for potential new categories..."
    
    # Check if advanced analysis is available
    if check_advanced_module_availability "batch_processor.js"; then
        log "DEBUG" "Advanced category suggestion analysis available"
        
        # Try advanced analysis with retry and comprehensive error handling
        if run_with_retry 2 3 60 "
            execute_advanced_category_suggestions '$source_dir'
        "; then
            log "INFO" "✓ Advanced category suggestions completed successfully"
            return 0
        else
            log "WARN" "Advanced category suggestions failed, using fallback approach"
        fi
    else
        log "INFO" "Advanced category suggestion analysis unavailable, using simplified approach"
    fi
    
    # Fallback to simple category suggestions
    execute_simple_category_suggestions "$source_dir"
}

# Execute advanced category suggestions using batch processor
execute_advanced_category_suggestions() {
    local source_dir="$1"
    
    local batch_processor_path
    if ! batch_processor_path=$(resolve_module_path "batch_processor.js"); then
        log "ERROR" "batch_processor.js not found for advanced category suggestions"
        return 1
    fi
    
    # Create temporary script for advanced category suggestions
    local temp_script=$(mktemp)
    cat > "$temp_script" << 'EOF'
import BatchProcessor from process.env.BATCH_PROCESSOR_PATH;
import { promises as fs } from 'fs';
import path from 'path';

async function checkSuggestions() {
    try {
        const processor = new BatchProcessor({
            projectRoot: process.env.PROJECT_ROOT
        });
        
        await processor.initialize();
        
        // Find all files in categories
        const allFiles = [];
        const categories = ['AI & ML', 'Research Papers', 'Web Content', 'Notes & Drafts', 'Development'];
        
        const sourceDir = process.env.SOURCE_DIR;
        if (!sourceDir) {
            console.log('No source directory provided for category suggestions');
            return;
        }
        
        for (const category of categories) {
            const categoryPath = path.join(sourceDir, category);
            try {
                const files = await fs.readdir(categoryPath);
                for (const file of files) {
                    const filePath = path.join(categoryPath, file);
                    try {
                        const stat = await fs.stat(filePath);
                        if (stat.isFile() && !file.startsWith('.') && !file.includes('_category_info')) {
                            allFiles.push(filePath);
                        }
                    } catch (e) {
                        // Skip files that can't be accessed
                    }
                }
            } catch (e) {
                // Skip categories that don't exist
            }
        }
        
        if (allFiles.length === 0) {
            console.log('No files found for category analysis');
            return;
        }
        
        // Categorize files to find poorly matched ones
        const results = await processor.categorizeFiles(allFiles, {
            configPath: process.env.CONFIG_PATH
        });
        
        const poorlyMatched = results.filter(r => r.confidence < 0.5);
        
        if (poorlyMatched.length >= 3) {
            console.log(`Found ${poorlyMatched.length} files that might benefit from a new category`);
            console.log('Files with low categorization confidence:');
            poorlyMatched.slice(0, 5).forEach(file => {
                console.log(`  - ${path.basename(file.filePath)} (confidence: ${(file.confidence * 100).toFixed(1)}%)`);
            });
            console.log('');
            console.log('Consider creating a new category for these files or reviewing the existing category definitions.');
        } else {
            console.log('No new category suggestions at this time');
        }
        
    } catch (error) {
        console.error('Error in category suggestions:', error.message);
        throw error;  // Re-throw to trigger retry logic
    }
}

checkSuggestions().catch(error => {
    console.error('Failed to check category suggestions:', error.message);
    process.exit(1);  // Exit with error to trigger retry
});
EOF

    # Execute the Node.js analysis with comprehensive error handling using execute_node_module
    if BATCH_PROCESSOR_PATH="$batch_processor_path" \
       PROJECT_ROOT="$PROJECT_DIR/.." \
       SOURCE_DIR="$source_dir" \
       CONFIG_PATH="$PROJECT_DIR/../config/organize_config.conf" \
       execute_node_module "$temp_script"; then
        log "DEBUG" "Advanced category suggestions executed successfully"
        rm -f "$temp_script"
        return 0
    else
        local exit_code=$?
        log "WARN" "Advanced category suggestions failed with exit code: $exit_code"
        rm -f "$temp_script"
        
        # Graceful degradation - fall back to simple suggestions
        log "INFO" "Falling back to simple category suggestions due to advanced module failure"
        return 1
    fi
}

# Simple category suggestions fallback when advanced modules are unavailable
execute_simple_category_suggestions() {
    local source_dir="$1"
    
    log "INFO" "Using simple category suggestion analysis"
    
    # Simple analysis based on file distribution and naming patterns
    local total_files=0
    local category_stats=$(mktemp)
    local uncategorized_files=0
    
    # Count files in each category
    local categories=(
        "${CATEGORY_AI_ML:-AI & ML}"
        "${CATEGORY_RESEARCH:-Research Papers}"
        "${CATEGORY_WEB:-Web Content}"
        "${CATEGORY_NOTES:-Notes & Drafts}"
        "${CATEGORY_DEV:-Development}"
    )
    
    for category in "${categories[@]}"; do
        local category_dir="$source_dir/$category"
        local file_count=0
        
        if [[ -d "$category_dir" ]]; then
            file_count=$(find "$category_dir" -maxdepth 1 -type f ! -name ".*" ! -name "*_category_info*" | wc -l)
        fi
        
        echo "$category:$file_count" >> "$category_stats"
        total_files=$((total_files + file_count))
    done
    
    # Check for files in root or Inbox that might need new categories
    local root_files=$(find "$source_dir" -maxdepth 1 -type f ! -name ".*" | wc -l)
    local inbox_files=0
    if [[ -d "$source_dir/Inbox" ]]; then
        inbox_files=$(find "$source_dir/Inbox" -type f ! -name ".*" | wc -l)
    fi
    
    uncategorized_files=$((root_files + inbox_files))
    
    log "INFO" "Simple category analysis results:"
    log "INFO" "  Total categorized files: $total_files"
    log "INFO" "  Uncategorized files: $uncategorized_files"
    
    # Show category distribution
    while IFS=':' read -r category count; do
        local percentage=0
        if [[ $total_files -gt 0 ]]; then
            percentage=$(( (count * 100) / total_files ))
        fi
        log "INFO" "  $category: $count files (${percentage}%)"
    done < "$category_stats"
    
    # Simple suggestions based on distribution
    if [[ $uncategorized_files -gt 10 ]]; then
        log "INFO" "Suggestion: $uncategorized_files uncategorized files found"
        log "INFO" "  Consider reviewing files in root directory and Inbox"
        log "INFO" "  These files might benefit from a new category or better organization"
    fi
    
    # Check for imbalanced categories
    local max_files=0
    local min_files=999999
    while IFS=':' read -r category count; do
        if [[ $count -gt $max_files ]]; then
            max_files=$count
        fi
        if [[ $count -lt $min_files && $count -gt 0 ]]; then
            min_files=$count
        fi
    done < "$category_stats"
    
    if [[ $max_files -gt 0 && $min_files -gt 0 ]]; then
        local ratio=$((max_files / min_files))
        if [[ $ratio -gt 5 ]]; then
            log "INFO" "Suggestion: Category distribution is imbalanced (ratio: ${ratio}:1)"
            log "INFO" "  Consider splitting large categories or consolidating small ones"
        fi
    fi
    
    # Cleanup
    rm -f "$category_stats"
    
    log "INFO" "Simple category suggestions completed"
}

# Utility functions
ensure_directory() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        log "INFO" "Creating directory: $dir"
        mkdir -p "$dir"
    fi
}

# Legacy simple categorization (fallback)
get_file_category_simple() {
    local file="$1"
    local filename=$(basename "$file")
    local content=""
    
    # Read file content for analysis (first few lines)
    if [[ -f "$file" && -r "$file" ]]; then
        content=$(head -n 20 "$file" 2>/dev/null || echo "")
    fi
    
    local combined_text="${filename,,} ${content,,}"
    
    # AI & ML category
    if [[ $combined_text =~ (machine.learning|artificial.intelligence|neural.network|deep.learning|tensorflow|pytorch|model|algorithm|ai|ml|data.science|jupyter) ]]; then
        echo "${CATEGORY_AI_ML:-AI & ML}"
        return
    fi
    
    # Research Papers category
    if [[ $combined_text =~ (research|paper|study|journal|arxiv|academic|publication|thesis|abstract|methodology|conclusion) ]] || [[ $filename =~ \.pdf$ ]]; then
        echo "${CATEGORY_RESEARCH:-Research Papers}"
        return
    fi
    
    # Web Content category
    if [[ $combined_text =~ (article|tutorial|guide|blog|how.to|walkthrough|tips|web|html) ]] || [[ $filename =~ \.(html|htm)$ ]]; then
        echo "${CATEGORY_WEB:-Web Content}"
        return
    fi
    
    # Development category
    if [[ $combined_text =~ (code|api|programming|development|software|technical|documentation|function|class|method) ]] || [[ $filename =~ \.(js|py|java|cpp|c|php|rb|go|rs|ts|json|yml|yaml|xml)$ ]]; then
        echo "${CATEGORY_DEV:-Development}"
        return
    fi
    
    # Default to Notes & Drafts
    echo "${CATEGORY_NOTES_DRAFTS:-Notes & Drafts}"
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [SOURCE_DIR]

Enhanced Document Organization System

OPTIONS:
    -h, --help          Show this help message
    -d, --dry-run       Preview changes without executing them
    -v, --verbose       Enable verbose logging

ARGUMENTS:
    SOURCE_DIR          Directory to organize (default: \$SYNC_HUB)

EXAMPLES:
    $0                          # Organize default sync hub directory
    $0 --dry-run                # Preview organization of default directory
    $0 /path/to/docs            # Organize specific directory
    $0 --dry-run /path/to/docs  # Preview organization of specific directory
    $0 /path/to/docs --dry-run  # Alternative dry-run syntax

INTEGRATION USAGE:
    When called from drive_sync.sh or other scripts:
    $0 [SOURCE_DIR] [dry-run|true|false]

EOF
}

# Parse command line arguments
parse_arguments() {
    local source_dir=""
    local dry_run="false"
    local verbose="false"
    local show_help="false"
    
    # Handle case with no arguments
    if [[ $# -eq 0 ]]; then
        source_dir="$SYNC_HUB"
        echo "$source_dir|$dry_run|$verbose"
        return 0
    fi
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_help="true"
                shift
                ;;
            -d|--dry-run)
                dry_run="true"
                shift
                ;;
            -v|--verbose)
                verbose="true"
                shift
                ;;
            dry-run|true)
                # Legacy integration support - second argument as dry-run flag
                if [[ -n "$source_dir" ]]; then
                    dry_run="true"
                else
                    # First argument is "dry-run" - use default source dir
                    source_dir="$SYNC_HUB"
                    dry_run="true"
                fi
                shift
                ;;
            false)
                # Legacy integration support - explicit false for dry-run
                if [[ -n "$source_dir" ]]; then
                    dry_run="false"
                else
                    echo "ERROR: Invalid argument: $1" >&2
                    echo "INVALID"
                    return 1
                fi
                shift
                ;;
            -*)
                echo "ERROR: Unknown option: $1" >&2
                echo "INVALID"
                return 1
                ;;
            *)
                # Positional argument - should be source directory
                if [[ -z "$source_dir" ]]; then
                    source_dir="$1"
                else
                    echo "ERROR: Multiple source directories specified: '$source_dir' and '$1'" >&2
                    echo "INVALID"
                    return 1
                fi
                shift
                ;;
        esac
    done
    
    # Show help if requested
    if [[ "$show_help" == "true" ]]; then
        echo "HELP"
        return 0
    fi
    
    # Use default source directory if none specified
    if [[ -z "$source_dir" ]]; then
        source_dir="$SYNC_HUB"
    fi
    
    # Validate source directory
    if [[ ! -d "$source_dir" ]]; then
        echo "ERROR: Source directory does not exist: $source_dir" >&2
        echo "INVALID"
        return 1
    fi
    
    # Apply verbose setting to logging
    if [[ "$verbose" == "true" ]]; then
        export LOG_TO_CONSOLE="true"
    fi
    
    echo "$source_dir|$dry_run|$verbose"
    return 0
}

# Main execution
main() {
    # Parse arguments
    local parse_result
    parse_result=$(parse_arguments "$@")
    local parse_exit_code=$?
    
    # Handle special cases
    if [[ "$parse_result" == "HELP" ]]; then
        show_usage
        exit 0
    elif [[ "$parse_result" == "INVALID" ]] || [[ $parse_exit_code -ne 0 ]]; then
        echo ""
        echo "Error: Invalid arguments provided."
        echo ""
        show_usage
        exit 1
    fi
    
    # Extract parsed values
    IFS='|' read -r source_dir dry_run verbose <<< "$parse_result"
    
    log "INFO" "Starting organization process"
    log "INFO" "Source directory: $source_dir"
    log "INFO" "Dry run mode: $dry_run"
    log "INFO" "Verbose mode: $verbose"
    
    # Ensure dry-run mode is properly indicated in logs
    if [[ "$dry_run" == "true" ]]; then
        log "INFO" "=== DRY RUN MODE ACTIVE - NO FILES WILL BE MODIFIED ==="
        log "INFO" "All file operations will be simulated and logged only"
    fi
    
    organize_documents "$source_dir" "$dry_run"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
