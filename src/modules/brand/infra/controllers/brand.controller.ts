import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { CreateBrandDto } from '../../application/dto/create-brand.dto';
import { CreateBrandUseCase } from '../../application/use-cases/create-brand.usecase';
import { GetBrandUseCase } from '../../application/use-cases/get-brand.usecase';
import { ListBrandUseCase } from '../../application/use-cases/list-brand.usecase';

@Controller('brands')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BrandController {
  constructor(
    private readonly createBrandUseCase: CreateBrandUseCase,
    private readonly listBrandUseCase: ListBrandUseCase,
    private readonly getBrandUseCase: GetBrandUseCase,
  ) { }

  @Post()
  create (@Body() dto: CreateBrandDto) {
    return this.createBrandUseCase.execute(dto);
  }

  @Get()
  list () {
    return this.listBrandUseCase.execute();
  }

  @Get(':id')
  get (@Param('id', ParseUUIDPipe) id: string) {
    return this.getBrandUseCase.execute(id);
  }
}
