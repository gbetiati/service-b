import { Module } from '@nestjs/common';
import { CreateProductCategoryUseCase } from './application/use-cases/create-product-category.usecase';
import { GetProductCategoryUseCase } from './application/use-cases/get-product-category.usecase';
import { ListProductCategoryUseCase } from './application/use-cases/list-product-category.usecase';
import { ProductCategoryRepository } from './domain/repositories/product-category.repository';
import { ProductCategoryController } from './infra/controllers/product-category.controller';
import { PrismaProductCategoryRepository } from './infra/prisma/product-category.prisma-repository';

@Module({
  controllers: [ProductCategoryController],
  providers: [
    CreateProductCategoryUseCase, GetProductCategoryUseCase, ListProductCategoryUseCase,
    { provide: ProductCategoryRepository, useClass: PrismaProductCategoryRepository },
  ],
  exports: [ProductCategoryRepository],
})
export class ProductCategoryModule {}
