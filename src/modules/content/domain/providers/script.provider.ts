export type ScriptBrief = { brand: string; objective: string | null; guidelines: string; products: string[]; brief?: string };

export abstract class ScriptProvider {
  abstract generate(brief: ScriptBrief): Promise<string>;
}
