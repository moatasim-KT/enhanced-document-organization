#!/bin/bash

echo "Deleting unnecessary branches..."

# Delete local branches
git branch -D B_list 2>/dev/null || echo "B_list branch not found or already deleted"
git branch -D working-version 2>/dev/null || echo "working-version branch not found or already deleted"

echo "Branch cleanup completed!"
echo "Remaining branches:"
git branch -a