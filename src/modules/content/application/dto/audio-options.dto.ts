import { IsBoolean } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';
import type { ContentAudio } from '../../domain/entities/content.entity';

// Opções de áudio do anúncio. Campos omitidos mantêm o valor atual (ou `false` num conteúdo novo).
export class AudioOptionsDto implements Partial<ContentAudio> {
  @ValidateIfProvided() @IsBoolean() backgroundMusic?: boolean;
  @ValidateIfProvided() @IsBoolean() voiceover?: boolean;
}
