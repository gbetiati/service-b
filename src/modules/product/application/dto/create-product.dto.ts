import { IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min, IsUUID } from 'class-validator';
import { ValidateIfProvided, Trim } from '@/shared/core/validation/decorators';

export class CreateProductDto {
  @Trim()
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsUUID() brandId!: string;
  @ValidateIfProvided() @IsString() @MaxLength(4000) description?: string;
  @ValidateIfProvided() @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }) @Min(0) @Max(9_999_999_999.99) price?: number;
  @ValidateIfProvided() @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }) @Min(0) @Max(9_999_999_999.99) oldPrice?: number;
}
