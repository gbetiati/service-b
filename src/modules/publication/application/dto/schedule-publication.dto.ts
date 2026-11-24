import { IsISO8601, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';

export class PublicationScheduleFieldsDto {
  @ValidateIfProvided() @IsUUID() videoId?: string;
  @IsUUID() socialAccountId!: string;
  @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) date!: string;
  @ValidateIfProvided() @IsString() @MaxLength(2200) caption?: string;
}

export class SchedulePublicationDto extends PublicationScheduleFieldsDto {
  @IsUUID() contentId!: string;
}
