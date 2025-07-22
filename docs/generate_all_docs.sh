#!/bin/bash

# ============================================================================
# DOCUMENTATION GENERATION WRAPPER
# ============================================================================
# This script generates all documentation for the project modules
# by calling the doc_generator.sh script with appropriate parameters.
#
# @file          generate_all_docs.sh
# @description   Generates all documentation for the project modules
# @version       1.0.0
#
# USAGE:
#   ./generate_all_docs.sh
#
# ============================================================================

set -euo pipefail

# Directory and path configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
DOC_GENERATOR="$SCRIPT_DIR/doc_generator.sh"
OUTPUT_DIR="$SCRIPT_DIR/generated"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Modules to document
MODULES=(
    "$PARENT_DIR/sync/sync_module.sh"
    "$PARENT_DIR/organize/organize_module.sh"
)

# Logs a message to console
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if doc_generator.sh exists
if [[ ! -f "$DOC_GENERATOR" ]]; then
    log "Error: Documentation generator not found at $DOC_GENERATOR"
    exit 1
fi

# Make doc_generator.sh executable if it's not already
if [[ ! -x "$DOC_GENERATOR" ]]; then
    chmod +x "$DOC_GENERATOR"
fi

# Generate all documentation for each module
for module in "${MODULES[@]}"; do
    if [[ ! -f "$module" ]]; then
        log "Warning: Module not found: $module. Skipping..."
        continue
    fi
    
    module_name=$(basename "$module" .sh)
    log "Generating documentation for $module_name..."
    
    # Extract function documentation
    log "  Extracting function documentation..."
    "$DOC_GENERATOR" extract "$module"
    
    # Generate module documentation
    log "  Generating module documentation..."
    "$DOC_GENERATOR" generate-module "$module"
    
    # Generate usage examples
    log "  Generating usage examples..."
    "$DOC_GENERATOR" generate-examples "$module"
    
    # Generate configuration documentation
    log "  Generating configuration documentation..."
    "$DOC_GENERATOR" generate-config "$module"
    
    log "Documentation generation complete for $module_name"
done

# Copy example files to generated directory
log "Copying example files to generated directory..."
cp "$SCRIPT_DIR/examples/"*.md "$OUTPUT_DIR/"

# Generate index file
log "Generating documentation index..."
cat > "$OUTPUT_DIR/index.md" << EOF
# Documentation Index

This documentation was automatically generated from the source code.

## Modules

EOF

# Add links to module documentation
for module in "${MODULES[@]}"; do
    if [[ -f "$module" ]]; then
        module_name=$(basename "$module" .sh)
        # Capitalize first letter
        module_name_cap=$(echo "$module_name" | awk '{print toupper(substr($0,1,1))substr($0,2)}')
        echo "- [$module_name_cap Module](${module_name}_module.md)" >> "$OUTPUT_DIR/index.md"
        echo "  - [Function Documentation](${module_name}_functions.md)" >> "$OUTPUT_DIR/index.md"
        echo "  - [Usage Examples](${module_name}_examples.md)" >> "$OUTPUT_DIR/index.md"
        echo "  - [Configuration](${module_name}_config.md)" >> "$OUTPUT_DIR/index.md"
    fi
done

# Add links to example documentation
cat >> "$OUTPUT_DIR/index.md" << EOF

## Usage Guides and Examples

- [Basic Usage](basic_usage.md)
- [Advanced Configuration](advanced_config.md)
- [Troubleshooting Guide](troubleshooting.md)
- [Integration Examples](integration_examples.md)
EOF

log "All documentation generated successfully in $OUTPUT_DIR"
log "You can view the index at $OUTPUT_DIR/index.md"