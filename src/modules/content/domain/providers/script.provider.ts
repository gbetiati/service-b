// Identidade de comunicação da marca. Os campos só aparecem quando cadastrados.
export type BrandVoice = { voiceTone?: string; targetAudience?: string; copyGuidelines?: string };

export type ScriptBrief = { brand: string; objective: string | null; guidelines: string; products: string[]; brief?: string } & BrandVoice;

export type ScriptOutcome = { script: string } | { error: string };
export type ScriptResult = { submissionId: string; outcome: ScriptOutcome };

// `generate` responde na hora. `request` é assíncrono: o resultado chega depois por webhook, ligado ao `submissionId`.
export abstract class ScriptProvider {
  abstract generate (brief: ScriptBrief): Promise<string>;

  abstract request (brief: ScriptBrief, submissionId: string): Promise<void>;
}
