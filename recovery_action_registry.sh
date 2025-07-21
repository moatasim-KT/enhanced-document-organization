#!/bin/bash

# ============================================================================
# RECOVERY ACTION REGISTRY
# ============================================================================
# This file contains the enhanced recovery action registry that maps error types
# to appropriate recovery procedures with additional metadata

# Define error types and their corresponding recovery actions
declare -A ERROR_TYPE_METADATA

# Initialize error type metadata
initialize_error_type_metadata() {
    # Format: "recovery_actions:severity:is_transient:recommended_action"
    
    # Authentication errors
    ERROR_TYPE_METADATA["authentication"]="refresh_credentials:validate_permissions:check_token_expiry:request_new_credentials:clear_cached_credentials:high:false:retry_after_recovery"
    
    # Conflict errors
    ERROR_TYPE_METADATA["conflict"]="reset_archives:clean_problematic_files:backup_conflicts:resolve_file_conflicts:high:false:retry_after_recovery"
    
    # Quota errors
    ERROR_TYPE_METADATA["quota"]="cleanup_space:compress_logs:remove_temp_files:check_quota_limits:high:false:retry_after_recovery"
    
    # Network errors
    ERROR_TYPE_METADATA["network"]="wait_connectivity:test_endpoints:check_dns_resolution:verify_proxy_settings:medium:true:retry_with_backoff"
    
    # Configuration errors
    ERROR_TYPE_METADATA["configuration"]="validate_paths:fix_permissions:restore_profile:verify_config_syntax:high:false:retry_after_recovery"
    
    # Transient errors
    ERROR_TYPE_METADATA["transient"]="wait_and_retry:check_system_load:verify_resource_availability:low:true:retry_with_backoff"
    
    # Permanent errors
    ERROR_TYPE_METADATA["permanent"]="log_permanent_error:notify_administrator:create_diagnostic_report:critical:false:manual_intervention"
    
    # Partial sync errors
    ERROR_TYPE_METADATA["partial_sync"]="analyze_failed_files:selective_retry:verify_file_integrity:medium:true:retry_selective"
    
    # Permission errors
    ERROR_TYPE_METADATA["permission"]="fix_permissions:validate_ownership:request_elevated_permissions:high:false:retry_after_recovery"
    
    # Corruption errors
    ERROR_TYPE_METADATA["corruption"]="reset_archives:verify_file_integrity:rebuild_database:critical:false:retry_after_recovery"
}

# Get recovery actions for a specific error type
get_recovery_actions() {
    local error_type=$1
    
    # Initialize metadata if not already done
    if [ ${#ERROR_TYPE_METADATA[@]} -eq 0 ]; then
        initialize_error_type_metadata
    fi
    
    # Get metadata for the error type
    local metadata="${ERROR_TYPE_METADATA[$error_type]:-}"
    
    if [ -z "$metadata" ]; then
        # Default to empty string for unknown error types
        echo ""
        return 1
    fi
    
    # Extract recovery actions (first field before the first severity marker)
    local recovery_actions=$(echo "$metadata" | cut -d':' -f1-$(echo "$metadata" | tr ':' '\n' | grep -n "high\|medium\|low\|critical" | head -1 | cut -d':' -f1))
    
    echo "$recovery_actions"
    return 0
}

# Get severity level for a specific error type
get_error_severity() {
    local error_type=$1
    
    # Initialize metadata if not already done
    if [ ${#ERROR_TYPE_METADATA[@]} -eq 0 ]; then
        initialize_error_type_metadata
    fi
    
    # Get metadata for the error type
    local metadata="${ERROR_TYPE_METADATA[$error_type]:-}"
    
    if [ -z "$metadata" ]; then
        # Default to medium severity for unknown error types
        echo "medium"
        return 1
    fi
    
    # Extract severity (field after recovery actions)
    local severity=$(echo "$metadata" | grep -o "\(high\|medium\|low\|critical\)")
    
    echo "$severity"
    return 0
}

# Check if an error type is transient
is_error_transient() {
    local error_type=$1
    
    # Initialize metadata if not already done
    if [ ${#ERROR_TYPE_METADATA[@]} -eq 0 ]; then
        initialize_error_type_metadata
    fi
    
    # Get metadata for the error type
    local metadata="${ERROR_TYPE_METADATA[$error_type]:-}"
    
    if [ -z "$metadata" ]; then
        # Default to false for unknown error types
        echo "false"
        return 1
    fi
    
    # Extract transient flag (field after severity)
    local is_transient=$(echo "$metadata" | grep -o "\(true\|false\)" | head -1)
    
    echo "$is_transient"
    return 0
}

# Get recommended action for a specific error type
get_recommended_action() {
    local error_type=$1
    
    # Initialize metadata if not already done
    if [ ${#ERROR_TYPE_METADATA[@]} -eq 0 ]; then
        initialize_error_type_metadata
    fi
    
    # Get metadata for the error type
    local metadata="${ERROR_TYPE_METADATA[$error_type]:-}"
    
    if [ -z "$metadata" ]; then
        # Default to manual intervention for unknown error types
        echo "manual_intervention"
        return 1
    fi
    
    # Extract recommended action (last field)
    local recommended_action=$(echo "$metadata" | grep -o "\(retry_after_recovery\|retry_with_backoff\|manual_intervention\|retry_selective\)")
    
    echo "$recommended_action"
    return 0
}

# Get all registered error types
get_all_error_types() {
    # Initialize metadata if not already done
    if [ ${#ERROR_TYPE_METADATA[@]} -eq 0 ]; then
        initialize_error_type_metadata
    fi
    
    # Return all keys from the associative array
    echo "${!ERROR_TYPE_METADATA[@]}"
    return 0
}

# Get detailed information about an error type
get_error_type_details() {
    local error_type=$1
    
    # Initialize metadata if not already done
    if [ ${#ERROR_TYPE_METADATA[@]} -eq 0 ]; then
        initialize_error_type_metadata
    fi
    
    # Get metadata for the error type
    local metadata="${ERROR_TYPE_METADATA[$error_type]:-}"
    
    if [ -z "$metadata" ]; then
        echo "Error type not found: $error_type"
        return 1
    fi
    
    # Extract all components
    local recovery_actions=$(get_recovery_actions "$error_type")
    local severity=$(get_error_severity "$error_type")
    local is_transient=$(is_error_transient "$error_type")
    local recommended_action=$(get_recommended_action "$error_type")
    
    # Format output as JSON-like string
    echo "{\"error_type\":\"$error_type\",\"recovery_actions\":\"$recovery_actions\",\"severity\":\"$severity\",\"is_transient\":$is_transient,\"recommended_action\":\"$recommended_action\"}"
    return 0
}

# Register a new error type or update an existing one
register_error_type() {
    local error_type=$1
    local recovery_actions=$2
    local severity=$3
    local is_transient=$4
    local recommended_action=$5
    
    # Initialize metadata if not already done
    if [ ${#ERROR_TYPE_METADATA[@]} -eq 0 ]; then
        initialize_error_type_metadata
    fi
    
    # Validate inputs
    if [ -z "$error_type" ] || [ -z "$recovery_actions" ] || [ -z "$severity" ] || [ -z "$is_transient" ] || [ -z "$recommended_action" ]; then
        echo "Error: All parameters are required for registering an error type"
        return 1
    fi
    
    # Validate severity
    if ! echo "$severity" | grep -q "^high$\|^medium$\|^low$\|^critical$"; then
        echo "Error: Invalid severity level. Must be one of: low, medium, high, critical"
        return 1
    fi
    
    # Validate is_transient
    if ! echo "$is_transient" | grep -q "^true$\|^false$"; then
        echo "Error: Invalid transient flag. Must be true or false"
        return 1
    fi
    
    # Validate recommended_action
    if ! echo "$recommended_action" | grep -q "^retry_after_recovery$\|^retry_with_backoff$\|^manual_intervention$\|^retry_selective$"; then
        echo "Error: Invalid recommended action. Must be one of: retry_after_recovery, retry_with_backoff, manual_intervention, retry_selective"
        return 1
    fi
    
    # Register or update the error type
    ERROR_TYPE_METADATA["$error_type"]="$recovery_actions:$severity:$is_transient:$recommended_action"
    
    echo "Successfully registered error type: $error_type"
    return 0
}

# Main function for testing the registry
test_recovery_action_registry() {
    initialize_error_type_metadata
    
    echo "Testing Recovery Action Registry"
    echo "================================"
    
    echo "All registered error types:"
    get_all_error_types
    
    echo -e "\nTesting recovery actions for each error type:"
    for error_type in $(get_all_error_types); do
        echo -e "\n$error_type:"
        echo "  Recovery actions: $(get_recovery_actions "$error_type")"
        echo "  Severity: $(get_error_severity "$error_type")"
        echo "  Is transient: $(is_error_transient "$error_type")"
        echo "  Recommended action: $(get_recommended_action "$error_type")"
    done
    
    echo -e "\nTesting detailed information:"
    get_error_type_details "authentication"
    
    echo -e "\nTesting error type registration:"
    register_error_type "custom_error" "custom_action1:custom_action2" "medium" "false" "retry_after_recovery"
    get_error_type_details "custom_error"
}

# Run the test function if the script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    test_recovery_action_registry
fi