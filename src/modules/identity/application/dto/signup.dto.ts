import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '@/shared/core/validation/decorators';
import { LoginDto } from './login.dto';

export class SignupDto extends LoginDto {
  @Trim()
  @IsString() @IsNotEmpty() @MaxLength(160) companyName!: string;
}
