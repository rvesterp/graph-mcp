import crypto from 'crypto';
import fs from 'fs/promises';
import { machineId } from 'node-machine-id';

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
      const cipher = crypto.createCipher(this.algorithm, key, { iv });
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decrypt(encryptedData) {
    try {
      const key = await this.getMachineKey();
      const { encrypted, iv, tag } = encryptedData;
      
      const decipher = crypto.createDecipher(this.algorithm, key, { 
        iv: Buffer.from(iv, 'hex') 
      });
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  async saveEncryptedData(filePath, data) {
    try {
      const encryptedData = await this.encrypt(data);
      await fs.writeFile(filePath, JSON.stringify(encryptedData), 'utf8');
    } catch (error) {
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

export default EncryptionManager;