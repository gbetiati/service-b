import { IsUUID } from 'class-validator';
import { ContentFieldsDto } from './content-fields.dto';

export class CreateContentDto extends ContentFieldsDto {
  @IsUUID() campaingId!: string;
  @IsUUID() campaingRulesId!: string;
  @IsUUID() productId!: string;
}
