#!/usr/bin/env node

/**
 * Profile Validator Unit Tests
 * Tests Unison profile validation functionality
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

class ProfileValidatorTests {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
        this.testDir = path.join(os.tmpdir(), 'profile_validator_test');
    }

    async setup() {
        console.log('🔧 Setting up profile validator test environment...');
        
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore if directory doesn't exist
        }

        await fs.mkdir(this.testDir, { recursive: true });
        await fs.mkdir(path.join(this.testDir, 'config'), { recursive: true });
        
        // Create test Unison profiles
        const validProfile = `# Valid Unison Profile
root = /Users/test/Sync_Hub
root = ssh://user@example.com//remote/path

# Ignore patterns
ignore = Name .DS_Store
ignore = Name *.tmp
ignore = Path .git

# Sync options
batch = true
auto = true
silent = true`;

        const invalidProfile = `# Invalid Unison Profile
root = /nonexistent/path
# Missing second root
ignore = Invalid syntax here`;

        await fs.writeFile(path.join(this.testDir, 'config', 'valid.prf'), validProfile);
        await fs.writeFile(path.join(this.testDir, 'config', 'invalid.prf'), invalidProfile);

        console.log('✅ Test environment setup complete');
    }

    async testValidProfileValidation() {
        console.log('\n🔍 Testing valid profile validation...');
        
        try {
            const { ProfileValidator } = await import(path.join(projectRoot, 'src/sync/profile_validator.js'));
            
            const validator = new ProfileValidator();
            const profilePath = path.join(this.testDir, 'config', 'valid.prf');
            const result = await validator.validateProfile(profilePath);
            
            if (result.isValid) {
                this.logSuccess('Valid profile validation');
            } else {
                this.logFailure('Valid profile validation', `Expected valid profile, got errors: ${result.errors.join(', ')}`);
            }
            
        } catch (error) {
            this.logFailure('Valid profile validation', error.message);
        }
    }

    async testInvalidProfileValidation() {
        console.log('\n🔍 Testing invalid profile validation...');
        
        try {
            const { ProfileValidator } = await import(path.join(projectRoot, 'src/sync/profile_validator.js'));
            
            const validator = new ProfileValidator();
            const profilePath = path.join(this.testDir, 'config', 'invalid.prf');
            const result = await validator.validateProfile(profilePath);
            
            if (!result.isValid && result.errors.length > 0) {
                this.logSuccess('Invalid profile validation');
            } else {
                this.logFailure('Invalid profile validation', 'Expected validation errors for invalid profile');
            }
            
        } catch (error) {
            this.logFailure('Invalid profile validation', error.message);
        }
    }

    async testRootPathValidation() {
        console.log('\n🔍 Testing root path validation...');
        
        try {
            const { ProfileValidator } = await import(path.join(projectRoot, 'src/sync/profile_validator.js'));
            
            const validator = new ProfileValidator();
            
            // Test valid local path
            const validPath = os.homedir();
            const validResult = await validator.validateRootPath(validPath);
            
            if (validResult.isValid) {
                this.logSuccess('Valid root path validation');
            } else {
                this.logFailure('Valid root path validation', `Expected valid path for ${validPath}`);
            }
            
            // Test invalid path
            const invalidPath = '/nonexistent/path/that/should/not/exist';
            const invalidResult = await validator.validateRootPath(invalidPath);
            
            if (!invalidResult.isValid) {
                this.logSuccess('Invalid root path validation');
            } else {
                this.logFailure('Invalid root path validation', `Expected invalid path for ${invalidPath}`);
            }
            
        } catch (error) {
            this.logFailure('Root path validation', error.message);
        }
    }

    logSuccess(testName) {
        console.log(`✅ ${testName}`);
        this.testResults.passed++;
    }

    logFailure(testName, error) {
        console.log(`❌ ${testName}: ${error}`);
        this.testResults.failed++;
        this.testResults.errors.push({ test: testName, error });
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
            console.log('✅ Cleanup complete');
        } catch (error) {
            console.log(`⚠️ Cleanup warning: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('🧪 Profile Validator Unit Tests');
        console.log('='.repeat(50));

        try {
            await this.setup();
            await this.testValidProfileValidation();
            await this.testInvalidProfileValidation();
            await this.testRootPathValidation();
        } finally {
            await this.cleanup();
        }

        // Print summary
        console.log('\n📊 Test Results Summary:');
        console.log('='.repeat(30));
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);

        if (this.testResults.errors.length > 0) {
            console.log('\n🔍 Error Details:');
            this.testResults.errors.forEach(({ test, error }) => {
                console.log(`  • ${test}: ${error}`);
            });
        }

        return this.testResults.failed === 0;
    }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new ProfileValidatorTests();
    tests.runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export default ProfileValidatorTests;
