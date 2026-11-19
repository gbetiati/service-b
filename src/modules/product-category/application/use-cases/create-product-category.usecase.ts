import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';

import { ProductCategory } from '../../domain/entities/product-category.entity';
import { ProductCategoryRepository } from '../../domain/repositories/product-category.repository';
import { CreateProductCategoryDto } from '../dto/create-product-category.dto';

@Injectable()
export class CreateProductCategoryUseCase {
  constructor(
    private readonly productCategoryRepository: ProductCategoryRepository,
    private readonly requestContext: RequestContext,
  ) {}

  execute(dto: CreateProductCategoryDto)
  {
    const entity = ProductCategory.create(this.requestContext.companyId, dto.name);
    return this.productCategoryRepository.create(entity);
  }
}
