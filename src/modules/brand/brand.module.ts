import { Module } from '@nestjs/common';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { CreateBrandUseCase } from './application/use-cases/create-brand.usecase';
import { DeleteBrandUseCase } from './application/use-cases/delete-brand.usecase';
import { GetBrandUseCase } from './application/use-cases/get-brand.usecase';
import { ListBrandUseCase } from './application/use-cases/list-brand.usecase';
import { BrandRepository } from './domain/repositories/brand.repository';
import { BrandController } from './infra/controllers/brand.controller';
import { PrismaBrandRepository } from './infra/prisma/brand.prisma-repository';

@Module({
  imports: [StorageModule],
  controllers: [BrandController],
  providers: [
    CreateBrandUseCase, DeleteBrandUseCase, GetBrandUseCase, ListBrandUseCase,
    { provide: BrandRepository, useClass: PrismaBrandRepository },
  ],
  exports: [BrandRepository],
})
export class BrandModule {}
