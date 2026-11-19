import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, IsUUID, ValidateIf } from 'class-validator';

const provided = (_: unknown, value: unknown) => value !== undefined;

export class CreateProductDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsUUID() brandId!: string;
  @ValidateIf(provided) @IsUUID() categoryId?: string;
  @ValidateIf(provided) @IsString() @MaxLength(4000) description?: string;
}
