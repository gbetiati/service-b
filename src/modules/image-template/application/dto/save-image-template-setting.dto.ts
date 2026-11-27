import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum } from 'class-validator';
import { MediaAssetKind } from '@/modules/media-asset/domain/entities/media-asset-kind';
import { IMAGE_TEMPLATE_SLOTS } from '../../domain/entities/image-template-setting';

// Tipo de foto preferido em cada cena, na ordem das cenas (abertura, benefícios, fechamento).
export class SaveImageTemplateSettingDto {
  @IsArray() @ArrayMinSize(IMAGE_TEMPLATE_SLOTS) @ArrayMaxSize(IMAGE_TEMPLATE_SLOTS) @IsEnum(MediaAssetKind, { each: true }) slotKinds!: MediaAssetKind[];
}
