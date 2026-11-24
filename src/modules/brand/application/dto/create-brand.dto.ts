import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Trim, ValidateIfProvided } from '@/shared/core/validation/decorators';

const hexColor = /^#[0-9a-fA-F]{6}$/;
const hexColorMessage = 'Informe a cor em hexadecimal, como #2563eb.';

export class CreateBrandDto {
  @Trim()
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;

  @ValidateIfProvided() @Matches(hexColor, { message: hexColorMessage }) primaryColor?: string;
  @ValidateIfProvided() @Matches(hexColor, { message: hexColorMessage }) secondaryColor?: string;
  @ValidateIfProvided() @Matches(hexColor, { message: hexColorMessage }) tertiaryColor?: string;
  @ValidateIfProvided() @Matches(hexColor, { message: hexColorMessage }) quaternaryColor?: string;

  // Como a marca fala, por exemplo "acolhedor, artesanal e próximo".
  @Trim() @ValidateIfProvided() @IsString() @IsNotEmpty() @MaxLength(300) voiceTone?: string;
  // Para quem a marca fala, por exemplo "famílias que buscam doces caseiros para presentear".
  @Trim() @ValidateIfProvided() @IsString() @IsNotEmpty() @MaxLength(300) targetAudience?: string;
  // Orientações para os textos: o que destacar, palavras a usar e a evitar.
  @Trim() @ValidateIfProvided() @IsString() @IsNotEmpty() @MaxLength(1000) copyGuidelines?: string;
}
