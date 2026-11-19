import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { StorageProvider } from './storage.provider';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private client?: S3Client;

  private get s3client() {
    return this.client ??= new S3Client({
      region: process.env.S3_REGION || 'us-east-1', endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_PATH_STYLE === 'true',
    });
  }

  async put(key: string, body: Buffer | Readable, contentType: string)
  {
    await new Upload({
      client: this.s3client, queueSize: 2,
      params: { Bucket: requiredEnv('S3_BUCKET'), Key: key, Body: body, ContentType: contentType },
    }).done();
  }

  async open(key: string)
  {
    const result = await this.s3client.send(this.object(key));
    if (!result.Body) throw new AppError('upstream', 'Storage retornou um arquivo vazio.');
    
    return result.Body as Readable;
  }

  url(key: string, ttlSeconds = 900)
  {
    return getSignedUrl(this.s3client, this.object(key), { expiresIn: ttlSeconds });
  }

  async remove(key: string)
  {
    await this.s3client.send(new DeleteObjectCommand({ Bucket: requiredEnv('S3_BUCKET'), Key: key }));
  }

  private object(key: string)
  {
    return new GetObjectCommand({ Bucket: requiredEnv('S3_BUCKET'), Key: key });
  }
}
