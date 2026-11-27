import { Body, Controller, Get, Param, ParseFilePipeBuilder, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { UpdateMediaAssetKindDto, UploadMediaAssetQueryDto } from '../../application/dto/media-asset-kind.dto';
import { GetMediaAssetUrlUseCase } from '../../application/use-cases/get-media-asset-url.usecase';
import { ListMediaAssetsUseCase } from '../../application/use-cases/list-media-assets.usecase';
import { UpdateMediaAssetKindUseCase } from '../../application/use-cases/update-media-asset-kind.usecase';
import { UploadMediaAssetUseCase } from '../../application/use-cases/upload-media-asset.usecase';

@Controller()
@Authenticated()
export class MediaAssetController {
  constructor(
    private readonly uploadMediaAssetUseCase: UploadMediaAssetUseCase,
    private readonly listMediaAssetsUseCase: ListMediaAssetsUseCase,
    private readonly getMediaAssetUrlUseCase: GetMediaAssetUrlUseCase,
    private readonly updateMediaAssetKindUseCase: UpdateMediaAssetKindUseCase,
  ) {}

  @Post('products/:id/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }))
  upload (@Param('id', ParseUUIDPipe) id: string, @Query() query: UploadMediaAssetQueryDto, @UploadedFile(new ParseFilePipeBuilder().build()) file: Express.Multer.File) {
    return this.uploadMediaAssetUseCase.execute(id, file.buffer, file.mimetype, query.kind);
  }

  @Get('products/:id/media')
  list (@Param('id', ParseUUIDPipe) id: string) {
    return this.listMediaAssetsUseCase.execute(id);
  }

  @Patch('media-assets/:id')
  updateKind (@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMediaAssetKindDto) {
    return this.updateMediaAssetKindUseCase.execute(id, dto.kind);
  }

  @Get('media-assets/:id/url')
  getUrl (@Param('id', ParseUUIDPipe) id: string) {
    return this.getMediaAssetUrlUseCase.execute(id);
  }
}
