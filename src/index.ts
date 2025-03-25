#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';

const execPromise = promisify(exec);
const isWindows = platform() === 'win32';
const COMMAND_TIMEOUT = 30000; // 30 seconds timeout

interface ExecCommandArgs {
  command: string;
  cwd?: string;
}

const isValidExecArgs = (args: any): args is ExecCommandArgs =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.command === 'string' &&
  (args.cwd === undefined || typeof args.cwd === 'string');

// Basic command sanitization
const sanitizeCommand = (command: string): string => {
  // Remove any null bytes that could be used for command injection
  command = command.replace(/\0/g, '');
  
  // Only remove malicious command chaining while preserving pipes
  if (isWindows) {
    command = command.replace(/\|\|/g, '');  // Remove OR operator but keep pipes
  } else {
    command = command.replace(/;/g, '').replace(/\|\|/g, '');  // Remove semicolon and OR operator
  }
  
  return command;
};

// Normalize command for cross-platform compatibility
const normalizeCommand = (command: string): string => {
  let normalizedCmd = command;

  // Handle common cross-platform commands
  if (normalizedCmd.startsWith('ls ')) {
    normalizedCmd = isWindows ? normalizedCmd.replace(/^ls\s+/, 'dir ') : normalizedCmd;
  } else if (normalizedCmd.startsWith('dir ')) {
    normalizedCmd = isWindows ? normalizedCmd : normalizedCmd.replace(/^dir\s+/, 'ls ');
  }

  return normalizedCmd;
};

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

  private executeCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout | null = null;

      // Set timeout
      timeout = setTimeout(() => {
        reject(new Error(`Command timed out after ${COMMAND_TIMEOUT/1000} seconds`));
      }, COMMAND_TIMEOUT);

      // Use exec for commands with pipes, spawn for simple commands
      if (command.includes('|')) {
        execPromise(command, {
          cwd,
          shell: isWindows ? 'cmd.exe' : '/bin/sh',
          timeout: COMMAND_TIMEOUT,
          windowsHide: true
        }).then(({ stdout, stderr }) => {
          if (timeout) clearTimeout(timeout);
          resolve({ stdout, stderr });
        }).catch((error) => {
          if (timeout) clearTimeout(timeout);
          reject(error);
        });
      } else {
        const shell = isWindows ? 'cmd.exe' : '/bin/sh';
        const args = isWindows ? ['/c', command] : ['-c', command];
        
        console.error(`Executing command: ${command} (${shell} ${args.join(' ')})`);  // Debug log

        const child = spawn(shell, args, {
          cwd,
          shell: true,
          windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('error', (error) => {
          if (timeout) clearTimeout(timeout);
          reject(error);
        });

        child.on('close', (code) => {
          if (timeout) clearTimeout(timeout);
          if (code === 0 || stdout.length > 0) { // Consider command successful if there's output even with non-zero exit code
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`Command failed with exit code ${code}${stderr ? ': ' + stderr : ''}`));
          }
        });
      }
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
        // Sanitize and normalize the command
        const sanitizedCmd = sanitizeCommand(request.params.arguments.command);
        const normalizedCmd = normalizeCommand(sanitizedCmd);

        const { stdout, stderr } = await this.executeCommand(
          normalizedCmd,
          request.params.arguments.cwd
        );

        // Combine stdout and stderr in the response
        const output = [];
        
        if (stdout.trim()) {
          output.push(stdout.trim());
        }
        
        if (stderr.trim()) {
          output.push('STDERR:', stderr.trim());
        }

        return {
          content: [
            {
              type: 'text',
              text: output.join('\n') || 'Command completed successfully (no output)',
            },
          ],
        };
      } catch (error: any) {
        // Enhanced error handling with more details
        const errorMessage = [
          'Command execution error:',
          `Command: ${request.params.arguments.command}`,
          `Error: ${error?.message || 'Unknown error'}`
        ];

        console.error('Command failed:', error);  // Debug log

        return {
          content: [
            {
              type: 'text',
              text: errorMessage.join('\n'),
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
