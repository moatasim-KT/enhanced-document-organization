import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const args = process.argv.slice(2);
  const toolName = args[0];
  const toolArgs = JSON.parse(args[1] || '{}');

  const client = new Client({
    name: 'automation-client',
    version: '1.0.0',
  });

  const transport = new StdioClientTransport();
  await client.connect(transport);

  try {
    const result = await client.callTool({ name: toolName, arguments: toolArgs });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error calling tool ${toolName}:`, error.message);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);