import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ProductRepository } from '../../domain/repositories/product.repository';

@Injectable()
export class GetProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}
  async execute(id: string)
  { return requireRecord(await this.productRepository.findById(id), 'Product'); }
}
