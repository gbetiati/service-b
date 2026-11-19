import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { BrandRepository } from '../../domain/repositories/brand.repository';

@Injectable()
export class GetBrandUseCase {
  constructor(
    private readonly brandRepository: BrandRepository,
  ) {}

  async execute (id: string) {
    return requireRecord(await this.brandRepository.findById(id), 'Brand');
  }
}
