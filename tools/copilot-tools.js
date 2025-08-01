import axios from 'axios';
import CONFIG from '../config/config.js';

class CopilotTools {
  constructor(authManager) {
    this.authManager = authManager;
  }

  // Copilot Retrieval Tool
  async getCopilotRetrieval({ queryString, dataSource = 'sharePoint', maximumNumberOfResults = 5 }) {
    try {
      if (!queryString) {
        throw new Error('Query string is required');
      }
      
      const accessToken = await this.authManager.getValidAccessToken();
      
      const body = {
        queryString,
        dataSource,
        resourceMetadata: [
          "title",
          "author"
        ],
        maximumNumberOfResults: maximumNumberOfResults.toString()
      };

      const response = await axios.post(`${CONFIG.GRAPH_API_BASE_BETA}/copilot/retrieval`, body, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return this.handleError('get copilot retrieval', error);
    }
  }

  handleError(operation, error) {
    return {
      success: false,
      error: `Failed to ${operation}`,
      details: error.response?.data?.error?.message || error.message
    };
  }

  getToolDefinitions() {
    return [
      {
        name: 'copilot_retrieval_sharpoint',
        description: 'Activate Copilot to search through SharePoint and OneDrive files.',
        inputSchema: {
          type: 'object',
          properties: {
            queryString: {
              type: 'string',
              description: 'The search query from the user, formulated as a question or request (e.g., "How to setup corporate VPN?", "Find documents about budget planning", "What are the latest project guidelines?") It should alway be formulated as a full sentence and not just a subset of words.'
            },
            dataSource: {
              type: 'string',
              description: 'Data source to search (default: sharePoint)',
              optional: true
            },
            maximumNumberOfResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 5)',
              optional: true
            }
          },
          required: ['queryString']
        }
      }
    ];
  }

  async executeTool(name, args) {
    switch (name) {
      case 'copilot_retrieval_sharpoint':
        return await this.getCopilotRetrieval(args);
      default:
        throw new Error(`Unknown copilot tool: ${name}`);
    }
  }
}

export default CopilotTools; 