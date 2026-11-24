import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '@/shared/core/validation/decorators';

export class CreateBrandDto {
  @Trim()
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
}
