import { Injectable, Logger } from '@nestjs/common';
import { internalWebhookUrl, requiredEnv } from '@/shared/core/config';
import { SignedWebhookClient } from '@/shared/libs/http/signed-webhook.client';
import { ScriptBrief, ScriptProvider } from '../../domain/providers/script.provider';
import { CLAUDE_SCRIPT_WEBHOOK_PATH } from './claude-script.provider';

// TESTE (mock): roteiro fixo no formato de cenas, escrito a partir do brief da Amira Doces (Brownie).
export const MOCK_SCRIPT = [
  'Gancho: Bateu vontade de um doce caseiro?',
  'Benefícios:',
  '- Brownie de chocolate feito à mão',
  '- Muito chocolate em cada pedaço',
  '- Entregamos em Balneário Camboriú e Itajaí',
  'Chamada: Peça o seu brownie',
].join('\n');

// TESTE (mock): substitui o Claude enquanto não há ANTHROPIC_API_KEY. Responde pelo mesmo caminho do
// ClaudeScriptProvider, inclusive o webhook interno assinado no modo assíncrono.
@Injectable()
export class MockScriptProvider implements ScriptProvider {
  private readonly logger = new Logger(MockScriptProvider.name);

  constructor(
    private readonly webhookClient: SignedWebhookClient,
  ) {}

  async generate (brief: ScriptBrief) {
    this.logger.warn(`Roteiro simulado (mock) para a marca "${brief.brand}".`);
    return MOCK_SCRIPT;
  }

  async request (brief: ScriptBrief, submissionId: string) {
    const secret = requiredEnv('INTERNAL_WEBHOOK_SECRET');
    const script = await this.generate(brief);
    setImmediate(() => {
      void this.webhookClient.send(internalWebhookUrl(CLAUDE_SCRIPT_WEBHOOK_PATH), secret, { submissionId, outcome: { script } });
    });
  }
}
