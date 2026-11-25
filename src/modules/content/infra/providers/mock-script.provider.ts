import { Injectable, Logger } from '@nestjs/common';
import { internalWebhookUrl, requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { SignedWebhookClient } from '@/shared/libs/http/signed-webhook.client';
import { AdScript, adScriptViolation, formatAdScript } from '../../domain/entities/ad-script';
import { ScriptContext, ScriptProvider, ScriptResult } from '../../domain/providers/script.provider';
import { CLAUDE_SCRIPT_WEBHOOK_PATH } from './claude-script.provider';

// TESTE (mock): roteiro fixo nas cenas do anúncio, escrito a partir do briefing da Amira Doces (Brownie).
export const MOCK_AD_SCRIPT: AdScript = {
  hook: 'Bateu vontade de um doce artesanal?',
  benefits: ['Brownie de chocolate feito à mão', 'Muito chocolate em cada pedaço', 'Entregamos em Balneário Camboriú e Itajaí'],
  callToAction: 'Peça o seu brownie',
};

export const MOCK_SCRIPT = formatAdScript(MOCK_AD_SCRIPT);

// TESTE (mock): substitui o Claude enquanto não há ANTHROPIC_API_KEY. Responde pelo mesmo caminho do
// ClaudeScriptProvider, inclusive o webhook interno assinado no modo assíncrono, e com a mesma garantia de formato:
// o roteiro só sai se respeitar AD_SCRIPT_LIMITS; se não, falha como uma resposta fora do formato do Claude.
@Injectable()
export class MockScriptProvider implements ScriptProvider {
  private readonly logger = new Logger(MockScriptProvider.name);
  // Roteiro devolvido. Substituível em testes.
  protected script: AdScript = MOCK_AD_SCRIPT;

  constructor(
    private readonly webhookClient: SignedWebhookClient,
  ) {}

  async generate (context: ScriptContext) {
    this.logger.warn(`Roteiro simulado (mock) para a marca "${context.brand}".`);
    const violation = adScriptViolation(this.script);

    if (violation) {
      this.logger.warn(`Roteiro simulado fora do formato: ${violation}.`);
      throw new AppError('upstream', 'O roteiro gerado não respeitou o formato esperado.');
    }

    return formatAdScript(this.script);
  }

  async request (context: ScriptContext, submissionId: string) {
    const secret = requiredEnv('INTERNAL_WEBHOOK_SECRET');
    let event: ScriptResult;
    try {
      event = { submissionId, outcome: { script: await this.generate(context) } };
    } catch (error) {
      event = { submissionId, outcome: { error: error instanceof AppError ? error.message : 'A IA não conseguiu concluir o roteiro.' } };
    }
    setImmediate(() => {
      void this.webhookClient.send(internalWebhookUrl(CLAUDE_SCRIPT_WEBHOOK_PATH), secret, event);
    });
  }
}
