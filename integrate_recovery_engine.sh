#!/bin/bash

# Script to integrate the recovery engine into the main sync_manager.sh file
# This script adds the recovery engine functions to the sync_manager.sh file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_MANAGER="$SCRIPT_DIR/sync_manager.sh"
RECOVERY_ENGINE="$SCRIPT_DIR/recovery_engine.sh"
BACKUP_FILE="$SCRIPT_DIR/sync_manager.sh.backup"

# Create a backup of the original sync_manager.sh
cp "$SYNC_MANAGER" "$BACKUP_FILE"

echo "Created backup of sync_manager.sh at $BACKUP_FILE"

# Find the appropriate insertion point in the sync_manager.sh file
# We'll insert the recovery engine functions after the error classification system
INSERTION_POINT=$(grep -n "# Enhanced error logging with exit code interpretation" "$SYNC_MANAGER" | head -1 | cut -d':' -f1)

if [ -z "$INSERTION_POINT" ]; then
    echo "Error: Could not find insertion point in sync_manager.sh"
    exit 1
fi

# Extract the recovery engine functions from recovery_engine.sh
RECOVERY_ENGINE_FUNCTIONS=$(cat "$RECOVERY_ENGINE" | sed '1,2d')  # Skip the first two lines (shebang and empty line)

# Insert the recovery engine functions into sync_manager.sh
head -n "$INSERTION_POINT" "$SYNC_MANAGER" > "$SYNC_MANAGER.tmp"
echo "" >> "$SYNC_MANAGER.tmp"
echo "# ============================================================================" >> "$SYNC_MANAGER.tmp"
echo "# AUTOMATED RECOVERY ENGINE" >> "$SYNC_MANAGER.tmp"
echo "# ============================================================================" >> "$SYNC_MANAGER.tmp"
echo "" >> "$SYNC_MANAGER.tmp"
echo "$RECOVERY_ENGINE_FUNCTIONS" >> "$SYNC_MANAGER.tmp"
echo "" >> "$SYNC_MANAGER.tmp"
tail -n +$((INSERTION_POINT + 1)) "$SYNC_MANAGER" >> "$SYNC_MANAGER.tmp"

# Replace the original sync_manager.sh with the updated version
mv "$SYNC_MANAGER.tmp" "$SYNC_MANAGER"
chmod +x "$SYNC_MANAGER"

echo "Successfully integrated recovery engine into sync_manager.sh"

# Make the test script executable
chmod +x "$SCRIPT_DIR/test_recovery_engine.sh"

echo "Made test_recovery_engine.sh executable"
echo "Integration complete. You can now run test_recovery_engine.sh to verify the recovery engine functionality."