import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  // Microsoft Graph Configuration
  TENANT_ID: process.env.TENANT_ID || '21a72fff-b86b-492c-bb02-b09e6e0beab9',
  CLIENT_ID: process.env.CLIENT_ID || 'f7d11973-9e75-44dc-acfb-325f9ece9b48',
  
  // OAuth2 URLs
  DEVICE_CODE_URL: (tenantId) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
  TOKEN_URL: (tenantId) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  
  // Microsoft Graph API Base URL
  GRAPH_API_BASE: 'https://graph.microsoft.com/v1.0',
  GRAPH_API_BASE_BETA: 'https://graph.microsoft.com/beta',

  // Scopes required for the application
  SCOPES: [
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Calendars.ReadWrite.Shared',
    'Contacts.Read',
    'Mail.Read',
    'Mail.ReadWrite',
    'Mail.Send',
    'User.Read',
    'Sites.Read.All',
    'Files.Read.All',
    'openid',
    'profile',
    'email',
    'offline_access'
  ].join(' '),
  
  // File paths for storing encrypted tokens
  DATA_DIR: path.join(__dirname, '..', 'data'),
  TOKEN_FILE: path.join(__dirname, '..', 'data', 'tokens.enc'),
  DEVICE_FILE: path.join(__dirname, '..', 'data', 'device.enc'),
  
  // Token expiration buffer (5 minutes)
  TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000,
  
  // Device code polling interval (5 seconds)
  DEVICE_CODE_POLL_INTERVAL: 5000,
  
  // Maximum polling attempts
  MAX_POLL_ATTEMPTS: 180 // 15 minutes total
};

export default CONFIG;