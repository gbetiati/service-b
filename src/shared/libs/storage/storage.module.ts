import { Module } from '@nestjs/common';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageProvider } from './storage.provider';

@Module({ providers: [{ provide: StorageProvider, useClass: S3StorageProvider }], exports: [StorageProvider] })
export class StorageModule {}
