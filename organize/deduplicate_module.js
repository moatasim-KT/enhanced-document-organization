const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function getFileHash(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function findDuplicateFiles(directory) {
    const filesByHash = new Map();
    const duplicates = [];

    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile()) {
                try {
                    const hash = await getFileHash(fullPath);
                    if (filesByHash.has(hash)) {
                        filesByHash.get(hash).push(fullPath);
                    } else {
                        filesByHash.set(hash, [fullPath]);
                    }
                } catch (error) {
                    console.error(`Error processing file ${fullPath}: ${error.message}`);
                }
            }
        }
    }

    await walk(directory);

    for (const [hash, filePaths] of filesByHash.entries()) {
        if (filePaths.length > 1) {
            // Sort by modification time (oldest first) to keep the oldest
            const sortedFiles = await Promise.all(filePaths.map(async (filePath) => {
                const stats = await fs.stat(filePath);
                return { filePath, mtimeMs: stats.mtimeMs };
            }));
            sortedFiles.sort((a, b) => a.mtimeMs - b.mtimeMs);

            // All files except the oldest are duplicates to be removed
            duplicates.push(...sortedFiles.slice(1).map(f => f.filePath));
        }
    }
    return duplicates;
}

async function removeFiles(filePaths) {
    for (const filePath of filePaths) {
        try {
            await fs.unlink(filePath);
            console.log(`Removed duplicate file: ${filePath}`);
        } catch (error) {
            console.error(`Error removing file ${filePath}: ${error.message}`);
        }
    }
}

async function main() {
    const directory = process.argv[2]; // Get directory from command line argument
    if (!directory) {
        console.error('Usage: node deduplicate_module.js <directory_to_scan>');
        process.exit(1);
    }

    console.log(`Scanning for duplicate files in: ${directory}`);
    const duplicateFiles = await findDuplicateFiles(directory);

    if (duplicateFiles.length > 0) {
        console.log(`Found ${duplicateFiles.length} duplicate(s). Removing...`);
        await removeFiles(duplicateFiles);
        console.log('Duplicate removal complete.');
    } else {
        console.log('No duplicate files found.');
    }
}

if (require.main === module) {
    main();
}
