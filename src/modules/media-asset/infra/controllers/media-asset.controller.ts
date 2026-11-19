import { Controller, Get, Param, ParseFilePipeBuilder, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { GetMediaAssetUrlUseCase } from '../../application/use-cases/get-media-asset-url.usecase';
import { ListMediaAssetsUseCase } from '../../application/use-cases/list-media-assets.usecase';
import { UploadMediaAssetUseCase } from '../../application/use-cases/upload-media-asset.usecase';

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
export class MediaAssetController {
  constructor(
    private readonly uploadMediaAssetUseCase: UploadMediaAssetUseCase,
    private readonly listMediaAssetsUseCase: ListMediaAssetsUseCase,
    private readonly getMediaAssetUrlUseCase: GetMediaAssetUrlUseCase,
  ) {}

  @Post('products/:id/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }))
  upload(@Param('id', ParseUUIDPipe) id: string, @UploadedFile(new ParseFilePipeBuilder().build()) file: Express.Multer.File) {
    return this.uploadMediaAssetUseCase.execute(id, file.buffer);
  }

  @Get('products/:id/media')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.listMediaAssetsUseCase.execute(id);
  }

  @Get('media-assets/:id/url')
  getUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.getMediaAssetUrlUseCase.execute(id);
  }
}
