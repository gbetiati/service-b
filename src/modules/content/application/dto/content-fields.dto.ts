import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsNotEmpty, IsObject, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { EditorialDto } from './editorial.dto';

const provided = (_: unknown, value: unknown) => value !== undefined;

export class ContentFieldsDto {
  @ValidateIf(provided) @IsArray() @ArrayUnique() @ArrayMaxSize(10) @IsUUID(undefined, { each: true }) productIds?: string[];
  @ValidateIf(provided) @IsString() @IsNotEmpty() @MaxLength(12000) aiScript?: string;
  @ValidateIf(provided) @IsObject() @ValidateNested() @Type(() => EditorialDto) editorial?: EditorialDto;
  @ValidateIf(provided) @IsArray() @ArrayUnique() @ArrayMaxSize(5) @IsUUID(undefined, { each: true }) mediaAssetIds?: string[];
}
