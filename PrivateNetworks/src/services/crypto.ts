import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface IdentityData {
  keyPair: KeyPair;
  userId: string;
}

class CryptoService {
  async generateKeyPair(): Promise<KeyPair> {
    try {
      // Generate Ed25519 keypair using TweetNaCl
      const keyPair = nacl.sign.keyPair();
      
      return {
        publicKey: naclUtil.encodeBase64(keyPair.publicKey),
        privateKey: naclUtil.encodeBase64(keyPair.secretKey),
      };
    } catch (error) {
      console.error('Key generation failed:', error);
      throw new Error('Failed to generate cryptographic keys');
    }
  }

  async signMessage(message: string, privateKeyBase64: string): Promise<string> {
    try {
      // Decode the private key from base64
      const privateKey = naclUtil.decodeBase64(privateKeyBase64);
      
      // Encode message to Uint8Array
      const messageBytes = naclUtil.decodeUTF8(message);
      
      // Sign the message with Ed25519
      const signature = nacl.sign.detached(messageBytes, privateKey);
      
      // Return signature as base64
      return naclUtil.encodeBase64(signature);
    } catch (error) {
      console.error('Message signing failed:', error);
      throw new Error('Failed to sign message');
    }
  }

  async verifySignature(
    message: string,
    signatureBase64: string,
    publicKeyBase64: string,
  ): Promise<boolean> {
    try {
      // Decode signature and public key from base64
      const signature = naclUtil.decodeBase64(signatureBase64);
      const publicKey = naclUtil.decodeBase64(publicKeyBase64);
      
      // Encode message to Uint8Array
      const messageBytes = naclUtil.decodeUTF8(message);
      
      // Verify Ed25519 signature
      return nacl.sign.detached.verify(messageBytes, signature, publicKey);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  formatPublicKey(publicKeyBase64: string): string {
    // return `ed25519:${publicKeyBase64}`;
    return publicKeyBase64;
  }

  generateAuthChallenge(): string {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 15);
    return `auth_challenge_${timestamp}_${nonce}`;
  }

  // Helper method to convert base64 to hex for display purposes
  base64ToHex(base64: string): string {
    try {
      const bytes = naclUtil.decodeBase64(base64);
      return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.error('Base64 to hex conversion failed:', error);
      return base64; // fallback to original
    }
  }

  // Helper method to generate a shorter display version of keys
  getDisplayKey(key: string): string {
    const hex = this.base64ToHex(key);
    if (hex.length > 16) {
      return `${hex.substring(0, 8)}...${hex.substring(hex.length - 8)}`;
    }
    return hex;
  }
}

export const cryptoService = new CryptoService();