import { IsInt, Min, ValidateIf } from 'class-validator';

export class PreparePublicationDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  regenerateFromRevision?: number;
}
