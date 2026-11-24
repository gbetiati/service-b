import { IsISO8601, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';

export class PublicationScheduleFieldsDto {
  @ValidateIf((_, value) => value !== undefined) @IsUUID() videoId?: string;
  @IsUUID() socialAccountId!: string;
  @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) date!: string;
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(2200) caption?: string;
}

export class SchedulePublicationDto extends PublicationScheduleFieldsDto {
  @IsUUID() contentId!: string;
}
