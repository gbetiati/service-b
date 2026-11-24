import { IsNotEmpty, IsString, MaxLength, IsUUID } from 'class-validator';
import { ValidateIfProvided, Trim } from '@/shared/core/validation/decorators';

export class CreateCampaignDto {
  @Trim()
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsUUID() brandId!: string;
  @ValidateIfProvided() @IsString() @MaxLength(4000) objective?: string;
}
