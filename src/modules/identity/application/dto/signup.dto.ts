import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim, ValidateIfProvided } from '@/shared/core/validation/decorators';
import { LoginDto } from './login.dto';

// O nome da empresa é informado no onboarding; aqui é opcional (sem ele, a empresa começa com um nome provisório).
export class SignupDto extends LoginDto {
  @Trim()
  @ValidateIfProvided() @IsString() @IsNotEmpty() @MaxLength(160) companyName?: string;
}
