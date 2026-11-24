import { Type } from 'class-transformer';
import { IsObject, IsUUID, ValidateNested } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';
import type { ScheduledContentDraft } from '../../domain/repositories/content-schedule.repository';
import { PublicationScheduleFieldsDto } from './schedule-publication.dto';

class ScheduledContentDraftDto implements ScheduledContentDraft {
  @IsUUID() campaingId!: string;
  @IsUUID() campaingRulesId!: string;
  @IsUUID() productId!: string;
}

export class CreateScheduledPublicationDto extends PublicationScheduleFieldsDto {
  @ValidateIfProvided() @IsUUID() contentId?: string;
  @ValidateIfProvided() @IsObject() @ValidateNested() @Type(() => ScheduledContentDraftDto) contentDraft?: ScheduledContentDraftDto;
}
