import { IsEnum } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';
import { MediaAssetKind } from '../../domain/entities/media-asset-kind';

// Tipo informado no upload (?kind=PERSON). Omitido: PRODUCT.
export class UploadMediaAssetQueryDto {
  @ValidateIfProvided() @IsEnum(MediaAssetKind) kind?: MediaAssetKind;
}

export class UpdateMediaAssetKindDto {
  @IsEnum(MediaAssetKind) kind!: MediaAssetKind;
}
