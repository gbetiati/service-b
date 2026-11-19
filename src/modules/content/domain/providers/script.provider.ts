export type ScriptBrief = { brand: string; objective: string | null; guidelines: string; products: string[]; brief?: string };

export type ScriptOutcome = { script: string } | { error: string };
export type ScriptResult = { submissionId: string; outcome: ScriptOutcome };

export abstract class ScriptProvider {
  abstract generate (brief: ScriptBrief): Promise<string>;

  abstract request (brief: ScriptBrief, submissionId: string): Promise<void>;

  abstract readResult (responseId: string): Promise<ScriptResult | null>;
}
