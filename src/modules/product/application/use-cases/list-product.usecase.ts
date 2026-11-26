import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../../domain/repositories/product.repository';
import { ProductPageDto } from '../dto/product-page.dto';

@Injectable()
export class ListProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {}

  execute (page: ProductPageDto = {}) {
    return this.productRepository.findAll(page.offset, page.limit);
  }
}
