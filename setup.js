#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupProject() {
  console.log('🚀 Microsoft Graph MCP Server Setup\n');
  
  try {
    // Check if config.js already exists
    const configPath = path.join(__dirname, 'config', 'config.js');
    const templatePath = path.join(__dirname, 'config', 'config.template.js');
    
    let configExists = false;
    try {
      await fs.access(configPath);
      configExists = true;
    } catch (error) {
      // Config doesn't exist, which is fine
    }
    
    if (configExists) {
      const overwrite = await question('⚠️  Configuration file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }
    
    // Get configuration from user
    console.log('📋 Please provide your Azure AD application details:\n');
    
    const tenantId = await question('Enter your Tenant ID: ');
    if (!tenantId.trim()) {
      throw new Error('Tenant ID is required');
    }
    
    const clientId = await question('Enter your Client ID: ');
    if (!clientId.trim()) {
      throw new Error('Client ID is required');
    }
    
    // Read template file
    let configContent = await fs.readFile(templatePath, 'utf8');
    
    // Replace placeholders
    configContent = configContent.replace('YOUR_TENANT_ID_HERE', tenantId.trim());
    configContent = configContent.replace('YOUR_CLIENT_ID_HERE', clientId.trim());
    
    // Write config file
    await fs.writeFile(configPath, configContent);
    
    // Create data directory
    const dataDir = path.join(__dirname, 'data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    console.log('\n✅ Configuration saved successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Ensure your Azure AD app has the required permissions');
    console.log('2. Grant admin consent for the permissions');
    console.log('3. Add this MCP server to your Claude Desktop configuration');
    console.log('4. Start Claude Desktop to begin the authorization flow');
    
    console.log('\n🔧 Claude Desktop Configuration:');
    console.log('Add this to your claude_desktop_config.json:');
    console.log(JSON.stringify({
      mcpServers: {
        "graph-mcp": {
          command: "node",
          args: [path.join(__dirname, "index.js")],
          env: {
            TENANT_ID: tenantId.trim(),
            CLIENT_ID: clientId.trim()
          }
        }
      }
    }, null, 2));
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setupProject();