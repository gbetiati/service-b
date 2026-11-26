import { Module } from '@nestjs/common';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { BrandModule } from '../brand/brand.module';
import { CreateProductUseCase } from './application/use-cases/create-product.usecase';
import { DeleteProductUseCase } from './application/use-cases/delete-product.usecase';
import { GetProductUseCase } from './application/use-cases/get-product.usecase';
import { ListProductUseCase } from './application/use-cases/list-product.usecase';
import { ProductRepository } from './domain/repositories/product.repository';
import { ProductController } from './infra/controllers/product.controller';
import { PrismaProductRepository } from './infra/prisma/product.prisma-repository';

@Module({
  imports: [BrandModule, StorageModule],
  controllers: [ProductController],
  providers: [
    CreateProductUseCase, DeleteProductUseCase, GetProductUseCase, ListProductUseCase,
    { provide: ProductRepository, useClass: PrismaProductRepository },
  ],
  exports: [ProductRepository],
})
export class ProductModule {}
