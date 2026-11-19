import { IsISO8601, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';

export class SchedulePublicationDto {
  @IsUUID() contentId!: string;
  @IsUUID() videoId!: string;
  @IsUUID() socialAccountId!: string;
  @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) date!: string;
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(2200) caption?: string;
}
