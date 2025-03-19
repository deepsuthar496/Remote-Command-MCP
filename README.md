# Remote Command MCP Server

A Model Context Protocol (MCP) server that enables remote command execution across different operating systems. This server provides a unified interface to execute shell commands, automatically handling platform-specific differences between Windows and Unix-like systems.

## Features

- Cross-platform command execution
- Automatic command normalization between Windows and Unix
- Built-in error handling and output streaming
- Working directory specification support
- Platform-specific shell selection

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd remote-command-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

4. Configure the MCP server in your settings file:

For VSCode Cline Extension (`cline_mcp_settings.json`):
```json
{
  "mcpServers": {
    "remote-command": {
      "command": "node",
      "args": ["path/to/remote-command-server/build/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Usage

The server provides a single tool called `execute_remote_command` that can execute ANY valid shell command on the host machine. This includes:

- System commands
- Package manager commands (apt, yum, chocolatey, etc.)
- Development tools (git, npm, python, etc.)
- File operations
- Network commands
- Service management
- And any other CLI commands available on the system

### Tool: execute_remote_command

**Parameters:**
- `command` (required): Any valid shell command that can be executed on the host OS
- `cwd` (optional): Working directory for command execution

### Examples

1. System Information:
```typescript
<use_mcp_tool>
<server_name>remote-command</server_name>
<tool_name>execute_remote_command</tool_name>
<arguments>
{
  "command": "systeminfo"  // Windows
  // or "uname -a"        // Linux
}
</arguments>
</use_mcp_tool>
```

2. Package Management:
```typescript
<use_mcp_tool>
<server_name>remote-command</server_name>
<tool_name>execute_remote_command</tool_name>
<arguments>
{
  "command": "npm list -g --depth=0"  // List global NPM packages
}
</arguments>
</use_mcp_tool>
```

3. Network Operations:
```typescript
<use_mcp_tool>
<server_name>remote-command</server_name>
<tool_name>execute_remote_command</tool_name>
<arguments>
{
  "command": "netstat -an"  // Show all network connections
}
</arguments>
</use_mcp_tool>
```

4. Git Operations:
```typescript
<use_mcp_tool>
<server_name>remote-command</server_name>
<tool_name>execute_remote_command</tool_name>
<arguments>
{
  "command": "git status",
  "cwd": "/path/to/repo"
}
</arguments>
</use_mcp_tool>
```

5. File Operations:
```typescript
<use_mcp_tool>
<server_name>remote-command</server_name>
<tool_name>execute_remote_command</tool_name>
<arguments>
{
  "command": "ls -la",  // List files with details
  "cwd": "/path/to/directory"
}
</arguments>
</use_mcp_tool>
```

6. Process Management:
```typescript
<use_mcp_tool>
<server_name>remote-command</server_name>
<tool_name>execute_remote_command</tool_name>
<arguments>
{
  "command": "ps aux"  // List all running processes (Unix)
  // or "tasklist"     // Windows equivalent
}
</arguments>
</use_mcp_tool>
```

7. Service Control:
```typescript
<use_mcp_tool>
<server_name>remote-command</server_name>
<tool_name>execute_remote_command</tool_name>
<arguments>
{
  "command": "systemctl status nginx"  // Check service status (Linux)
  // or "sc query nginx"               // Windows equivalent
}
</arguments>
</use_mcp_tool>
```

### Security Considerations

Since this server can execute any system command, please consider the following security practices:

1. **Access Control**: Limit access to the MCP server to trusted users only
2. **Command Validation**: Validate commands before execution in your application logic
3. **Working Directory**: Use the `cwd` parameter to restrict command execution to specific directories
4. **Environment**: Be cautious with commands that modify system settings or sensitive files
5. **Permissions**: Run the MCP server with appropriate user permissions

### Cross-Platform Command Handling

The server automatically handles platform-specific differences:

1. Command Translation:
   - `ls` ⟷ `dir` (automatically converted based on platform)
   - Proper pipe operator formatting for each platform

2. Shell Selection:
   - Windows: Uses `cmd.exe`
   - Unix/Linux: Uses `/bin/sh`

### Error Handling

The server provides detailed error messages and includes both stdout and stderr in the response. If a command fails, you'll receive an error message with details about what went wrong.

Example error response:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Command execution error: Command failed with exit code 1"
    }
  ],
  "isError": true
}
```

## Development

### Project Structure

```
remote-command-server/
├── src/
│   └── index.ts    # Main server implementation
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

This will compile the TypeScript code and create the executable in the `build` directory.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
