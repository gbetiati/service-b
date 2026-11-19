import { Injectable } from '@nestjs/common';
import { ProductCategoryRepository } from '../../domain/repositories/product-category.repository';

@Injectable()
export class ListProductCategoryUseCase {
  constructor(
    private readonly productCategoryRepository: ProductCategoryRepository,
  ) {}
  execute()
  { return this.productCategoryRepository.findAll(); }
}
