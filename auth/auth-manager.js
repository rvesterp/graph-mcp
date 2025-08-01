import crypto from 'crypto';
import fs from 'fs/promises';
import pkg from 'node-machine-id';
const { machineId } = pkg;
import axios from 'axios';
import CONFIG from '../config/config.js';

class EncryptionManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this._machineKey = null;
  }

  async getMachineKey() {
    if (!this._machineKey) {
      try {
        const machineIdHash = await machineId();
        // Create a deterministic key based on machine ID
        this._machineKey = crypto.pbkdf2Sync(machineIdHash, 'graph-mcp-salt', 100000, this.keyLength, 'sha256');
      } catch (error) {
        throw new Error(`Failed to generate machine key: ${error.message}`);
      }
    }
    return this._machineKey;
  }

  async encrypt(data) {
    try {
      const key = await this.getMachineKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      process.stderr.write(`[ENCRYPTION ERROR] Failed to encrypt data: ${error.stack || error.message}\n`);
      process.stderr.write(`[ENCRYPTION ERROR] Data: ${JSON.stringify(data)}\n`);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decrypt(encryptedData) {
    try {
      const key = await this.getMachineKey();
      const { encrypted, iv, tag } = encryptedData;
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      process.stderr.write(`[DECRYPTION ERROR] Failed to decrypt data: ${error.stack || error.message}\n`);
      process.stderr.write(`[DECRYPTION ERROR] EncryptedData: ${JSON.stringify(encryptedData)}\n`);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  async saveEncryptedData(filePath, data) {
    try {
      const encryptedData = await this.encrypt(data);
      await fs.writeFile(filePath, JSON.stringify(encryptedData), 'utf8');
    } catch (error) {
      process.stderr.write(`[SAVE ERROR] Failed to save encrypted data to ${filePath}: ${error.stack || error.message}\n`);
      throw new Error(`Failed to save encrypted data: ${error.message}`);
    }
  }

  async loadEncryptedData(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const encryptedData = JSON.parse(fileContent);
      return await this.decrypt(encryptedData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      process.stderr.write(`[LOAD ERROR] Failed to load encrypted data from ${filePath}: ${error.stack || error.message}\n`);
      throw new Error(`Failed to load encrypted data: ${error.message}`);
    }
  }

  async validateMachineId(storedMachineId) {
    try {
      const currentMachineId = await machineId();
      return storedMachineId === currentMachineId;
    } catch (error) {
      throw new Error(`Machine ID validation failed: ${error.message}`);
    }
  }
}

class AuthManager {
  constructor() {
    this.encryptionManager = new EncryptionManager();
    this.tokens = null;
    this.deviceCode = null;
    this.machineId = null;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(CONFIG.DATA_DIR, { recursive: true });
      
      // Load existing tokens if available
      await this.loadTokens();
      
      // Load device code info if available
      await this.loadDeviceCode();
      
      console.log('AuthManager initialized successfully');
    } catch (error) {
      console.error('AuthManager initialization failed:', error.message);
      throw error;
    }
  }

  async loadTokens() {
    try {
      this.tokens = await this.encryptionManager.loadEncryptedData(CONFIG.TOKEN_FILE);
      if (this.tokens) {
        console.log('Loaded existing tokens');
      }
    } catch (error) {
      console.log('No existing tokens found or failed to load');
      this.tokens = null;
    }
  }

  async loadDeviceCode() {
    try {
      this.deviceCode = await this.encryptionManager.loadEncryptedData(CONFIG.DEVICE_FILE);
      if (this.deviceCode) {
        console.log('Loaded existing device code');
      }
    } catch (error) {
      console.log('No existing device code found or failed to load');
      this.deviceCode = null;
    }
  }

  async saveTokens() {
    if (this.tokens) {
      await this.encryptionManager.saveEncryptedData(CONFIG.TOKEN_FILE, this.tokens);
    }
  }

  async saveDeviceCode() {
    if (this.deviceCode) {
      await this.encryptionManager.saveEncryptedData(CONFIG.DEVICE_FILE, this.deviceCode);
    }
  }

  async getValidAccessToken() {
    if (!this.tokens) {
      await this.authenticate();
    }

    // Check if token is expired or about to expire
    const now = Date.now();
    const expiresAt = this.tokens.expires_at;
    
    if (now >= expiresAt - CONFIG.TOKEN_EXPIRY_BUFFER) {
      console.log('Token expired or about to expire, refreshing...');
      await this.refreshAccessToken();
    }

    return this.tokens.access_token;
  }

  async authenticate() {
    process.stderr.write('[AUTH] Entered AuthManager.authenticate()\n');
    try {
      // Get device code
      const deviceCodeResponse = await axios.post(CONFIG.DEVICE_CODE_URL(CONFIG.TENANT_ID), 
        `client_id=${CONFIG.CLIENT_ID}&scope=${encodeURIComponent(CONFIG.SCOPES)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.deviceCode = {
        device_code: deviceCodeResponse.data.device_code,
        user_code: deviceCodeResponse.data.user_code,
        verification_uri: deviceCodeResponse.data.verification_uri,
        expires_in: deviceCodeResponse.data.expires_in,
        interval: deviceCodeResponse.data.interval
      };

      await this.saveDeviceCode();

      // Return authentication instructions instead of logging
      const authInstructions = {
        type: 'authentication_required',
        message: 'Microsoft Graph authentication required',
        instructions: {
          verification_uri: this.deviceCode.verification_uri,
          user_code: this.deviceCode.user_code,
          expires_in: this.deviceCode.expires_in
        }
      };

      process.stderr.write('[AUTH] Returning authentication instructions from AuthManager.authenticate()\n');
      
      // Start polling for token in the background
      this.pollForTokenInBackground();
      
      throw new Error(JSON.stringify(authInstructions));

    } catch (error) {
      process.stderr.write(`[AUTH ERROR] AuthManager.authenticate() failed: ${error.stack || error.message}\n`);
      // If it's our authentication instruction error, re-throw it
      if (error.message.includes('authentication_required')) {
        throw error;
      }
      throw new Error(`Authentication failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  async pollForToken() {
    const startTime = Date.now();
    let attempts = 0;

    while (attempts < CONFIG.MAX_POLL_ATTEMPTS) {
      try {
        const response = await axios.post(CONFIG.TOKEN_URL(CONFIG.TENANT_ID), 
          `client_id=${CONFIG.CLIENT_ID}&device_code=${this.deviceCode.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        // Success! Save tokens
        this.tokens = {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          expires_in: response.data.expires_in,
          expires_at: Date.now() + (response.data.expires_in * 1000),
          token_type: response.data.token_type
        };

        await this.saveTokens();
        console.log('Authentication successful!');
        return;

      } catch (error) {
        if (error.response?.data?.error === 'authorization_pending') {
          // Still waiting for user authorization
          attempts++;
          await new Promise(resolve => setTimeout(resolve, CONFIG.DEVICE_CODE_POLL_INTERVAL));
          continue;
        } else if (error.response?.data?.error === 'authorization_declined') {
          throw new Error('Authorization was declined by the user');
        } else if (error.response?.data?.error === 'expired_token') {
          throw new Error('Device code expired. Please try again.');
        } else {
          throw new Error(`Token polling failed: ${error.response?.data?.error_description || error.message}`);
        }
      }
    }

    throw new Error('Authentication timeout. Please try again.');
  }

  async pollForTokenInBackground() {
    process.stderr.write('[POLL] Starting background token polling\n');
    try {
      await this.pollForToken();
      process.stderr.write('[POLL] Background polling completed successfully\n');
    } catch (error) {
      process.stderr.write(`[POLL ERROR] Background polling failed: ${error.message}\n`);
    }
  }

  async refreshAccessToken() {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    try {
      const response = await axios.post(CONFIG.TOKEN_URL(CONFIG.TENANT_ID), 
        `client_id=${CONFIG.CLIENT_ID}&refresh_token=${this.tokens.refresh_token}&grant_type=refresh_token`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.tokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || this.tokens.refresh_token,
        expires_in: response.data.expires_in,
        expires_at: Date.now() + (response.data.expires_in * 1000),
        token_type: response.data.token_type
      };

      await this.saveTokens();
      console.log('Token refreshed successfully');

    } catch (error) {
      console.error('Token refresh failed:', error.message);
      // Clear tokens and require re-authentication
      this.tokens = null;
      await this.saveTokens();
      throw new Error('Token refresh failed. Please re-authenticate.');
    }
  }
}

export default AuthManager;