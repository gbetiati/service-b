import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CreateBrandDto } from '../../application/dto/create-brand.dto';
import { CreateBrandUseCase } from '../../application/use-cases/create-brand.usecase';
import { DeleteBrandUseCase } from '../../application/use-cases/delete-brand.usecase';
import { GetBrandUseCase } from '../../application/use-cases/get-brand.usecase';
import { ListBrandUseCase } from '../../application/use-cases/list-brand.usecase';

@Controller('brands')
@Authenticated()
export class BrandController {
  constructor(
    private readonly createBrandUseCase: CreateBrandUseCase,
    private readonly listBrandUseCase: ListBrandUseCase,
    private readonly getBrandUseCase: GetBrandUseCase,
    private readonly deleteBrandUseCase: DeleteBrandUseCase,
  ) {}

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

  @Delete(':id')
  @HttpCode(204)
  async delete (@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteBrandUseCase.execute(id);
  }
}
