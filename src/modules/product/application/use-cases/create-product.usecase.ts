import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { requireRecord } from '@/shared/core/errors/app.error';
import { BrandRepository } from '@/modules/brand/domain/repositories/brand.repository';
import { ProductCategoryRepository } from '@/modules/product-category/domain/repositories/product-category.repository';
import { Product } from '../../domain/entities/product.entity';
import { ProductRepository } from '../../domain/repositories/product.repository';
import { CreateProductDto } from '../dto/create-product.dto';

@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly requestContext: RequestContext,
    private readonly brandRepository: BrandRepository,
    private readonly productCategoryRepository: ProductCategoryRepository,
  ) {}

  async execute (dto: CreateProductDto) {
    requireRecord(await this.brandRepository.findById(dto.brandId), 'Marca');

    if (dto.categoryId) requireRecord(await this.productCategoryRepository.findById(dto.categoryId), 'Categoria');

    const entity = Product.create(this.requestContext.companyId, dto.name, dto.brandId, dto.categoryId ?? null, dto.description ?? null);
    return this.productRepository.create(entity);
  }
}
