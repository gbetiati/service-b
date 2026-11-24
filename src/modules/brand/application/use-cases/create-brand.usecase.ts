import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { Brand } from '../../domain/entities/brand.entity';
import { BrandRepository } from '../../domain/repositories/brand.repository';
import { CreateBrandDto } from '../dto/create-brand.dto';

@Injectable()
export class CreateBrandUseCase {
  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly requestContext: RequestContext,
  ) {}

  execute (dto: CreateBrandDto) {
    const { name, ...profile } = dto;
    const entity = Brand.create(this.requestContext.companyId, name, profile);
    return this.brandRepository.create(entity);
  }
}
