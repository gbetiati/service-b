import { Injectable } from '@nestjs/common';
import { OnboardingSession as Row, Prisma } from '@prisma/client';
import { Brand } from '@/modules/brand/domain/entities/brand.entity';
import { PrismaService } from '@/prisma/prisma.service';
import { AppError } from '@/shared/core/errors/app.error';
import { OnboardingFindings, OnboardingSession, OnboardingStage } from '../../domain/entities/onboarding-session.entity';
import { CompletedProfile, OnboardingSessionRepository } from '../../domain/repositories/onboarding-session.repository';

@Injectable()
export class PrismaOnboardingSessionRepository implements OnboardingSessionRepository {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  create ({ companyId, userId, websiteUrl, instagramHandle }: { companyId: string; userId: string; websiteUrl: string | null; instagramHandle: string | null }) {
    return this.prismaService.serializable(async tx => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { onboardedAt: true } });

      if (!company) throw new AppError('missing', 'Empresa não encontrada.');

      if (company.onboardedAt) throw new AppError('conflict', 'A empresa já concluiu o onboarding.');

      if (await tx.onboardingSession.count({ where: { companyId, status: 'RESEARCHING' } })) throw new AppError('conflict', 'Já existe uma análise em andamento.');

      return this.toDomain(await tx.onboardingSession.create({ data: { companyId, userId, websiteUrl, instagramHandle } }));
    });
  }

  async findLatest (companyId: string) {
    const row = await this.prismaService.onboardingSession.findFirst({ where: { companyId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return row && this.toDomain(row);
  }

  async findById (companyId: string, id: string) {
    const row = await this.prismaService.onboardingSession.findFirst({ where: { companyId, id } });
    return row && this.toDomain(row);
  }

  claimNext (leaseMs: number) {
    const now = new Date();
    return this.prismaService.$transaction(async tx => {
      const candidate = await tx.onboardingSession.findFirst({
        where: { status: 'RESEARCHING', OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, orderBy: { createdAt: 'asc' }, select: { id: true, leaseUntil: true },
      });

      if (!candidate) return null;

      // Reserva condicional: se outro processo pegou a mesma sessão, o updateMany não encontra nada.
      const claimed = await tx.onboardingSession.updateMany({
        where: { id: candidate.id, status: 'RESEARCHING', leaseUntil: candidate.leaseUntil }, data: { leaseUntil: new Date(now.getTime() + leaseMs), attempts: { increment: 1 } },
      });

      if (!claimed.count) return null;

      const row = await tx.onboardingSession.findUniqueOrThrow({ where: { id: candidate.id } });
      return Object.assign(this.toDomain(row), { attempts: row.attempts });
    });
  }

  async setStage (id: string, stage: OnboardingStage) {
    await this.prismaService.onboardingSession.updateMany({ where: { id, status: 'RESEARCHING' }, data: { stage } });
  }

  async markReady (id: string, findings: OnboardingFindings) {
    await this.prismaService.onboardingSession.updateMany({
      where: { id, status: 'RESEARCHING' }, data: { status: 'READY', stage: null, findings: findings as unknown as Prisma.InputJsonValue, error: null, leaseUntil: null },
    });
  }

  async markFailed (id: string, error: string) {
    await this.prismaService.onboardingSession.updateMany({ where: { id, status: 'RESEARCHING' }, data: { status: 'FAILED', stage: null, error: error.slice(0, 1000), leaseUntil: null } });
  }

  async release (id: string) {
    await this.prismaService.onboardingSession.updateMany({ where: { id, status: 'RESEARCHING' }, data: { leaseUntil: null } });
  }

  complete (companyId: string, sessionId: string | null, { company, brand }: CompletedProfile) {
    return this.prismaService.serializable(async tx => {
      const current = await tx.company.findUnique({ where: { id: companyId }, select: { onboardedAt: true } });

      if (!current) throw new AppError('missing', 'Empresa não encontrada.');

      if (current.onboardedAt) throw new AppError('conflict', 'A empresa já concluiu o onboarding.');

      const { name, ...profile } = brand;
      const entity = Brand.create(companyId, name, profile);
      await tx.brand.create({ data: { ...entity, companyId } });
      await tx.company.update({ where: { id: companyId }, data: { ...company, onboardedAt: new Date() } });

      if (sessionId) await tx.onboardingSession.updateMany({ where: { id: sessionId, companyId }, data: { status: 'COMPLETED', leaseUntil: null } });

      return { brandId: entity.id };
    });
  }

  private toDomain (row: Row) {
    return new OnboardingSession(
      row.id, row.companyId, row.userId, row.websiteUrl, row.instagramHandle, row.status, row.stage as OnboardingStage | null,
      row.findings as unknown as OnboardingFindings | null, row.error, row.createdAt, row.updatedAt,
    );
  }
}
