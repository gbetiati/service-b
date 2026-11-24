import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';

export class InstagramCallbackDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/) state!: string;
  @ValidateIfProvided() @IsString() @IsNotEmpty() @MaxLength(4096) code?: string;
  @ValidateIfProvided() @IsString() @MaxLength(160) error?: string;
  @ValidateIfProvided() @IsString() @MaxLength(4096) error_description?: string;
  @ValidateIfProvided() @IsString() @MaxLength(160) error_reason?: string;
}
