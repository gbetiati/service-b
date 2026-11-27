import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsObject, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';
import { CONTENT_MAX_MEDIA_ASSETS, CONTENT_MAX_SCRIPT_LENGTH } from '../../domain/entities/content.entity';
import { ContentMediaType } from '../../domain/entities/content-media-type';
import { AudioOptionsDto } from './audio-options.dto';
import { EditorialDto } from './editorial.dto';

export class ContentFieldsDto {
  @ValidateIfProvided() @IsArray() @ArrayUnique() @ArrayMaxSize(10) @IsUUID(undefined, { each: true }) productIds?: string[];
  @ValidateIfProvided() @IsString() @IsNotEmpty() @MaxLength(CONTENT_MAX_SCRIPT_LENGTH) aiScript?: string;
  @ValidateIfProvided() @IsObject() @ValidateNested() @Type(() => EditorialDto) editorial?: EditorialDto;
  @ValidateIfProvided() @IsObject() @ValidateNested() @Type(() => AudioOptionsDto) audio?: AudioOptionsDto;
  // Fotos ou vídeos. Omitido: IMAGE num conteúdo novo e o tipo atual numa revisão. As mídias precisam ser desse tipo.
  @ValidateIfProvided() @IsEnum(ContentMediaType) contentMediaType?: ContentMediaType;
  @ValidateIfProvided() @IsArray() @ArrayUnique() @ArrayMaxSize(CONTENT_MAX_MEDIA_ASSETS) @IsUUID(undefined, { each: true }) mediaAssetIds?: string[];
}
