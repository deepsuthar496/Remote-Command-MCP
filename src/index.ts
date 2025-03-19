#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';

const execPromise = promisify(exec);
const isWindows = platform() === 'win32';

interface ExecCommandArgs {
  command: string;
  cwd?: string;
}

const isValidExecArgs = (args: any): args is ExecCommandArgs =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.command === 'string' &&
  (args.cwd === undefined || typeof args.cwd === 'string');

class RemoteCommandServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'remote-command-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_remote_command',
          description: 'Execute a command on the host machine',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Command to execute',
              },
              cwd: {
                type: 'string',
                description: 'Working directory for command execution',
              },
            },
            required: ['command'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'execute_remote_command') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (!isValidExecArgs(request.params.arguments)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid command execution arguments'
        );
      }

      try {
        // Normalize command for the current platform
        let command = request.params.arguments.command;
        
        // Handle common cross-platform commands
        if (command.startsWith('ls ')) {
          command = isWindows ? command.replace('ls', 'dir') : command;
        } else if (command.startsWith('dir ')) {
          command = isWindows ? command : command.replace('dir', 'ls');
        } else if (command.includes('|')) {
          // Handle pipe operators
          command = isWindows 
            ? command 
            : command.replace(/\|/g, ' | '); // Ensure proper spacing for Unix pipes
        }

        const { stdout, stderr } = await execPromise(command, {
          cwd: request.params.arguments.cwd,
          shell: isWindows ? 'cmd.exe' : '/bin/sh'
        });

        let output = stdout;
        if (stderr) {
          output += '\nSTDERR:\n' + stderr;
        }

        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Command execution error: ${error?.message || 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Remote Command MCP server running on stdio');
  }
}

const server = new RemoteCommandServer();
server.run().catch(console.error);
