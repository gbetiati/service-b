import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { EncryptedToken } from '../../domain/entities/social-credential.entity';
import { TokenCipherProvider } from '../../domain/providers/token-cipher.provider';

@Injectable()
export class AesTokenCipherProvider implements TokenCipherProvider {
  encrypt (token: string, companyId: string): EncryptedToken {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(companyId));
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    return { initializationVector: iv.toString('base64'), encryptedValue: encrypted.toString('base64') };
  }

  decrypt (token: EncryptedToken, companyId: string) {
    const encrypted = Buffer.from(token.encryptedValue, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(token.initializationVector, 'base64'));
    decipher.setAAD(Buffer.from(companyId));
    decipher.setAuthTag(encrypted.subarray(-16));
    return Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8');
  }

  private key () {
    const key = Buffer.from(requiredEnv('SOCIAL_CREDENTIAL_KEY'), 'base64');

    if (key.length !== 32) throw new AppError('unavailable', 'SOCIAL_CREDENTIAL_KEY precisa codificar 32 bytes em Base64.');

    return key;
  }
}
