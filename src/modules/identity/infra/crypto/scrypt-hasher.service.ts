import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../domain/providers/password-hasher';

const deriveKey = promisify(scrypt);

@Injectable()
export class ScryptHasherService implements PasswordHasher {
  async hash(password: string)
  {
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64) as Buffer;
    return salt + '.' + key.toString('hex');
  }
  async verify(password: string, hash = '')
  {
    const [salt, key] = hash.split('.');
    const actual = await deriveKey(password, salt || '0'.repeat(32), 64) as Buffer;
    const expected = Buffer.from(key ?? '', 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
