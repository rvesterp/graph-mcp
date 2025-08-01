# Microsoft Graph MCP Server

A Model Context Protocol (MCP) server that provides Claude Desktop with access to Microsoft Graph APIs for profile and email management.

## Features

- **Secure Authentication**: OAuth2 device code flow with encrypted token storage
- **Machine ID Validation**: Tokens are tied to specific machines for enhanced security
- **Profile Management**: Retrieve user profile information
- **Email Operations**: List, read, draft, and reply to emails
- **Auto Token Refresh**: Automatic access token renewal
- **Comprehensive Error Handling**: Robust error handling with retry mechanisms

## Setup Instructions

### 1. Prerequisites

- Node.js 18.0.0 or higher
- Microsoft Azure AD application with appropriate permissions
- Claude Desktop

### 2. Azure AD Application Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure your application:
   - **Name**: Graph MCP Application
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Leave blank (we use device code flow)
5. After creation, note down:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### 3. API Permissions

Add the following Microsoft Graph permissions:
- `Calendars.Read`
- `Calendars.ReadWrite`
- `Contacts.Read`
- `Mail.Read`
- `Mail.ReadWrite`
- `Mail.Send`
- `User.Read`
- `openid`
- `profile`
- `email`
- `offline_access`

**Important**: Grant admin consent for these permissions.

### 4. Installation

1. Clone/download the project to the specified folder:
   ```
   C:\Users\RAVP\My Projects\Graph-MCP - Java
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your application:
   - Open `config/config.js`
   - Replace `YOUR_TENANT_ID_HERE` with your Azure tenant ID
   - Replace `YOUR_CLIENT_ID_HERE` with your Azure application client ID
   
   Alternatively, set environment variables:
   ```bash
   export TENANT_ID="your-tenant-id"
   export CLIENT_ID="your-client-id"
   ```

### 5. Claude Desktop Configuration

Add the following to your Claude Desktop MCP configuration file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "graph-mcp": {
      "command": "node",
      "args": ["C:\\Users\\RAVP\\My Projects\\Graph-MCP - Java\\index.js"],
      "env": {
        "TENANT_ID": "your-tenant-id",
        "CLIENT_ID": "your-client-id"
      }
    }
  }
}
```

## First Run Authorization

1. Start Claude Desktop
2. The MCP server will automatically start and prompt for authorization
3. Follow the console instructions:
   - Visit the provided Microsoft login URL
   - Enter the displayed user code
   - Complete the sign-in process
4. The server will automatically save encrypted tokens for future use

## Available Tools

### Profile Tools

#### `get_my_profile`
Retrieves the current user's profile information.

**Parameters**: None

**Returns**: User profile with display name, job title, email, phone, and office location.

### Email Tools

#### `list_emails`
Lists emails from the user's mailbox with optional filtering.

**Parameters**:
- `receivedAfter` (optional): Filter emails received after this date (ISO format)
- `senderEmail` (optional): Filter emails from a specific sender
- `subjectContains` (optional): Filter emails where subject contains text
- `top` (optional): Maximum number of emails to retrieve (default: 50)

#### `get_email`
Retrieves a specific email by its ID.

**Parameters**:
- `messageId`: The ID of the email message

#### `draft_email`
Creates a new email draft.

**Parameters**:
- `subject`: Email subject line
- `body`: Email body content (HTML format)
- `toRecipients`: Array of recipient email addresses
- `ccRecipients` (optional): Array of CC recipients
- `bccRecipients` (optional): Array of BCC recipients
- `importance` (optional): Email importance level (low/normal/high)

#### `draft_reply`
Creates a reply draft to an existing email.

**Parameters**:
- `originalMessageId`: ID of the original message
- `body`: Reply body content (HTML format)
- `toAll` (optional): Whether to reply to all recipients

## Security Features

- **Encryption**: All tokens and sensitive data are encrypted using machine-specific keys
- **Machine Binding**: Tokens are tied to the specific machine where they were generated
- **Auto-Refresh**: Access tokens are automatically refreshed using refresh tokens
- **Secure Storage**: Encrypted data is stored in the local `data/` directory

## File Structure

```
Graph-MCP/
├── index.js                 # Main MCP server
├── package.json            # Node.js dependencies
├── config/
│   └── config.js           # Configuration settings
├── auth/
│   ├── auth-manager.js     # OAuth2 authentication handler
│   └── encryption.js       # Token encryption utilities
├── tools/
│   ├── profile-tools.js    # Profile management tools
│   └── email-tools.js      # Email management tools
├── data/                   # Encrypted token storage (created automatically)
└── README.md              # This file
```

## Troubleshooting

### Common Issues

1. **"TENANT_ID must be configured"**
   - Ensure you've updated the configuration with your Azure tenant ID

2. **"Authentication failed"**
   - Check that your Azure app has the correct permissions
   - Verify admin consent has been granted
   - Try re-authorization by deleting the `data/` folder

3. **"Machine ID mismatch"**
   - Tokens are machine-specific; delete the `data/` folder to re-authorize

4. **"Token refresh failed"**
   - The refresh token may have expired; delete the `data/` folder to re-authorize

### Logs

Check the console output when Claude Desktop starts for detailed error messages and authorization status.

### Re-authorization

To force re-authorization:
1. Close Claude Desktop
2. Delete the `data/` folder in the project directory
3. Restart Claude Desktop
4. Follow the authorization prompts again

## Development

To run in development mode:
```bash
npm run dev
```

This will start the server with file watching enabled for automatic restarts.

## License

MIT License