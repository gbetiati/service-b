import { IsString, MaxLength } from 'class-validator';
import { Trim, ValidateIfProvided } from '@/shared/core/validation/decorators';

// Primeira tela do onboarding: o site e o @ do Instagram da empresa (pelo menos um dos dois).
export class StartOnboardingDto {
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(300) websiteUrl?: string;
  @Trim() @ValidateIfProvided() @IsString() @MaxLength(100) instagramHandle?: string;
}
