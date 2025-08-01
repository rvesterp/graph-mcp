import axios from 'axios';
import CONFIG from '../config/config.js';

class EmailTools {
  constructor(authManager) {
    this.authManager = authManager;
  }

  async listEmails(options = {}) {
    try {
      const accessToken = await this.authManager.getValidAccessToken();
      
      const {
        receivedAfter = null,
        senderEmail = null,
        subjectContains = null,
        top = 50
      } = options;

      // Build filter array
      const filters = [];
      
      // Default to 7 days ago if no receivedAfter is specified
      let dateFilter;
      if (receivedAfter) {
        // Validate and format date
        const date = new Date(receivedAfter);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format for receivedAfter. Use YYYY-MM-DDTHH:MM:SS format.');
        }
        dateFilter = date.toISOString();
      } else {
        // Default to 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        dateFilter = sevenDaysAgo.toISOString();
      }
      
      // Always apply the date filter
      filters.push(`receivedDateTime gt ${dateFilter}`);
      
      if (senderEmail) {
        filters.push(`from/emailAddress/address eq '${senderEmail}'`);
      }
      
      if (subjectContains) {
        filters.push(`contains(subject,'${subjectContains}')`);
      }

      // Build query parameters
      const params = {
        '$top': Math.min(top, 1000), // Microsoft Graph limit
        '$orderby': 'receivedDateTime desc', // Sort by receivedDateTime with newest first
        '$select': 'id,createdDateTime,receivedDateTime,hasAttachments,subject,bodyPreview,importance,body,from,toRecipients,ccRecipients'
      };
      
      if (filters.length > 0) {
        params['$filter'] = filters.join(' and ');
      }

      const response = await axios.get(`${CONFIG.GRAPH_API_BASE}/me/messages`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params
      });

      return {
        success: true,
        data: {
          emails: response.data.value,
          totalCount: response.data.value.length,
          hasMore: !!response.data['@odata.nextLink']
        }
      };
      
    } catch (error) {
      return this.handleError('list emails', error);
    }
  }

  async getEmail(messageId) {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }

      const accessToken = await this.authManager.getValidAccessToken();
      
      const response = await axios.get(`${CONFIG.GRAPH_API_BASE}/me/messages/${messageId}`, {
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
      return this.handleError('get email', error);
    }
  }

  async draftEmail(emailData) {
    try {
      const { subject, body, toRecipients, ccRecipients = [], bccRecipients = [], importance = 'normal' } = emailData;
      
      if (!subject || !body || !toRecipients || toRecipients.length === 0) {
        throw new Error('Subject, body, and at least one recipient are required');
      }

      const accessToken = await this.authManager.getValidAccessToken();
      
      // Format recipients
      const formatRecipients = (recipients) => {
        return recipients.map(email => ({
          emailAddress: {
            address: email
          }
        }));
      };

      const draftData = {
        subject,
        importance,
        body: {
          contentType: 'HTML',
          content: body
        },
        toRecipients: formatRecipients(toRecipients)
      };

      if (ccRecipients.length > 0) {
        draftData.ccRecipients = formatRecipients(ccRecipients);
      }

      if (bccRecipients.length > 0) {
        draftData.bccRecipients = formatRecipients(bccRecipients);
      }

      const response = await axios.post(`${CONFIG.GRAPH_API_BASE}/me/messages`, draftData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        data: {
          messageId: response.data.id,
          subject: response.data.subject,
          createdDateTime: response.data.createdDateTime
        }
      };
      
    } catch (error) {
      return this.handleError('draft email', error);
    }
  }

  // Create a draft reply to an email
  async createReplyEmail({ messageId, body, replyAll = false }) {
    try {
      if (!messageId || !body) {
        throw new Error('messageId and body are required');
      }
      const accessToken = await this.authManager.getValidAccessToken();
      
      // Create draft reply using Microsoft Graph
      const endpoint = replyAll ? 'createReplyAll' : 'createReply';
      const createReplyRes = await axios.post(`${CONFIG.GRAPH_API_BASE}/me/messages/${messageId}/${endpoint}`, {}, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const draftMessage = createReplyRes.data;
      
      // Update the draft with our reply body
      const updateBody = {
        body: {
          contentType: 'HTML',
          content: body
        }
      };
      
      const updatedDraft = await axios.patch(`${CONFIG.GRAPH_API_BASE}/me/messages/${draftMessage.id}`, updateBody, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        message: `Draft ${replyAll ? 'reply all' : 'reply'} created successfully.`,
        data: {
          draftId: draftMessage.id,
          subject: draftMessage.subject,
          createdDateTime: draftMessage.createdDateTime
        }
      };
    } catch (error) {
      return this.handleError('create reply email', error);
    }
  }

  async handleError(operation, error) {
    console.error(`Email ${operation} failed:`, error.message);
    
    if (error.response?.status === 401) {
      try {
        await this.authManager.refreshAccessToken();
        return {
          success: false,
          error: 'Authentication refreshed. Please retry the operation.',
          retryable: true
        };
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
      error: `Failed to ${operation}`,
      details: error.response?.data?.error?.message || error.message
    };
  }

  // Get all email tool definitions for MCP
  getToolDefinitions() {
    return [
      {
        name: 'list_emails',
        description: 'List emails from the user\'s mailbox with optional filtering by date, sender, and subject. Defaults to showing emails from the last 7 days if no date filter is specified.',
        inputSchema: {
          type: 'object',
          properties: {
            receivedAfter: {
              type: 'string',
              description: 'Filter emails received after this date (ISO format: YYYY-MM-DDTHH:MM:SS). If not specified, defaults to 7 days ago.',
              optional: true
            },
            senderEmail: {
              type: 'string',
              description: 'Filter emails from a specific sender email address',
              optional: true
            },
            subjectContains: {
              type: 'string',
              description: 'Filter emails where subject contains this text',
              optional: true
            },
            top: {
              type: 'number',
              description: 'Maximum number of emails to retrieve (default: 50, max: 1000)',
              optional: true
            }
          },
          required: []
        }
      },
      {
        name: 'get_email',
        description: 'Retrieve a specific email by its ID.',
        inputSchema: {
          type: 'object',
          properties: {
            messageId: {
              type: 'string',
              description: 'The ID of the email message to retrieve'
            }
          },
          required: ['messageId']
        }
      },
      {
        name: 'draft_new_email',
        description: 'Create a new email draft.',
        inputSchema: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'Email subject line'
            },
            body: {
              type: 'string',
              description: 'Email body content (HTML format)'
            },
            toRecipients: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of recipient email addresses'
            },
            ccRecipients: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of CC recipient email addresses',
              optional: true
            },
            bccRecipients: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of BCC recipient email addresses',
              optional: true
            },
            importance: {
              type: 'string',
              enum: ['low', 'normal', 'high'],
              description: 'Email importance level',
              optional: true
            }
          },
          required: ['subject', 'body', 'toRecipients']
        }
      },
      {
        name: 'draft_reply_email',
        description: 'Create a draft reply to an email. Creates a draft reply that you can review before sending.',
        inputSchema: {
          type: 'object',
          properties: {
            messageId: {
              type: 'string',
              description: 'The ID of the email to reply to.'
            },
            body: {
              type: 'string',
              description: 'Reply body content (HTML format).'
            },
            replyAll: {
              type: 'boolean',
              description: 'Whether to reply to all recipients (default: false for single reply)',
              optional: true
            }
          },
          required: ['messageId', 'body']
        }
      }
    ];
  }

  // Handle tool execution
  async executeTool(name, args) {
    switch (name) {
      case 'list_emails':
        return await this.listEmails(args);
      case 'get_email':
        return await this.getEmail(args.messageId);
      case 'draft_new_email':
        return await this.draftEmail(args);
      case 'draft_reply_email':
        return await this.createReplyEmail(args);
      default:
        throw new Error(`Unknown email tool: ${name}`);
    }
  }
}

export default EmailTools;