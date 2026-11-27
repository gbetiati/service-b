import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsObject, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CreateBrandDto } from '@/modules/brand/application/dto/create-brand.dto';
import { Trim, ValidateIfProvided } from '@/shared/core/validation/decorators';

// Dados da empresa revisados pelo usuário. Campos vazios ficam sem valor.
export class CompanyProfileDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(300) website?: string;
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(100) instagramHandle?: string;
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(120) segment?: string;
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(600) description?: string;
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(40) phone?: string;
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(300) serviceArea?: string;
}

// Conclusão do onboarding: a empresa e a marca principal revisadas. Com `sessionId`, os dados vieram da varredura e
// `useFoundLogo` importa o logo encontrado nela; sem sessão, é o preenchimento manual.
export class CompleteOnboardingDto {
  @ValidateIfProvided() @IsUUID() sessionId?: string;
  @IsObject() @ValidateNested() @Type(() => CompanyProfileDto) company!: CompanyProfileDto;
  @IsObject() @ValidateNested() @Type(() => CreateBrandDto) brand!: CreateBrandDto;
  @ValidateIfProvided() @IsBoolean() useFoundLogo?: boolean;
}
