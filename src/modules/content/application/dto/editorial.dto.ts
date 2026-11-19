import { ArrayMaxSize, IsArray, IsString, MaxLength, ValidateIf } from 'class-validator';

const provided = (_: unknown, value: unknown) => value !== undefined;

export class EditorialDto {
  @ValidateIf(provided) @IsString() @MaxLength(4000) brief?: string;
  @ValidateIf(provided) @IsString() @MaxLength(2200) caption?: string;
  @ValidateIf(provided) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) tags?: string[];
}
