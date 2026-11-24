import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError, ErrorKind } from './app.error';

const statusByKind: Record<ErrorKind, number> = { invalid: 400, unauthorized: 401, missing: 404, conflict: 409, upstream: 502, unavailable: 503 };
const conflictCodes = ['P2002', 'P2003', 'P2034'];
const notFoundCode = 'P2025';

@Catch(AppError, Prisma.PrismaClientKnownRequestError)
export class AppErrorFilter implements ExceptionFilter {
  catch (error: AppError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const { status, message } = this.describe(error);
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message });
  }

  private describe (error: AppError | Prisma.PrismaClientKnownRequestError) {
    if (error instanceof AppError) return { status: statusByKind[error.kind], message: error.message };

    if (conflictCodes.includes(error.code)) return { status: 409, message: 'Os dados conflitam com um registro existente.' };

    if (error.code === notFoundCode) return { status: 404, message: 'Registro não encontrado.' };

    return { status: 500, message: 'Falha ao processar a operação.' };
  }
}
