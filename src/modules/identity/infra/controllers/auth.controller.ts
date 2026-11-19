import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { LoginDto } from '../../application/dto/login.dto';
import { SignupDto } from '../../application/dto/signup.dto';
import { LoginUseCase } from '../../application/use-cases/login.usecase';
import { SignupUseCase } from '../../application/use-cases/signup.usecase';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly signupUseCase: SignupUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.signupUseCase.execute(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }
}
