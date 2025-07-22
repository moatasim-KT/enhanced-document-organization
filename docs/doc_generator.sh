#!/bin/bash

# ============================================================================
# DOCUMENTATION GENERATION TOOL
# ============================================================================
# This script extracts function documentation from source files and generates
# markdown documentation for modules, functions, and configuration options.
#
# @file          doc_generator.sh
# @description   Extracts documentation from source files and generates markdown docs
# @version       1.0.0
#
# USAGE:
#   ./doc_generator.sh extract <source_file> [--output <output_file>]
#   ./doc_generator.sh generate-module <source_file> [--output <output_file>]
#   ./doc_generator.sh generate-examples <source_file> [--output <output_file>]
#   ./doc_generator.sh generate-config <source_file> [--output <output_file>]
#
# ============================================================================

set -euo pipefail

# Directory and path configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$SCRIPT_DIR/generated"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Logs a message to console
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Shows usage information
show_usage() {
    cat << EOF
Documentation Generator Tool

Usage:
  $(basename "$0") extract <source_file> [--output <output_file>]
    Extract function documentation from source file

  $(basename "$0") generate-module <source_file> [--output <output_file>]
    Generate comprehensive module documentation

  $(basename "$0") generate-examples <source_file> [--output <output_file>]
    Extract and format usage examples from source file

  $(basename "$0") generate-config <source_file> [--output <output_file>]
    Generate configuration documentation from source file

Options:
  --output <file>    Specify output file (default: auto-generated based on source)

Examples:
  $(basename "$0") extract ../sync/sync_module.sh
  $(basename "$0") generate-module ../organize/organize_module.sh --output organize_module_docs.md
  $(basename "$0") generate-examples ../sync/sync_module.sh
  $(basename "$0") generate-config ../organize/organize_module.sh
EOF
}

# ============================================================================
# DOCUMENTATION EXTRACTION FUNCTIONS
# ============================================================================

# Extract JSDoc-style function documentation from source file
extract_function_docs() {
    local source_file="$1"
    local output_file="${2:-}"
    
    if [[ -z "$output_file" ]]; then
        local base_name=$(basename "$source_file" .sh)
        output_file="$OUTPUT_DIR/${base_name}_functions.md"
    fi
    
    log "Extracting function documentation from $source_file"
    log "Output will be written to $output_file"
    
    # Create header for the documentation file
    cat > "$output_file" << EOF
# Function Documentation: $(basename "$source_file")

This document contains automatically extracted documentation for functions in \`$(basename "$source_file")\`.

## Table of Contents

EOF
    
    # First pass: Extract function names for table of contents
    local function_names=()
    while IFS= read -r line; do
        # Match function declarations
        if [[ "$line" =~ ^([a-zA-Z0-9_]+)\(\)\ *\{ ]]; then
            function_names+=("${BASH_REMATCH[1]}")
            echo "- [${BASH_REMATCH[1]}](#${BASH_REMATCH[1]})" >> "$output_file"
        fi
    done < "$source_file"
    
    echo -e "\n## Functions\n" >> "$output_file"
    
    # Second pass: Extract documentation blocks and function implementations
    local in_doc_block=false
    local current_doc=""
    local current_function=""
    local line_number=0
    
    while IFS= read -r line; do
        ((line_number++))
        
        # Start of JSDoc-style comment block
        if [[ "$line" =~ ^/\*\* ]]; then
            in_doc_block=true
            current_doc="$line"
            continue
        fi
        
        # Inside doc block
        if [[ "$in_doc_block" == true ]]; then
            current_doc+=$'\n'"$line"
            
            # End of doc block
            if [[ "$line" =~ \*/ ]]; then
                in_doc_block=false
                continue
            fi
        elif [[ "$line" =~ ^([a-zA-Z0-9_]+)\(\)\ *\{ ]]; then
            # Function declaration found
            current_function="${BASH_REMATCH[1]}"
            
            # Extract function implementation (first 10 lines or until next function)
            local implementation=""
            local impl_line_count=0
            local temp_line_number=$line_number
            local temp_line=""
            
            implementation="$line"
            
            while IFS= read -r temp_line && [[ $impl_line_count -lt 10 ]]; do
                ((temp_line_number++))
                ((impl_line_count++))
                
                # Stop if we hit another function declaration
                if [[ "$temp_line" =~ ^[a-zA-Z0-9_]+\(\)\ *\{ ]]; then
                    break
                fi
                
                implementation+=$'\n'"$temp_line"
                
                # Stop at the end of function
                if [[ "$temp_line" =~ ^} ]]; then
                    break
                fi
            done < <(tail -n +$temp_line_number "$source_file")
            
            # Format the documentation
            echo -e "### $current_function\n" >> "$output_file"
            
            # Process JSDoc-style comments
            if [[ -n "$current_doc" ]]; then
                # Extract description
                local description=$(echo "$current_doc" | grep -v "@" | sed -e 's/\/\*\*//g' -e 's/\*\///g' -e 's/^\s*\*\s*//g' | sed '/^$/d')
                echo -e "$description\n" >> "$output_file"
                
                # Extract parameters
                if echo "$current_doc" | grep -q "@param"; then
                    echo -e "**Parameters:**\n" >> "$output_file"
                    while IFS= read -r param_line; do
                        if [[ "$param_line" =~ @param[[:space:]]+\{([^}]+)\}[[:space:]]+([^[:space:]]+)[[:space:]]+(.*) ]]; then
                            local param_type="${BASH_REMATCH[1]}"
                            local param_name="${BASH_REMATCH[2]}"
                            local param_desc="${BASH_REMATCH[3]}"
                            echo "- \`$param_name\` ($param_type): $param_desc" >> "$output_file"
                        fi
                    done < <(echo "$current_doc" | grep "@param")
                    echo "" >> "$output_file"
                fi
                
                # Extract return value
                if echo "$current_doc" | grep -q "@return"; then
                    echo -e "**Returns:**\n" >> "$output_file"
                    while IFS= read -r return_line; do
                        if [[ "$return_line" =~ @return[[:space:]]+\{([^}]+)\}[[:space:]]+(.*) ]]; then
                            local return_type="${BASH_REMATCH[1]}"
                            local return_desc="${BASH_REMATCH[2]}"
                            echo "- $return_type: $return_desc" >> "$output_file"
                        fi
                    done < <(echo "$current_doc" | grep "@return")
                    echo "" >> "$output_file"
                fi
                
                # Extract examples
                if echo "$current_doc" | grep -q "@example"; then
                    echo -e "**Example:**\n" >> "$output_file"
                    local in_example=false
                    local example_text=""
                    
                    while IFS= read -r example_line; do
                        if [[ "$example_line" =~ @example ]]; then
                            in_example=true
                            continue
                        elif [[ "$in_example" == true ]]; then
                            # Skip comment markers and whitespace
                            example_line=$(echo "$example_line" | sed -e 's/^\s*\*\s*//g')
                            if [[ -n "$example_line" ]]; then
                                example_text+="$example_line"$'\n'
                            fi
                        fi
                    done < <(echo "$current_doc" | sed -n '/\@example/,/\*\//p')
                    
                    echo '```bash' >> "$output_file"
                    echo -e "$example_text" >> "$output_file"
                    echo '```' >> "$output_file"
                    echo "" >> "$output_file"
                fi
            fi
            
            # Add function implementation
            echo -e "**Implementation:**\n" >> "$output_file"
            echo '```bash' >> "$output_file"
            echo -e "$implementation" >> "$output_file"
            if [[ $impl_line_count -eq 10 ]]; then
                echo "# ... (truncated for brevity)" >> "$output_file"
            fi
            echo '```' >> "$output_file"
            echo -e "\n---\n" >> "$output_file"
            
            # Reset for next function
            current_doc=""
        fi
    done < "$source_file"
    
    log "Documentation extraction complete: $output_file"
    return 0
}

# Generate comprehensive module documentation
generate_module_docs() {
    local source_file="$1"
    local output_file="${2:-}"
    
    if [[ -z "$output_file" ]]; then
        local base_name=$(basename "$source_file" .sh)
        output_file="$OUTPUT_DIR/${base_name}_module.md"
    fi
    
    log "Generating module documentation for $source_file"
    log "Output will be written to $output_file"
    
    # Extract module header information
    local module_name=$(basename "$source_file" .sh)
    local module_description=""
    local module_version=""
    local module_author=""
    
    # Read the first 50 lines to extract header information
    head -n 50 "$source_file" | while IFS= read -r line; do
        if [[ "$line" =~ @description[[:space:]]+(.*) ]]; then
            module_description="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ @version[[:space:]]+(.*) ]]; then
            module_version="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ @author[[:space:]]+(.*) ]]; then
            module_author="${BASH_REMATCH[1]}"
        fi
    done
    
    # Create header for the documentation file
    cat > "$output_file" << EOF
# $(tr '[:lower:]' '[:upper:]' <<< ${module_name:0:1})${module_name:1} Module Documentation

**Version:** ${module_version:-Unknown}  
**Author:** ${module_author:-Unknown}

${module_description:-No description available.}

## Overview

This document provides comprehensive documentation for the \`$module_name\` module.

EOF
    
    # Extract usage information
    local usage_section=$(sed -n '/^# USAGE:/,/^#$/p' "$source_file" | sed -e 's/^# USAGE://g' -e 's/^#//g' | sed '/^$/d')
    
    if [[ -n "$usage_section" ]]; then
        echo -e "## Usage\n" >> "$output_file"
        echo '```bash' >> "$output_file"
        echo "$usage_section" >> "$output_file"
        echo '```' >> "$output_file"
        echo "" >> "$output_file"
    fi
    
    # Extract configuration information
    local config_section=$(sed -n '/^# CONFIGURATION:/,/^#$/p' "$source_file" | sed -e 's/^# CONFIGURATION://g' -e 's/^#//g' | sed '/^$/d')
    
    if [[ -n "$config_section" ]]; then
        echo -e "## Configuration\n" >> "$output_file"
        echo "$config_section" >> "$output_file"
        echo "" >> "$output_file"
    fi
    
    # Extract function names and create a function index
    echo -e "## Functions\n" >> "$output_file"
    echo "The module provides the following functions:\n" >> "$output_file"
    
    local function_list=()
    while IFS= read -r line; do
        if [[ "$line" =~ ^([a-zA-Z0-9_]+)\(\)\ *\{ ]]; then
            function_list+=("${BASH_REMATCH[1]}")
        fi
    done < "$source_file"
    
    # Group functions by category based on section headers in the file
    local current_category=""
    local categories=()
    local category_functions=()
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^#\ +=+$ ]]; then
            # Skip the line with just equals signs
            continue
        elif [[ "$line" =~ ^#\ +([A-Z][A-Z0-9_\ ]+)$ ]]; then
            # Found a category header
            current_category="${BASH_REMATCH[1]}"
            categories+=("$current_category")
            category_functions+=("")
        elif [[ "$line" =~ ^([a-zA-Z0-9_]+)\(\)\ *\{ ]] && [[ -n "$current_category" ]]; then
            # Found a function in a category
            local func_name="${BASH_REMATCH[1]}"
            local cat_index=$((${#categories[@]} - 1))
            category_functions[$cat_index]+="$func_name "
        fi
    done < "$source_file"
    
    # Output functions by category
    for i in "${!categories[@]}"; do
        echo "### ${categories[$i]}" >> "$output_file"
        echo "" >> "$output_file"
        
        for func in ${category_functions[$i]}; do
            echo "- \`$func\`" >> "$output_file"
        done
        echo "" >> "$output_file"
    done
    
    # Add a link to the detailed function documentation
    echo -e "For detailed function documentation, see [Function Documentation]($(basename "$output_file" .md)_functions.md).\n" >> "$output_file"
    
    log "Module documentation generation complete: $output_file"
    return 0
}

# Extract and format usage examples from source file
generate_examples() {
    local source_file="$1"
    local output_file="${2:-}"
    
    if [[ -z "$output_file" ]]; then
        local base_name=$(basename "$source_file" .sh)
        output_file="$OUTPUT_DIR/${base_name}_examples.md"
    fi
    
    log "Generating usage examples for $source_file"
    log "Output will be written to $output_file"
    
    # Create header for the examples file
    cat > "$output_file" << EOF
# Usage Examples: $(basename "$source_file")

This document contains usage examples extracted from \`$(basename "$source_file")\`.

## Table of Contents

EOF
    
    # Extract module name for better formatting
    local module_name=$(basename "$source_file" .sh)
    
    # Categories for examples
    local categories=("Basic Usage" "Advanced Usage" "Troubleshooting" "Configuration Examples")
    
    # Add categories to table of contents
    for category in "${categories[@]}"; do
        echo "- [${category}](#${category//' '/'-'})" >> "$output_file"
    done
    
    # Extract examples from JSDoc comments
    echo -e "\n## Basic Usage\n" >> "$output_file"
    echo "These examples demonstrate the basic functionality of the module.\n" >> "$output_file"
    
    # Extract basic usage examples from the file header
    local usage_section=$(sed -n '/^# USAGE:/,/^#$/p' "$source_file" | sed -e 's/^# USAGE://g' -e 's/^#//g' | sed '/^$/d')
    
    if [[ -n "$usage_section" ]]; then
        echo '```bash' >> "$output_file"
        echo "$usage_section" >> "$output_file"
        echo '```' >> "$output_file"
        echo "" >> "$output_file"
    fi
    
    # Extract examples from function documentation
    local in_doc_block=false
    local current_doc=""
    local current_function=""
    local example_count=0
    
    while IFS= read -r line; do
        # Start of JSDoc-style comment block
        if [[ "$line" =~ ^/\*\* ]]; then
            in_doc_block=true
            current_doc="$line"
            continue
        fi
        
        # Inside doc block
        if [[ "$in_doc_block" == true ]]; then
            current_doc+=$'\n'"$line"
            
            # End of doc block
            if [[ "$line" =~ \*/ ]]; then
                in_doc_block=false
                
                # Extract function name from the next line
                read -r next_line
                if [[ "$next_line" =~ ^([a-zA-Z0-9_]+)\(\)\ *\{ ]]; then
                    current_function="${BASH_REMATCH[1]}"
                    
                    # Extract examples
                    if echo "$current_doc" | grep -q "@example"; then
                        ((example_count++))
                        
                        echo -e "### Example $example_count: Using \`$current_function\`\n" >> "$output_file"
                        
                        local in_example=false
                        local example_text=""
                        
                        while IFS= read -r example_line; do
                            if [[ "$example_line" =~ @example ]]; then
                                in_example=true
                                continue
                            elif [[ "$in_example" == true ]]; then
                                # Skip comment markers and whitespace
                                example_line=$(echo "$example_line" | sed -e 's/^\s*\*\s*//g')
                                if [[ -n "$example_line" ]]; then
                                    example_text+="$example_line"$'\n'
                                fi
                            fi
                        done < <(echo "$current_doc" | sed -n '/\@example/,/\*\//p')
                        
                        # Extract description
                        local description=$(echo "$current_doc" | grep -v "@" | sed -e 's/\/\*\*//g' -e 's/\*\///g' -e 's/^\s*\*\s*//g' | sed '/^$/d')
                        echo -e "$description\n" >> "$output_file"
                        
                        echo '```bash' >> "$output_file"
                        echo -e "$example_text" >> "$output_file"
                        echo '```' >> "$output_file"
                        echo -e "\n---\n" >> "$output_file"
                    fi
                fi
                
                current_doc=""
                continue
            fi
        fi
    done < "$source_file"
    
    # Add advanced usage section
    echo -e "\n## Advanced Usage\n" >> "$output_file"
    echo "These examples demonstrate more complex use cases and advanced features.\n" >> "$output_file"
    
    # Extract advanced examples from show_usage function if it exists
    local in_show_usage=false
    local show_usage_content=""
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^show_usage\(\)\ *\{ ]]; then
            in_show_usage=true
            continue
        fi
        
        if [[ "$in_show_usage" == true ]]; then
            if [[ "$line" =~ ^} ]]; then
                in_show_usage=false
                continue
            fi
            
            # Extract examples from the usage function
            if [[ "$line" =~ Examples: ]]; then
                while IFS= read -r example_line; do
                    if [[ "$example_line" =~ ^EOF ]]; then
                        break
                    fi
                    if [[ "$example_line" =~ \$\(basename ]]; then
                        # Replace $(basename "$0") with actual script name
                        example_line=$(echo "$example_line" | sed "s/\$(basename \"\$0\")/${module_name}.sh/g")
                    fi
                    show_usage_content+="$example_line"$'\n'
                done
            fi
        fi
    done < "$source_file"
    
    if [[ -n "$show_usage_content" ]]; then
        echo '```bash' >> "$output_file"
        echo -e "$show_usage_content" >> "$output_file"
        echo '```' >> "$output_file"
    else
        echo "No advanced usage examples found." >> "$output_file"
    fi
    
    # Add troubleshooting section
    echo -e "\n## Troubleshooting\n" >> "$output_file"
    echo "These examples demonstrate how to troubleshoot common issues.\n" >> "$output_file"
    
    # Look for error handling patterns in the code
    local error_handling_examples=""
    local error_count=0
    
    while IFS= read -r line; do
        if [[ "$line" =~ if\ \[\[.*\]\].*then.*log.*\".*Error.* || "$line" =~ if\ \[\[.*\]\].*then.*echo.*\".*Error.* ]]; then
            ((error_count++))
            error_handling_examples+="### Issue $error_count: "
            
            # Extract the error condition
            local error_condition=$(echo "$line" | sed -e 's/if \[\[\(.*\)\]\].*/\1/g')
            local error_message=$(echo "$line" | sed -e 's/.*log.*\"\(.*\)\".*/\1/g' -e 's/.*echo.*\"\(.*\)\".*/\1/g')
            
            if [[ -n "$error_message" && "$error_message" =~ Error ]]; then
                error_handling_examples+="$error_message"$'\n\n'
                error_handling_examples+="**Problem:** Condition \`$error_condition\` triggered an error."$'\n\n'
                error_handling_examples+="**Solution:** Ensure that the condition is not met by checking:"$'\n'
                
                # Suggest solutions based on the error condition
                if [[ "$error_condition" =~ -f || "$error_condition" =~ -d ]]; then
                    error_handling_examples+="- File or directory exists and has correct permissions"$'\n'
                elif [[ "$error_condition" =~ -z ]]; then
                    error_handling_examples+="- Required variable is not empty"$'\n'
                elif [[ "$error_condition" =~ == ]]; then
                    error_handling_examples+="- Value matches expected state"$'\n'
                fi
                
                error_handling_examples+=$'\n---\n\n'
            fi
        fi
    done < "$source_file"
    
    if [[ -n "$error_handling_examples" ]]; then
        echo -e "$error_handling_examples" >> "$output_file"
    else
        echo "No specific troubleshooting examples found." >> "$output_file"
    fi
    
    # Add configuration examples section
    echo -e "\n## Configuration Examples\n" >> "$output_file"
    echo "These examples demonstrate different configuration options.\n" >> "$output_file"
    
    # Extract configuration variables and their descriptions
    local config_vars=()
    local config_descriptions=()
    local in_config_section=false
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^#\ +CONFIGURATION\ +SETTINGS ]]; then
            in_config_section=true
            continue
        fi
        
        if [[ "$in_config_section" == true && "$line" =~ ^#\ +=+ ]]; then
            in_config_section=false
            continue
        fi
        
        if [[ "$in_config_section" == true && "$line" =~ ^([A-Z_]+)=(true|false|[0-9]+|\".*\") ]]; then
            config_vars+=("${BASH_REMATCH[1]}")
            
            # Look for description in previous lines
            local desc=""
            local prev_line=""
            local line_num=0
            while IFS= read -r prev_line && [[ $line_num -lt 5 ]]; do
                ((line_num++))
                if [[ "$prev_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                    break
                fi
            done < <(grep -B 5 "^${BASH_REMATCH[1]}=" "$source_file" | head -n 5)
            
            config_descriptions+=("$desc")
        fi
    done < "$source_file"
    
    if [[ ${#config_vars[@]} -gt 0 ]]; then
        echo "### Available Configuration Options\n" >> "$output_file"
        echo "The following configuration options can be set in \`config.env\` or directly in the script:\n" >> "$output_file"
        
        for i in "${!config_vars[@]}"; do
            echo "#### ${config_vars[$i]}\n" >> "$output_file"
            echo "${config_descriptions[$i]}\n" >> "$output_file"
            
            # Example of setting this configuration
            echo '```bash' >> "$output_file"
            echo "# In config.env or at the top of the script" >> "$output_file"
            echo "${config_vars[$i]}=true  # Enable this feature" >> "$output_file"
            echo "${config_vars[$i]}=false # Disable this feature" >> "$output_file"
            echo '```' >> "$output_file"
            echo "" >> "$output_file"
        done
    else
        echo "No specific configuration options found." >> "$output_file"
    fi
    
    log "Usage examples generation complete: $output_file"
    return 0
}

# Generate configuration documentation from source file
generate_config_docs() {
    local source_file="$1"
    local output_file="${2:-}"
    
    if [[ -z "$output_file" ]]; then
        local base_name=$(basename "$source_file" .sh)
        output_file="$OUTPUT_DIR/${base_name}_config.md"
    fi
    
    log "Generating configuration documentation for $source_file"
    log "Output will be written to $output_file"
    
    # Create header for the configuration file
    cat > "$output_file" << EOF
# Configuration Documentation: $(basename "$source_file")

This document describes all configuration options for \`$(basename "$source_file")\`.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Feature Flags](#feature-flags)
- [Threshold Settings](#threshold-settings)
- [Path Configuration](#path-configuration)
- [Sample Configuration](#sample-configuration)

EOF
    
    # Extract module name for better formatting
    local module_name=$(basename "$source_file" .sh)
    
    # Extract environment variables
    echo -e "\n## Environment Variables\n" >> "$output_file"
    echo "These environment variables control the behavior of the module.\n" >> "$output_file"
    
    echo "| Variable | Default | Description |" >> "$output_file"
    echo "|----------|---------|-------------|" >> "$output_file"
    
    # Look for environment variables loaded from config.env
    local env_vars=()
    local in_config_section=false
    
    while IFS= read -r line; do
        # Look for source config.env line
        if [[ "$line" =~ source.*config.env ]]; then
            in_config_section=true
            continue
        fi
        
        # Look for variable assignments after config loading
        if [[ "$in_config_section" == true && "$line" =~ ^([A-Z_]+)=.*$ ]]; then
            env_vars+=("${BASH_REMATCH[1]}")
        fi
        
        # End of section
        if [[ "$in_config_section" == true && "$line" =~ ^# ]]; then
            in_config_section=false
        fi
    done < "$source_file"
    
    # Add environment variables to the table
    if [[ ${#env_vars[@]} -gt 0 ]]; then
        for var in "${env_vars[@]}"; do
            # Look for description in comments
            local desc=""
            grep -B 3 "^$var=" "$source_file" | grep "^#" | while IFS= read -r comment_line; do
                if [[ "$comment_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                fi
            done
            
            # Look for default value
            local default_value=""
            if grep -q "^$var=" "$source_file"; then
                default_value=$(grep "^$var=" "$source_file" | sed -e "s/^$var=//g")
            else
                default_value="(Required)"
            fi
            
            echo "| \`$var\` | \`$default_value\` | $desc |" >> "$output_file"
        done
    else
        echo "No environment variables found." >> "$output_file"
    fi
    
    # Extract feature flags
    echo -e "\n## Feature Flags\n" >> "$output_file"
    echo "These flags enable or disable specific features of the module.\n" >> "$output_file"
    
    echo "| Flag | Default | Description |" >> "$output_file"
    echo "|------|---------|-------------|" >> "$output_file"
    
    # Look for boolean configuration variables
    local in_config_settings=false
    while IFS= read -r line; do
        if [[ "$line" =~ ^#\ +CONFIGURATION\ +SETTINGS ]]; then
            in_config_settings=true
            continue
        fi
        
        if [[ "$in_config_settings" == true && "$line" =~ ^#\ +=+ ]]; then
            in_config_settings=false
            continue
        fi
        
        if [[ "$in_config_settings" == true && "$line" =~ ^([A-Z_]+)=(true|false) ]]; then
            local flag="${BASH_REMATCH[1]}"
            local default="${BASH_REMATCH[2]}"
            
            # Look for description in previous lines
            local desc=""
            local prev_line=""
            local line_num=0
            while IFS= read -r prev_line && [[ $line_num -lt 5 ]]; do
                ((line_num++))
                if [[ "$prev_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                    break
                fi
            done < <(grep -B 5 "^$flag=" "$source_file" | head -n 5)
            
            echo "| \`$flag\` | \`$default\` | $desc |" >> "$output_file"
        fi
    done < "$source_file"
    
    # Extract threshold settings
    echo -e "\n## Threshold Settings\n" >> "$output_file"
    echo "These settings control various thresholds and limits in the module.\n" >> "$output_file"
    
    echo "| Setting | Default | Description |" >> "$output_file"
    echo "|---------|---------|-------------|" >> "$output_file"
    
    # Look for numeric configuration variables
    local in_threshold_settings=false
    while IFS= read -r line; do
        if [[ "$line" =~ ^#\ +THRESHOLD\ +SETTINGS ]]; then
            in_threshold_settings=true
            continue
        fi
        
        if [[ "$in_threshold_settings" == true && "$line" =~ ^#\ +=+ ]]; then
            in_threshold_settings=false
            continue
        fi
        
        if [[ "$in_threshold_settings" == true && "$line" =~ ^([A-Z_]+)=([0-9]+) ]]; then
            local setting="${BASH_REMATCH[1]}"
            local default="${BASH_REMATCH[2]}"
            
            # Look for description in previous lines
            local desc=""
            local prev_line=""
            local line_num=0
            while IFS= read -r prev_line && [[ $line_num -lt 5 ]]; do
                ((line_num++))
                if [[ "$prev_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                    break
                fi
            done < <(grep -B 5 "^$setting=" "$source_file" | head -n 5)
            
            echo "| \`$setting\` | \`$default\` | $desc |" >> "$output_file"
        fi
    done < "$source_file"
    
    # Extract path configuration
    echo -e "\n## Path Configuration\n" >> "$output_file"
    echo "These settings define important file and directory paths used by the module.\n" >> "$output_file"
    
    echo "| Path Variable | Description |" >> "$output_file"
    echo "|--------------|-------------|" >> "$output_file"
    
    # Look for path variables
    local path_vars=()
    local path_descs=()
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^([A-Z_]+_DIR|[A-Z_]+_PATH|[A-Z_]+_FILE)=\"\$\{?[A-Z_]+ ]]; then
            path_vars+=("${BASH_REMATCH[1]}")
            
            # Look for description in previous lines
            local desc=""
            local prev_line=""
            local line_num=0
            while IFS= read -r prev_line && [[ $line_num -lt 3 ]]; do
                ((line_num++))
                if [[ "$prev_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                    break
                fi
            done < <(grep -B 3 "^${BASH_REMATCH[1]}=" "$source_file" | head -n 3)
            
            path_descs+=("$desc")
        fi
    done < "$source_file"
    
    for i in "${!path_vars[@]}"; do
        echo "| \`${path_vars[$i]}\` | ${path_descs[$i]:-Path variable} |" >> "$output_file"
    done
    
    # Add sample configuration
    echo -e "\n## Sample Configuration\n" >> "$output_file"
    echo "Below is a sample configuration file (\`config.env\`) with all available options:\n" >> "$output_file"
    
    echo '```bash' >> "$output_file"
    echo "# Sample configuration for $module_name" >> "$output_file"
    echo "" >> "$output_file"
    
    # Add environment variables
    echo "# Environment Variables" >> "$output_file"
    if [[ ${#env_vars[@]} -gt 0 ]]; then
        for var in "${env_vars[@]}"; do
            local default_value=""
            if grep -q "^$var=" "$source_file"; then
                default_value=$(grep "^$var=" "$source_file" | sed -e "s/^$var=//g")
            else
                default_value="\"\""
            fi
            
            # Get description as comment
            local desc=""
            grep -B 3 "^$var=" "$source_file" | grep "^#" | while IFS= read -r comment_line; do
                if [[ "$comment_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                fi
            done
            
            echo "# $desc" >> "$output_file"
            echo "$var=$default_value" >> "$output_file"
            echo "" >> "$output_file"
        done
    else
        echo "# No environment variables found" >> "$output_file"
        echo "" >> "$output_file"
    fi
    
    # Add feature flags
    echo "# Feature Flags" >> "$output_file"
    local in_config_settings=false
    while IFS= read -r line; do
        if [[ "$line" =~ ^#\ +CONFIGURATION\ +SETTINGS ]]; then
            in_config_settings=true
            continue
        fi
        
        if [[ "$in_config_settings" == true && "$line" =~ ^#\ +=+ ]]; then
            in_config_settings=false
            continue
        fi
        
        if [[ "$in_config_settings" == true && "$line" =~ ^([A-Z_]+)=(true|false) ]]; then
            local flag="${BASH_REMATCH[1]}"
            local default="${BASH_REMATCH[2]}"
            
            # Look for description in previous lines
            local desc=""
            local prev_line=""
            local line_num=0
            while IFS= read -r prev_line && [[ $line_num -lt 5 ]]; do
                ((line_num++))
                if [[ "$prev_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                    break
                fi
            done < <(grep -B 5 "^$flag=" "$source_file" | head -n 5)
            
            echo "# $desc" >> "$output_file"
            echo "$flag=$default" >> "$output_file"
            echo "" >> "$output_file"
        fi
    done < "$source_file"
    
    # Add threshold settings
    echo "# Threshold Settings" >> "$output_file"
    local in_threshold_settings=false
    while IFS= read -r line; do
        if [[ "$line" =~ ^#\ +THRESHOLD\ +SETTINGS ]]; then
            in_threshold_settings=true
            continue
        fi
        
        if [[ "$in_threshold_settings" == true && "$line" =~ ^#\ +=+ ]]; then
            in_threshold_settings=false
            continue
        fi
        
        if [[ "$in_threshold_settings" == true && "$line" =~ ^([A-Z_]+)=([0-9]+) ]]; then
            local setting="${BASH_REMATCH[1]}"
            local default="${BASH_REMATCH[2]}"
            
            # Look for description in previous lines
            local desc=""
            local prev_line=""
            local line_num=0
            while IFS= read -r prev_line && [[ $line_num -lt 5 ]]; do
                ((line_num++))
                if [[ "$prev_line" =~ ^#\ +(.*) ]]; then
                    desc="${BASH_REMATCH[1]}"
                    break
                fi
            done < <(grep -B 5 "^$setting=" "$source_file" | head -n 5)
            
            echo "# $desc" >> "$output_file"
            echo "$setting=$default" >> "$output_file"
            echo "" >> "$output_file"
        fi
    done < "$source_file"
    
    echo '```' >> "$output_file"
    
    log "Configuration documentation generation complete: $output_file"
    return 0
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================

main() {
    if [[ "$#" -lt 2 ]]; then
        show_usage
        exit 1
    fi
    
    local command="$1"
    local source_file="$2"
    shift 2
    
    local output_file=""
    
    # Parse additional options
    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            --output)
                output_file="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Check if source file exists
    if [[ ! -f "$source_file" ]]; then
        log "Error: Source file not found: $source_file"
        exit 1
    fi
    
    # Execute the requested command
    case "$command" in
        extract)
            extract_function_docs "$source_file" "$output_file"
            ;;
        generate-module)
            generate_module_docs "$source_file" "$output_file"
            ;;
        generate-examples)
            generate_examples "$source_file" "$output_file"
            ;;
        generate-config)
            generate_config_docs "$source_file" "$output_file"
            ;;
        *)
            log "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all command-line arguments
main "$@"