import type { Readable } from 'node:stream';

export abstract class StorageProvider {
  abstract put (key: string, body: Buffer | Readable, contentType: string): Promise<void>;

  abstract open (key: string): Promise<Readable>;

  abstract url (key: string, ttlSeconds?: number): Promise<string>;

  abstract remove (key: string): Promise<void>;
}
