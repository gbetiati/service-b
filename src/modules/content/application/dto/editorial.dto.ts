import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';

export class EditorialDto {
  @ValidateIfProvided() @IsString() @MaxLength(4000) brief?: string;
  @ValidateIfProvided() @IsString() @MaxLength(2200) caption?: string;
  @ValidateIfProvided() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) tags?: string[];
}
