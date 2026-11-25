import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { MIN_REFRESH_AGE_MS, REFRESH_BEFORE_EXPIRY_MS } from '../../domain/entities/social-credential.entity';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';
import { RefreshInstagramTokenUseCase } from './refresh-instagram-token.usecase';

// Contas renovadas por execução do cron. As que ficarem de fora entram na próxima.
export const TOKEN_REFRESH_BATCH_SIZE = 50;

// Renova os tokens perto do vencimento e desconecta as contas cujo token já venceu. Uma falha não interrompe as outras contas.
@Injectable()
export class RefreshExpiringInstagramTokensUseCase {
  private readonly logger = new Logger(RefreshExpiringInstagramTokensUseCase.name);

  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly refreshInstagramTokenUseCase: RefreshInstagramTokenUseCase,
    private readonly requestContext: RequestContext,
  ) {}

  async execute (now = Date.now()) {
    const disconnected = await this.socialAccountRepository.disconnectExpired(new Date(now));

    if (disconnected) this.logger.warn(`Contas do Instagram desconectadas por token vencido. quantidade=${disconnected}`);

    const due = await this.socialAccountRepository.findCredentialsToRefresh(new Date(now + REFRESH_BEFORE_EXPIRY_MS), new Date(now - MIN_REFRESH_AGE_MS), TOKEN_REFRESH_BATCH_SIZE);
    let refreshed = 0;
    for (const { companyId, socialAccountId } of due) {
      try {
        await this.requestContext.runForCompany(companyId, () => this.refreshInstagramTokenUseCase.execute(socialAccountId));
        refreshed++;
      } catch (error) {
        const reason = error instanceof AppError ? error.message : 'erro inesperado';
        this.logger.warn(`Não foi possível renovar o token do Instagram. conta=${socialAccountId} motivo=${reason}`);
      }
    }
    return { disconnected, refreshed, failed: due.length - refreshed };
  }
}
