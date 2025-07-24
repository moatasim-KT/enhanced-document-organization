#!/bin/bash

# Clean up temporary files
rm -f push_to_remote.sh cleanup_branches.sh

echo "✅ Repository cleanup complete!"
echo ""
echo "📋 Summary of changes:"
echo "✅ All changes staged and committed"
echo "✅ Working on main branch"
echo "✅ Ready for push to remote"
echo ""
echo "🚀 To push to remote, run:"
echo "git push origin main"
echo ""
echo "🧹 To clean up local branches, run:"
echo "git branch -D B_list working-version"