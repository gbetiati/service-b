import { Module } from '@nestjs/common';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { CreateBrandUseCase } from './application/use-cases/create-brand.usecase';
import { DeleteBrandUseCase } from './application/use-cases/delete-brand.usecase';
import { GetBrandLogoUrlUseCase } from './application/use-cases/get-brand-logo-url.usecase';
import { RemoveBrandLogoUseCase } from './application/use-cases/remove-brand-logo.usecase';
import { UploadBrandLogoUseCase } from './application/use-cases/upload-brand-logo.usecase';
import { LogoImageProcessor } from './domain/providers/logo-image-processor.provider';
import { GetBrandUseCase } from './application/use-cases/get-brand.usecase';
import { ListBrandUseCase } from './application/use-cases/list-brand.usecase';
import { BrandRepository } from './domain/repositories/brand.repository';
import { BrandController } from './infra/controllers/brand.controller';
import { PrismaBrandRepository } from './infra/prisma/brand.prisma-repository';
import { SharpLogoImageProcessor } from './infra/providers/sharp-logo-image-processor.provider';

@Module({
  imports: [StorageModule],
  controllers: [BrandController],
  providers: [
    CreateBrandUseCase, DeleteBrandUseCase, GetBrandUseCase, ListBrandUseCase, UploadBrandLogoUseCase, RemoveBrandLogoUseCase, GetBrandLogoUrlUseCase,
    { provide: BrandRepository, useClass: PrismaBrandRepository },
    { provide: LogoImageProcessor, useClass: SharpLogoImageProcessor },
  ],
  exports: [BrandRepository],
})
export class BrandModule {}
