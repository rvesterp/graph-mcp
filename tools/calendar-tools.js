import axios from 'axios';
import CONFIG from '../config/config.js';
import { DateTime } from 'luxon';

class CalendarTools {
  constructor(authManager) {
    this.authManager = authManager;
  }

  // 1. Get Calendars
  async getCalendars({ name } = {}) {
    try {
      const accessToken = await this.authManager.getValidAccessToken();
      let filter = '';
      if (name) {
        filter = `$filter=name eq '${name}'`;
      } else {
        filter = `$filter=name eq 'Kalender'`;
      }
      const url = `${CONFIG.GRAPH_API_BASE}/me/calendars?${filter}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return {
        success: true,
        data: response.data.value
      };
    } catch (error) {
      return this.handleError('get calendars', error);
    }
  }

  // 2. Create New Meeting
  async createMeeting({ subject, body, start, durationMinutes, location, attendees = [], isOnlineMeeting = true, transactionId }) {
    try {
      const accessToken = await this.authManager.getValidAccessToken();
      // Parse the start time as Copenhagen time (not UTC)
      const startCopenhagen = DateTime.fromISO(start, { zone: 'Europe/Copenhagen' });
      if (!startCopenhagen.isValid) {
        throw new Error('Invalid start time format. Please use ISO 8601 format (e.g., 2025-07-30T09:00:00)');
      }
      const endCopenhagen = startCopenhagen.plus({ minutes: durationMinutes });
      
      const eventBody = {
        subject,
        body: {
          contentType: 'HTML',
          content: body
        },
        start: {
          dateTime: startCopenhagen.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
          timeZone: 'Europe/Copenhagen'
        },
        end: {
          dateTime: endCopenhagen.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
          timeZone: 'Europe/Copenhagen'
        },
        location: location ? { displayName: location } : undefined,
        attendees: attendees.map(email => ({
          emailAddress: { address: email },
          type: 'required'
        })),
        allowNewTimeProposals: true,
        isOnlineMeeting,
        transactionId: transactionId || undefined
      };
      // Remove undefined fields
      Object.keys(eventBody).forEach(key => eventBody[key] === undefined && delete eventBody[key]);
      const response = await axios.post(`${CONFIG.GRAPH_API_BASE}/me/events`, eventBody, {
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
      return this.handleError('create meeting', error);
    }
  }

  // 3. Get Calendar Events
  async getCalendarEvents({ subjectContains, top = 10 } = {}) {
    try {
      const accessToken = await this.authManager.getValidAccessToken();
      const nowUTC = DateTime.now().toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
      let filter = `start/dateTime ge '${nowUTC}'`;
      if (subjectContains) {
        filter += ` and contains(subject,'${subjectContains}')`;
      }
      const select = 'subject,bodyPreview,body,start,attendees,organizer';
      const params = [
        `$filter=${filter}`,
        `$select=${select}`,
        `$orderby=start/dateTime asc`,
        `$top=${top}`
      ].join('&');
      const url = `${CONFIG.GRAPH_API_BASE}/me/calendar/events?${params}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return {
        success: true,
        data: response.data.value
      };
    } catch (error) {
      return this.handleError('get calendar events', error);
    }
  }

  // Find Meeting Times
  async findMeetingTimes({ attendees, start, end, meetingDuration = 'PT30M' }) {
    try {
      if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        throw new Error('At least one attendee email is required');
      }
      if (!start || !end) {
        throw new Error('Start and end dateTime are required');
      }
      const accessToken = await this.authManager.getValidAccessToken();
      // Format attendees
      const formattedAttendees = attendees.map(email => ({
        emailAddress: { address: email },
        type: 'Required'
      }));
      // Format times in Copenhagen timezone
      const startCopenhagen = DateTime.fromISO(start, { zone: 'Europe/Copenhagen' });
      const endCopenhagen = DateTime.fromISO(end, { zone: 'Europe/Copenhagen' });
      if (!startCopenhagen.isValid || !endCopenhagen.isValid) {
        throw new Error('Invalid start or end time format. Please use ISO 8601 format (e.g., 2025-07-30T09:00:00)');
      }
      const body = {
        attendees: formattedAttendees,
        timeConstraint: {
          timeslots: [
            {
              start: {
                dateTime: startCopenhagen.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
                timeZone: 'Europe/Copenhagen'
              },
              end: {
                dateTime: endCopenhagen.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
                timeZone: 'Europe/Copenhagen'
              }
            }
          ]
        },
        meetingDuration
      };
      const response = await axios.post(`${CONFIG.GRAPH_API_BASE}/me/findMeetingTimes`, body, {
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
      return this.handleError('find meeting times', error);
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
        name: 'get_calendars',
        description: 'Get user calendars, optionally filter by name (default: Kalender).',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Calendar name to filter by',
              optional: true
            }
          },
          required: []
        }
      },
      {
        name: 'schedule_meeting',
        description: 'Create a new meeting in the user\'s calendar.',
        inputSchema: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Meeting subject' },
            body: { type: 'string', description: 'Meeting body (HTML)' },
            start: { type: 'string', description: 'Start time (ISO 8601, will be converted to CET)' },
            durationMinutes: { type: 'number', description: 'Duration in minutes' },
            location: { type: 'string', description: 'Location name', optional: true },
            attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses', optional: true },
            isOnlineMeeting: { type: 'boolean', description: 'Whether to make it an online meeting (default: true)', optional: true },
            transactionId: { type: 'string', description: 'Transaction ID for idempotency', optional: true }
          },
          required: ['subject', 'body', 'start', 'durationMinutes']
        }
      },
      {
        name: 'get_next_meetings',
        description: 'Get upcoming calendar events (default: next 10, sorted by soonest).',
        inputSchema: {
          type: 'object',
          properties: {
            subjectContains: { type: 'string', description: 'Filter events where subject contains this text', optional: true },
            top: { type: 'number', description: 'Maximum number of events to retrieve (default: 10)', optional: true }
          },
          required: []
        }
      },
      {
        name: 'find_available_meeting_time_in_calendar',
        description: 'Find potential meeting time slots with specified attendees and time window.',
        inputSchema: {
          type: 'object',
          properties: {
            attendees: {
              type: 'array',
              items: { type: 'string' },
              description: 'Attendee email addresses',
            },
            start: {
              type: 'string',
              description: 'Start of search window (ISO8601, will be converted to CET)'
            },
            end: {
              type: 'string',
              description: 'End of search window (ISO8601, will be converted to CET)'
            },
            meetingDuration: {
              type: 'string',
              description: 'Meeting duration in ISO8601 (e.g. PT1H, PT30M)',
              optional: true
            }
          },
          required: ['attendees', 'start', 'end']
        }
      }
    ];
  }

  async executeTool(name, args) {
    switch (name) {
      case 'get_calendars':
        return await this.getCalendars(args);
      case 'schedule_meeting':
        return await this.createMeeting(args);
      case 'get_next_meetings':
        return await this.getCalendarEvents(args);
      case 'find_available_meeting_time_in_calendar':
        return await this.findMeetingTimes(args);
      default:
        throw new Error(`Unknown calendar tool: ${name}`);
    }
  }
}

export default CalendarTools;