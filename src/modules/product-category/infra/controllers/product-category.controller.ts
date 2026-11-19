import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { CreateProductCategoryDto } from '../../application/dto/create-product-category.dto';
import { CreateProductCategoryUseCase } from '../../application/use-cases/create-product-category.usecase';
import { GetProductCategoryUseCase } from '../../application/use-cases/get-product-category.usecase';
import { ListProductCategoryUseCase } from '../../application/use-cases/list-product-category.usecase';

@Controller('product-categories')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProductCategoryController {
  constructor(
    private readonly createProductCategoryUseCase: CreateProductCategoryUseCase,
    private readonly listProductCategoryUseCase: ListProductCategoryUseCase,
    private readonly getProductCategoryUseCase: GetProductCategoryUseCase,
  ) {}

  @Post()
  create (@Body() dto: CreateProductCategoryDto) {
    return this.createProductCategoryUseCase.execute(dto);
  }

  @Get()
  list () {
    return this.listProductCategoryUseCase.execute();
  }

  @Get(':id')
  get (@Param('id', ParseUUIDPipe) id: string) {
    return this.getProductCategoryUseCase.execute(id);
  }
}
