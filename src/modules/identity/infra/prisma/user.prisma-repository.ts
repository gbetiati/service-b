import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async createWithCompany (name: string, email: string, passwordHash: string) {
    const row = await this.prismaService.user.create({ data: { email, passwordHash, company: { create: { name } } } });
    return new User(row.id, row.companyId, row.email, row.passwordHash);
  }

  async findByEmail (email: string) {
    const row = await this.prismaService.user.findUnique({ where: { email } });
    return row && new User(row.id, row.companyId, row.email, row.passwordHash);
  }

  async exists (id: string, companyId: string) {
    return !!await this.prismaService.user.findUnique({ where: { companyId_id: { companyId, id } }, select: { id: true } });
  }
}
