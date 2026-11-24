import { IsInt, IsUUID, Min } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';
import { ContentFieldsDto } from './content-fields.dto';

export class UpdateContentDto extends ContentFieldsDto {
  @ValidateIfProvided() @IsInt() @Min(1) revision!: number;
  @IsUUID() campaingId?: string;
  @ValidateIfProvided() @IsUUID() campaingRulesId?: string;
  @ValidateIfProvided() @IsUUID() productId?: string;
}
