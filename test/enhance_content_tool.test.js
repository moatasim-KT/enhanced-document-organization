/**
 * Test suite for enhance_content tool functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentOrganizationServer } from '../src/mcp/server.js';
import path from 'path';
import os from 'os';

describe('enhance_content Tool', () => {
    let server;
    let testSyncHub;

    beforeEach(async () => {
        // Create test sync hub
        testSyncHub = path.join(os.tmpdir(), `test_sync_hub_${Date.now()}`);

        server = new DocumentOrganizationServer();
        server.syncHub = testSyncHub;

        // Initialize server
        await server.initialize();
    });

    afterEach(async () => {
        // Cleanup is handled by temp directory cleanup
    });

    describe('Content Enhancement', () => {
        it('should return client-side enhancement package for valid content', async () => {
            const testContent = `This is a test document. It has multiple sentences. Some sentences are longer than others and contain more complex information that might benefit from enhancement.

This is another paragraph with different content. It also has multiple sentences.`;

            const result = await server.enhanceContent({
                content: testContent,
                topic: 'Technical Documentation',
                enhancement_type: 'comprehensive'
            });

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            expect(result.content[0].type).toBe('text');

            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(true);
            expect(response.operation).toBe('enhance_content');
            expect(response.client_action_required).toBe(true);
            expect(response.original_content).toBe(testContent);
            expect(response.enhancement_type).toBe('comprehensive');
            expect(response.topic).toBe('Technical Documentation');

            // Check content analysis
            expect(response.content_analysis).toBeDefined();
            expect(response.content_analysis.word_count).toBeGreaterThan(0);
            expect(response.content_analysis.sentence_count).toBeGreaterThan(0);
            expect(response.content_analysis.paragraph_count).toBe(2);

            // Check enhancement instructions
            expect(response.enhancement_instructions).toBeDefined();
            expect(response.enhancement_instructions.enhancement_focus).toBeDefined();
            expect(response.enhancement_instructions.specific_actions).toBeInstanceOf(Array);

            // Check client instructions
            expect(response.client_instructions).toBeDefined();
            expect(response.client_instructions.action).toBe('enhance_content');
            expect(response.client_instructions.description).toBeDefined();
        });

        it('should handle different enhancement types', async () => {
            const testContent = 'Simple test content for enhancement.';

            const enhancementTypes = ['flow', 'structure', 'clarity', 'comprehensive'];

            for (const type of enhancementTypes) {
                const result = await server.enhanceContent({
                    content: testContent,
                    enhancement_type: type
                });

                const response = JSON.parse(result.content[0].text);
                expect(response.success).toBe(true);
                expect(response.enhancement_type).toBe(type);
                expect(response.enhancement_instructions.enhancement_focus).toBeDefined();
            }
        });

        it('should analyze content structure correctly', async () => {
            const structuredContent = `# Main Title

This is an introduction paragraph with some **bold text** and a [link](http://example.com).

## Section 1

- First bullet point
- Second bullet point
- Third bullet point

## Section 2

1. First numbered item
2. Second numbered item

\`\`\`javascript
console.log('code example');
\`\`\`

Final paragraph with conclusion.`;

            const result = await server.enhanceContent({
                content: structuredContent,
                enhancement_type: 'structure'
            });

            const response = JSON.parse(result.content[0].text);
            const analysis = response.content_analysis;

            expect(analysis.header_count).toBe(3);
            expect(analysis.list_count).toBe(5); // 3 bullets + 2 numbered
            expect(analysis.code_block_count).toBe(1);
            expect(analysis.link_count).toBe(1);
            expect(analysis.emphasis_count).toBe(1);
            expect(analysis.structure_elements.has_headers).toBe(true);
            expect(analysis.structure_elements.has_lists).toBe(true);
            expect(analysis.structure_elements.has_code).toBe(true);
            expect(analysis.structure_elements.has_links).toBe(true);
            expect(analysis.structure_elements.has_emphasis).toBe(true);
        });

        it('should provide appropriate recommendations based on content analysis', async () => {
            const longSentenceContent = 'This is an extremely long sentence that contains many clauses and subclauses and continues on and on without proper breaks which makes it very difficult to read and understand and should definitely be broken down into smaller, more manageable pieces for better readability and comprehension.';

            const result = await server.enhanceContent({
                content: longSentenceContent,
                enhancement_type: 'clarity'
            });

            const response = JSON.parse(result.content[0].text);
            const recommendations = response.enhancement_instructions.content_recommendations;

            expect(recommendations).toContain('Break down long sentences for better readability');
        });

        it('should handle missing content gracefully', async () => {
            const result = await server.enhanceContent({
                topic: 'Test Topic'
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(false);
            expect(response.error).toContain('Content is required');
            expect(response.debug_info.content_provided).toBe(false);
        });

        it('should handle invalid content type gracefully', async () => {
            const result = await server.enhanceContent({
                content: 123,
                topic: 'Test Topic'
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(false);
            expect(response.error).toContain('must be a string');
            expect(response.debug_info.content_type).toBe('number');
        });

        it('should include proper metadata in response', async () => {
            const testContent = 'This is a test document with multiple words and sentences. It should generate proper metadata for analysis.';

            const result = await server.enhanceContent({
                content: testContent,
                topic: 'Documentation',
                enhancement_type: 'flow'
            });

            const response = JSON.parse(result.content[0].text);
            const metadata = response.metadata;

            expect(metadata.content_length).toBe(testContent.length);
            expect(metadata.estimated_reading_time).toBeGreaterThan(0);
            expect(metadata.structure_complexity).toBeGreaterThanOrEqual(0);
            expect(metadata.timestamp).toBeDefined();
            expect(new Date(metadata.timestamp)).toBeInstanceOf(Date);
        });

        it('should use default values for optional parameters', async () => {
            const testContent = 'Simple test content.';

            const result = await server.enhanceContent({
                content: testContent
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.topic).toBe('General');
            expect(response.enhancement_type).toBe('comprehensive');
        });
    });

    describe('Content Structure Analysis', () => {
        it('should correctly analyze simple content', () => {
            const content = 'This is a simple sentence. This is another sentence.';
            const analysis = server.analyzeContentStructure(content);

            expect(analysis.word_count).toBe(9);
            expect(analysis.sentence_count).toBe(2);
            expect(analysis.paragraph_count).toBe(1);
            expect(analysis.header_count).toBe(0);
            expect(analysis.avg_words_per_sentence).toBe(4.5);
        });

        it('should detect structural elements', () => {
            const content = `# Header
      
**Bold text** and *italic text*

- List item 1
- List item 2

[Link](http://example.com)

\`\`\`code\`\`\``;

            const analysis = server.analyzeContentStructure(content);

            expect(analysis.structure_elements.has_headers).toBe(true);
            expect(analysis.structure_elements.has_lists).toBe(true);
            expect(analysis.structure_elements.has_code).toBe(true);
            expect(analysis.structure_elements.has_links).toBe(true);
            expect(analysis.structure_elements.has_emphasis).toBe(true);
        });
    });

    describe('Enhancement Instructions Generation', () => {
        it('should generate appropriate instructions for flow enhancement', () => {
            const analysis = {
                word_count: 100,
                header_count: 0,
                avg_words_per_sentence: 15,
                complexity_score: 3,
                paragraph_count: 5,
                structure_elements: { has_lists: false }
            };

            const instructions = server.generateEnhancementInstructions('flow', analysis, 'Technical');

            expect(instructions.enhancement_focus).toContain('flow');
            expect(instructions.specific_actions).toContain('Add smooth transitions between paragraphs');
        });

        it('should generate appropriate instructions for structure enhancement', () => {
            const analysis = {
                word_count: 500,
                header_count: 0,
                avg_words_per_sentence: 12,
                complexity_score: 2,
                paragraph_count: 3,
                structure_elements: { has_lists: false }
            };

            const instructions = server.generateEnhancementInstructions('structure', analysis, 'Documentation');

            expect(instructions.enhancement_focus).toContain('structure');
            expect(instructions.specific_actions).toContain('Add appropriate headings and subheadings');
        });

        it('should provide content-specific recommendations', () => {
            const analysis = {
                word_count: 600,
                header_count: 0,
                avg_words_per_sentence: 25,
                complexity_score: 8,
                paragraph_count: 12,
                structure_elements: { has_lists: false }
            };

            const instructions = server.generateEnhancementInstructions('comprehensive', analysis, 'Technical');

            expect(instructions.content_recommendations).toContain('Break down long sentences for better readability');
            expect(instructions.content_recommendations).toContain('Simplify complex structure while maintaining depth');
            expect(instructions.content_recommendations).toContain('Add section headers to improve navigation');
            expect(instructions.content_recommendations).toContain('Consider using lists to break up dense text');
        });
    });
});