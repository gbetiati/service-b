import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '@/shared/core/validation/decorators';
import { ContentStatus } from '../../domain/entities/content-status';
import { ContentPageDto } from './content-page.dto';

// Filtros da listagem de conteúdos. Todos opcionais e combinados com E.
export class ListContentDto extends ContentPageDto {
  // Busca pelo nome do produto principal, pelo nome da campanha ou pelo id do conteúdo.
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
  // Produto principal ou produto adicional do conteúdo.
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}
