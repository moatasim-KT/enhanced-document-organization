import { watch } from 'fs';
import { exec } from 'child_process';
import path from 'path';

const SCRIPT_DIR = '/Users/moatasimfarooque/Downloads/Programming/CascadeProjects/Drive_sync';
const PRIMARY_SYNC_DIR = '/Users/moatasimfarooque/Downloads/Data_Science/Sync_iCloud'; // This should ideally come from config.env
const AUTOMATION_MANAGER_SCRIPT = path.join(SCRIPT_DIR, 'automation', 'automation_manager.sh');

console.log(`[${new Date().toISOString()}] Starting filesystem watcher for: ${PRIMARY_SYNC_DIR}`);

watch(PRIMARY_SYNC_DIR, { recursive: true }, (eventType, filename) => {
  if (filename) {
    console.log(`[${new Date().toISOString()}] Detected ${eventType} on ${filename}`);
    // Trigger the automation manager to run a quick sync/organize
    exec(`${AUTOMATION_MANAGER_SCRIPT} run`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[${new Date().toISOString()}] Error triggering automation: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`[${new Date().toISOString()}] Automation stderr: ${stderr}`);
      }
      console.log(`[${new Date().toISOString()}] Automation stdout: ${stdout}`);
    });
  }
});

console.log(`[${new Date().toISOString()}] Filesystem watcher initialized. Waiting for changes...`);