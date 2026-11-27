import { Body, Controller, Delete, Get, HttpCode, Param, ParseFilePipeBuilder, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CreateBrandDto } from '../../application/dto/create-brand.dto';
import { CreateBrandUseCase } from '../../application/use-cases/create-brand.usecase';
import { DeleteBrandUseCase } from '../../application/use-cases/delete-brand.usecase';
import { GetBrandLogoUrlUseCase } from '../../application/use-cases/get-brand-logo-url.usecase';
import { RemoveBrandLogoUseCase } from '../../application/use-cases/remove-brand-logo.usecase';
import { UploadBrandLogoUseCase } from '../../application/use-cases/upload-brand-logo.usecase';
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
    private readonly uploadBrandLogoUseCase: UploadBrandLogoUseCase,
    private readonly removeBrandLogoUseCase: RemoveBrandLogoUseCase,
    private readonly getBrandLogoUrlUseCase: GetBrandLogoUrlUseCase,
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

  // Logo da marca (campo `file`), até 5 MB. Envia ou troca o atual.
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }))
  uploadLogo (@Param('id', ParseUUIDPipe) id: string, @UploadedFile(new ParseFilePipeBuilder().build()) file: Express.Multer.File) {
    return this.uploadBrandLogoUseCase.execute(id, file.buffer);
  }

  @Delete(':id/logo')
  @HttpCode(204)
  async removeLogo (@Param('id', ParseUUIDPipe) id: string) {
    await this.removeBrandLogoUseCase.execute(id);
  }

  @Get(':id/logo/url')
  logoUrl (@Param('id', ParseUUIDPipe) id: string) {
    return this.getBrandLogoUrlUseCase.execute(id);
  }
}
