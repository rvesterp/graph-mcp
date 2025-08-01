#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import AuthManager from './auth/auth-manager.js';
import ProfileTools from './tools/profile-tool.js';
import EmailTools from './tools/email-tools.js';
import CalendarTools from './tools/calendar-tools.js';
import CopilotTools from './tools/copilot-tools.js';
import CONFIG from './config/config.js';

// Redirect all logs to stderr to avoid breaking MCP JSON protocol
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

class GraphMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'graph-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.authManager = null;
    this.profileTools = null;
    this.emailTools = null;
    this.calendarTools = null;
    this.copilotTools = null;
    this.isInitialized = false;

    this.setupHandlers();
  }

  async initialize() {
    try {
      console.log('Initializing Microsoft Graph MCP Server...');
      
      // Validate configuration
      if (!CONFIG.TENANT_ID || CONFIG.TENANT_ID === 'YOUR_TENANT_ID_HERE') {
        throw new Error('TENANT_ID must be configured in config.js or environment variables');
      }
      
      if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
        throw new Error('CLIENT_ID must be configured in config.js or environment variables');
      }

      // Initialize authentication
      this.authManager = new AuthManager();
      await this.authManager.initialize();

      // Initialize tool modules
      this.profileTools = new ProfileTools(this.authManager);
      this.emailTools = new EmailTools(this.authManager);
      this.calendarTools = new CalendarTools(this.authManager);
      this.copilotTools = new CopilotTools(this.authManager);

      this.isInitialized = true;
      console.log('Microsoft Graph MCP Server initialized successfully!');
      
    } catch (error) {
      console.error('Initialization failed:', error.message);
      throw error;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.isInitialized) {
        throw new McpError(ErrorCode.InternalError, 'Server not initialized');
      }

      const tools = [
        this.profileTools.getToolDefinition(),
        this.profileTools.getAuthToolDefinition(),
        this.profileTools.getAuthStatusToolDefinition(),
        ...this.emailTools.getToolDefinitions(),
        ...this.calendarTools.getToolDefinitions(),
        ...this.copilotTools.getToolDefinitions()
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.isInitialized) {
        throw new McpError(ErrorCode.InternalError, 'Server not initialized');
      }

      const { name, arguments: args } = request.params;

      try {
        let result;

        // Route to appropriate tool handler
        if (name === 'get_entra_profile' || name === 'authenticate_graph_mcp' || name === 'check_auth_status') {
          result = await this.profileTools.executeTool(name, args);
        } else if ([
          'list_emails', 'get_email', 'draft_new_email', 'draft_reply_email'
        ].includes(name)) {
          result = await this.emailTools.executeTool(name, args);
        } else if ([
          'get_calendars', 'schedule_meeting', 'get_next_meetings', 'find_available_meeting_time_in_calendar'
        ].includes(name)) {
          result = await this.calendarTools.executeTool(name, args);
        } else if ([
          'copilot_retrieval_sharpoint'
        ].includes(name)) {
          result = await this.copilotTools.executeTool(name, args);
        } else {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Handle retryable errors
        if (!result.success && result.retryable) {
          throw new McpError(ErrorCode.InternalError, result.error);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        console.error(`Tool execution failed for ${name}:`, error.message);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });

    // Error handling
    this.server.onerror = (error) => {
      console.error('MCP Server error:', error);
    };

    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    try {
      // Initialize the server
      await this.initialize();
      
      // Start the MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.log('Microsoft Graph MCP Server is running and ready for connections.');
      
    } catch (error) {
      console.error('Failed to start server:', error.message);
      process.exit(1);
    }
  }
}

// Start the server
const server = new GraphMCPServer();
server.run().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});