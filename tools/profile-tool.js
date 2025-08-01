import axios from 'axios';
import CONFIG from '../config/config.js';

class ProfileTools {
  constructor(authManager) {
    this.authManager = authManager;
  }

  async getMyProfile() {
    try {
      const accessToken = await this.authManager.getValidAccessToken();
      
      const response = await axios.get(`${CONFIG.GRAPH_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          '$select': 'displayName,jobTitle,mail,mobilePhone,officeLocation,businessPhones,id'
        }
      });

      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Get profile failed:', error.message);
      
      if (error.response?.status === 401) {
        // Token might be invalid, try to refresh
        try {
          await this.authManager.refreshAccessToken();
          return await this.getMyProfile(); // Retry once
        } catch (refreshError) {
          return {
            success: false,
            error: 'Authentication failed. Please re-authorize the application.',
            details: refreshError.message
          };
        }
      }
      
      return {
        success: false,
        error: 'Failed to retrieve profile information',
        details: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Get profile tool definition for MCP
  getToolDefinition() {
    return {
      name: 'get_entra_profile',
      description: 'Retrieve the current user\'s Microsoft Graph profile information including display name, job title, email, phone, and office location.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  // Get authentication tool definition for MCP
  getAuthToolDefinition() {
    return {
      name: 'authenticate_graph_mcp',
      description: 'Start Microsoft Graph OAuth2 authentication process. Returns authentication instructions.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  // Get authentication status tool definition for MCP
  getAuthStatusToolDefinition() {
    return {
      name: 'check_auth_status',
      description: 'Check authentication status and manually trigger token polling if needed.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  // Check authentication status
  async checkAuthStatus() {
    try {
      // Try to get a valid access token
      const accessToken = await this.authManager.getValidAccessToken();
      
      if (accessToken) {
        return {
          success: true,
          message: 'Authentication is valid and ready to use.',
          hasValidToken: true
        };
      } else {
        return {
          success: false,
          message: 'No valid authentication token found.',
          hasValidToken: false
        };
      }
    } catch (error) {
      // If we get an authentication error, try to start polling
      if (error.message.includes('authentication_required')) {
        try {
          // Try to parse the authentication instructions
          const authData = JSON.parse(error.message);
          return {
            success: false,
            authentication_required: true,
            message: authData.message,
            instructions: authData.instructions,
            hasValidToken: false
          };
        } catch (parseError) {
          return {
            success: false,
            error: 'Authentication failed',
            details: error.message,
            hasValidToken: false
          };
        }
      }
      
      return {
        success: false,
        error: 'Authentication check failed',
        details: error.message,
        hasValidToken: false
      };
    }
  }

  // Handle authentication
  async authenticate() {
    process.stderr.write('[TOOL] Entered ProfileTools.authenticate()\n');
    try {
      await this.authManager.authenticate();
      process.stderr.write('[TOOL] AuthManager.authenticate() completed successfully\n');
      return {
        success: true,
        message: 'Authentication successful! You can now use other tools.'
      };
    } catch (error) {
      process.stderr.write(`[TOOL ERROR] ProfileTools.authenticate() failed: ${error.stack || error.message}\n`);
      // Check if this is an authentication instruction error
      if (error.message.includes('authentication_required')) {
        try {
          const authData = JSON.parse(error.message);
          process.stderr.write('[TOOL] Returning authentication instructions from ProfileTools.authenticate()\n');
          return {
            success: false,
            authentication_required: true,
            message: authData.message,
            instructions: authData.instructions
          };
        } catch (parseError) {
          process.stderr.write(`[TOOL ERROR] Failed to parse authentication instructions: ${parseError.stack || parseError.message}\n`);
          return {
            success: false,
            error: 'Authentication failed',
            details: error.message
          };
        }
      }
      
      return {
        success: false,
        error: 'Authentication failed',
        details: error.message
      };
    }
  }

  // Handle tool execution
  async executeTool(name, args) {
    switch (name) {
      case 'get_entra_profile':
        return await this.getMyProfile();
      case 'authenticate_graph_mcp':
        return await this.authenticate();
      case 'check_auth_status':
        return await this.checkAuthStatus();
      default:
        throw new Error(`Unknown profile tool: ${name}`);
    }
  }
}

export default ProfileTools;