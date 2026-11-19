import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ProductCategoryRepository } from '../../domain/repositories/product-category.repository';

@Injectable()
export class GetProductCategoryUseCase {
  constructor(
    private readonly productCategoryRepository: ProductCategoryRepository,
  ) {}
  async execute(id: string)
  { return requireRecord(await this.productCategoryRepository.findById(id), 'ProductCategory'); }
}
