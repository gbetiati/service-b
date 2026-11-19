import { Injectable } from '@nestjs/common';
import { BrandRepository } from '../../domain/repositories/brand.repository';

@Injectable()
export class ListBrandUseCase {
  constructor(
    private readonly brandRepository: BrandRepository,
  ) {}
  execute()
  { return this.brandRepository.findAll(); }
}
