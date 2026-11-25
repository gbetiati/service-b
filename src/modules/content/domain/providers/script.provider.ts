// Identidade de comunicação da marca. Os campos só aparecem quando cadastrados.
export type BrandVoice = { voiceTone?: string; targetAudience?: string; copyGuidelines?: string };

// Contexto que o backend monta para a IA escrever o roteiro: marca, objetivo da campanha, diretrizes das regras, produtos
// e o briefing escrito pelo usuário (`editorial.brief`, aqui em `brief`). Não confundir com o briefing em si.
export type ScriptContext = { brand: string; objective: string | null; guidelines: string; products: string[]; brief?: string } & BrandVoice;

export type ScriptOutcome = { script: string } | { error: string };
export type ScriptResult = { submissionId: string; outcome: ScriptOutcome };

// `generate` responde na hora. `request` é assíncrono: o resultado chega depois por webhook, ligado ao `submissionId`.
export abstract class ScriptProvider {
  abstract generate (context: ScriptContext): Promise<string>;

  abstract request (context: ScriptContext, submissionId: string): Promise<void>;
}
