import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CreateProductDto } from '../../application/dto/create-product.dto';
import { ProductPageDto } from '../../application/dto/product-page.dto';
import { CreateProductUseCase } from '../../application/use-cases/create-product.usecase';
import { DeleteProductUseCase } from '../../application/use-cases/delete-product.usecase';
import { GetProductUseCase } from '../../application/use-cases/get-product.usecase';
import { ListProductUseCase } from '../../application/use-cases/list-product.usecase';

@Controller('products')
@Authenticated()
export class ProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly listProductUseCase: ListProductUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
  ) {}

  @Post()
  create (@Body() dto: CreateProductDto) {
    return this.createProductUseCase.execute(dto);
  }

  @Get()
  list (@Query() page: ProductPageDto) {
    return this.listProductUseCase.execute(page);
  }

  @Get(':id')
  get (@Param('id', ParseUUIDPipe) id: string) {
    return this.getProductUseCase.execute(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete (@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteProductUseCase.execute(id);
  }
}
