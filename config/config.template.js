import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  // Microsoft Graph Configuration
  // Replace these values with your Azure AD application details
  TENANT_ID: process.env.TENANT_ID || 'YOUR_TENANT_ID_HERE',
  CLIENT_ID: process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
  
  // OAuth2 URLs (do not modify unless you know what you're doing)
  DEVICE_CODE_URL: (tenantId) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
  TOKEN_URL: (tenantId) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  
  // Microsoft Graph API Base URL (do not modify)
  GRAPH_API_BASE: 'https://graph.microsoft.com/v1.0',
  
  // Scopes required for the application (modify only if you need additional permissions)
  SCOPES: [
    'Calendars.Read',
    'Calendars.ReadWrite', 
    'Contacts.Read',
    'Mail.Read',
    'Mail.ReadWrite',
    'Mail.Send',
    'User.Read',
    'openid',
    'profile',
    'email',
    'offline_access'
  ].join(' '),
  
  // File paths for storing encrypted tokens (do not modify)
  DATA_DIR: path.join(__dirname, '..', 'data'),
  TOKEN_FILE: path.join(__dirname, '..', 'data', 'tokens.enc'),
  DEVICE_FILE: path.join(__dirname, '..', 'data', 'device.enc'),
  
  // Token expiration buffer - refresh tokens 5 minutes before expiry
  TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000,
  
  // Device code polling interval - check every 5 seconds
  DEVICE_CODE_POLL_INTERVAL: 5000,
  
  // Maximum polling attempts - 15 minutes total
  MAX_POLL_ATTEMPTS: 180
};

export default CONFIG;