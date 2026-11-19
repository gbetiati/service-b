import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../../domain/repositories/product.repository';

@Injectable()
export class ListProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}
  execute()
  { return this.productRepository.findAll(); }
}
