import { Controller, Get, Param, ParseFilePipeBuilder, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { GetMediaAssetUrlUseCase } from '../../application/use-cases/get-media-asset-url.usecase';
import { ListMediaAssetsUseCase } from '../../application/use-cases/list-media-assets.usecase';
import { UploadMediaAssetUseCase } from '../../application/use-cases/upload-media-asset.usecase';

@Controller()
@Authenticated()
export class MediaAssetController {
  constructor(
    private readonly uploadMediaAssetUseCase: UploadMediaAssetUseCase,
    private readonly listMediaAssetsUseCase: ListMediaAssetsUseCase,
    private readonly getMediaAssetUrlUseCase: GetMediaAssetUrlUseCase,
  ) {}

  @Post('products/:id/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }))
  upload (@Param('id', ParseUUIDPipe) id: string, @UploadedFile(new ParseFilePipeBuilder().build()) file: Express.Multer.File) {
    return this.uploadMediaAssetUseCase.execute(id, file.buffer, file.mimetype);
  }

  @Get('products/:id/media')
  list (@Param('id', ParseUUIDPipe) id: string) {
    return this.listMediaAssetsUseCase.execute(id);
  }

  @Get('media-assets/:id/url')
  getUrl (@Param('id', ParseUUIDPipe) id: string) {
    return this.getMediaAssetUrlUseCase.execute(id);
  }
}
