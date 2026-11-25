import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ValidateIfProvided } from '@/shared/core/validation/decorators';

// Enviado pelo frontend com o retorno do Instagram. O nonce fica na aba que iniciou a conexão e nunca passa pelo Instagram.
export class CompleteInstagramConnectionDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/) state!: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) nonce!: string;
  @ValidateIfProvided() @IsString() @IsNotEmpty() @MaxLength(4096) code?: string;
  @ValidateIfProvided() @IsString() @MaxLength(160) error?: string;
}
