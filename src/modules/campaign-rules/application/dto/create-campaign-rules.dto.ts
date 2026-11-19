import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, IsUUID } from 'class-validator';

export class CreateCampaignRulesDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsUUID() campaingId!: string;
  @IsString() @IsNotEmpty() @MaxLength(8000) guidelines!: string;
}
