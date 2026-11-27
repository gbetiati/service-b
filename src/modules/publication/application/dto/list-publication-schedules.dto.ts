import { IsEnum, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';

export class ListPublicationSchedulesDto {
  @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) from!: string;
  @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) to!: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}
