import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CreateProductDto } from '../../application/dto/create-product.dto';
import { CreateProductUseCase } from '../../application/use-cases/create-product.usecase';
import { GetProductUseCase } from '../../application/use-cases/get-product.usecase';
import { ListProductUseCase } from '../../application/use-cases/list-product.usecase';

@Controller('products')
@Authenticated()
export class ProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly listProductUseCase: ListProductUseCase,
    private readonly getProductUseCase: GetProductUseCase,
  ) {}

  @Post()
  create (@Body() dto: CreateProductDto) {
    return this.createProductUseCase.execute(dto);
  }

  @Get()
  list () {
    return this.listProductUseCase.execute();
  }

  @Get(':id')
  get (@Param('id', ParseUUIDPipe) id: string) {
    return this.getProductUseCase.execute(id);
  }
}
