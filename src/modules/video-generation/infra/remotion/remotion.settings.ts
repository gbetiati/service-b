type Env = { get<T = string> (key: string): T | undefined };

// Configuração do provider Remotion, validada na inicialização.
export class RemotionSettings {
  constructor(
    readonly maxConcurrentRenders: number,
    readonly renderTimeoutMs: number,
    readonly primaryColor: string,
    readonly webhookUrl: string,
  ) {}

  static fromEnv (env: Env) {
    const int = (key: string, fallback: number, min: number, max: number) => {
      const raw = env.get(key)?.toString().trim();
      const value = raw ? Number(raw) : fallback;

      if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} precisa ser um inteiro entre ${min} e ${max}.`);

      return value;
    };
    const color = env.get('REMOTION_PRIMARY_COLOR')?.trim() || '#2563eb';

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('REMOTION_PRIMARY_COLOR precisa ser uma cor hexadecimal como #2563eb.');

    // O webhook é interno: por padrão, a própria instância que renderizou recebe o aviso pela interface local.
    const webhookUrl = env.get('REMOTION_WEBHOOK_URL')?.trim() || `http://127.0.0.1:${env.get('PORT')?.toString().trim() || '3000'}/webhooks/remotion`;

    if (!URL.canParse(webhookUrl) || !/^https?:$/.test(new URL(webhookUrl).protocol)) throw new Error('REMOTION_WEBHOOK_URL precisa ser uma URL HTTP ou HTTPS.');

    return new RemotionSettings(
      int('REMOTION_MAX_CONCURRENT_RENDERS', 1, 1, 16),
      int('REMOTION_RENDER_TIMEOUT_MS', 300_000, 10_000, 3_600_000),
      color.toLowerCase(),
      webhookUrl,
    );
  }
}
