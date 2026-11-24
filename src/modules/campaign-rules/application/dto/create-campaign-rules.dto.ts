import { IsNotEmpty, IsString, MaxLength, IsUUID } from 'class-validator';
import { Trim } from '@/shared/core/validation/decorators';

export class CreateCampaignRulesDto {
  @Trim()
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsUUID() campaingId!: string;
  @IsString() @IsNotEmpty() @MaxLength(8000) guidelines!: string;
}
