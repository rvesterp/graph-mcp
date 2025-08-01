#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔒 Security Check for Graph MCP Server\n');

const sensitivePatterns = [
  'config/config.js',
  'data/',
  '.env',
  '*.key',
  '*.pem',
  '*.crt',
  '*.cert',
  'auth-tokens.json',
  'tokens.json',
  'credentials.json'
];

const sensitiveExtensions = ['.key', '.pem', '.p12', '.pfx', '.crt', '.cert'];

let foundSensitiveFiles = false;

// Check for sensitive files
console.log('Checking for sensitive files...');

function checkDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      if (file.name === 'node_modules' || file.name === '.git') {
        continue;
      }
      checkDirectory(fullPath);
    } else {
      // Check for sensitive patterns
      for (const pattern of sensitivePatterns) {
        if (pattern.includes('*')) {
          const ext = pattern.substring(pattern.indexOf('*'));
          if (file.name.endsWith(ext)) {
            console.log(`❌ Found sensitive file: ${fullPath}`);
            foundSensitiveFiles = true;
          }
        } else if (fullPath.includes(pattern)) {
          console.log(`❌ Found sensitive file: ${fullPath}`);
          foundSensitiveFiles = true;
        }
      }
      
      // Check for sensitive extensions
      for (const ext of sensitiveExtensions) {
        if (file.name.endsWith(ext)) {
          console.log(`❌ Found file with sensitive extension: ${fullPath}`);
          foundSensitiveFiles = true;
        }
      }
    }
  }
}

try {
  checkDirectory('.');
  
  if (!foundSensitiveFiles) {
    console.log('✅ No sensitive files found!');
    console.log('✅ Your repository is safe to commit and share.');
  } else {
    console.log('\n⚠️  WARNING: Sensitive files found!');
    console.log('Please remove these files before committing to GitHub.');
    console.log('Consider adding them to .gitignore if they are needed locally.');
    process.exit(1);
  }
} catch (error) {
  console.error('Error during security check:', error.message);
  process.exit(1);
} 