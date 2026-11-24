import { Type } from 'class-transformer';
import { IsObject, IsUUID, ValidateIf, ValidateNested } from 'class-validator';
import type { ScheduledContentDraft } from '../../domain/repositories/content-schedule.repository';
import { PublicationScheduleFieldsDto } from './schedule-publication.dto';

class ScheduledContentDraftDto implements ScheduledContentDraft {
  @IsUUID() campaingId!: string;
  @IsUUID() campaingRulesId!: string;
  @IsUUID() productId!: string;
}

export class CreateScheduledPublicationDto extends PublicationScheduleFieldsDto {
  @ValidateIf((_, value) => value !== undefined) @IsUUID() contentId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => ScheduledContentDraftDto)
  contentDraft?: ScheduledContentDraftDto;
}
