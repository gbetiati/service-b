import { IsIn } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';
import { PRODUCT_AD_TEMPLATES, VIDEO_AD_TEMPLATES } from '../../infra/remotion/product-ad.compositions';

// Template escolhido para o render. Omitido: sorteado entre os templates do tipo do conteúdo (foto ou vídeo).
export class GenerateVideoDto {
  @ValidateIfProvided() @IsIn([...PRODUCT_AD_TEMPLATES, ...VIDEO_AD_TEMPLATES]) template?: string;
}
