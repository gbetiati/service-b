import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { CampaignRepository } from '../../domain/repositories/campaign.repository';

// Exclui a campanha junto com as regras dela. Recusa se algum conteúdo ou agendamento depende dela.
@Injectable()
export class DeleteCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
  ) {}

  async execute (id: string) {
    if (!await this.campaignRepository.delete(id)) throw new AppError('missing', 'Campanha não encontrada.');
  }
}
