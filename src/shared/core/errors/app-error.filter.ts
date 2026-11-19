import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from './app.error';

@Catch(AppError, Prisma.PrismaClientKnownRequestError)
export class AppErrorFilter implements ExceptionFilter {
  catch(error: AppError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost)
  {
    const codes = { invalid: 400, unauthorized: 401, missing: 404, conflict: 409, upstream: 502, unavailable: 503 };
    let status = 500;
    let message = 'Falha ao processar a operação.';
    if (error instanceof AppError) {
      status = codes[error.kind];
      message = error.message;
    } else if (['P2002', 'P2003', 'P2034'].includes(error.code)) {
      status = 409;
      message = 'Os dados conflitam com um registro existente.';
    } else if (error.code === 'P2025') {
      status = 404;
      message = 'Registro não encontrado.';
    }
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message });
  }
}
