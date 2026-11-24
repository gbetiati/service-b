import { IsInt, Min } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';

export class PreparePublicationDto {
  @ValidateIfProvided() @IsInt() @Min(1) regenerateFromRevision?: number;
}
