import { IsInt, IsUUID, Min, ValidateIf } from 'class-validator';
import { ContentFieldsDto } from './content-fields.dto';

const provided = (_: unknown, value: unknown) => value !== undefined;

export class UpdateContentDto extends ContentFieldsDto {
  @IsInt() @Min(1) revision!: number;
  @ValidateIf(provided) @IsUUID() campaingId?: string;
  @ValidateIf(provided) @IsUUID() campaingRulesId?: string;
  @ValidateIf(provided) @IsUUID() productId?: string;
}
