import { IsNotEmpty, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export class InstagramCallbackDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/) state!: string;
  @ValidateIf((_, value) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(4096) code?: string;
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(160) error?: string;
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(4096) error_description?: string;
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(160) error_reason?: string;
}
