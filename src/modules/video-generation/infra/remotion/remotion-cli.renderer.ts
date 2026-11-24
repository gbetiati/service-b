import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '@/shared/core/errors/app.error';
import type { ProductAdProps } from '../../domain/entities/product-ad';

// Variáveis repassadas ao processo do Remotion. Segredos do backend (chaves, DATABASE_URL etc.) não são herdados.
const INHERITED_ENV = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'NODE_ENV', 'XDG_CACHE_HOME'];

export type RemotionRenderJob = { compositionId: string; props: ProductAdProps; outputPath: string; timeoutMs: number };

type Execute = (file: string, args: string[], options: { cwd: string; timeout: number; maxBuffer: number; env: NodeJS.ProcessEnv; killSignal: NodeJS.Signals }) => Promise<unknown>;

// Renderiza localmente pela CLI do projeto video/, com execFile (sem shell) e as props em arquivo temporário.
@Injectable()
export class RemotionCliRenderer {
  private readonly logger = new Logger(RemotionCliRenderer.name);
  protected execute: Execute = promisify(execFile);

  constructor(
    private readonly config: ConfigService,
  ) {}

  async render ({ compositionId, props, outputPath, timeoutMs }: RemotionRenderJob) {
    if (!/^[A-Za-z0-9-]+$/.test(compositionId)) throw new AppError('invalid', 'Template de vídeo inválido.');
    if (!isAbsolute(outputPath)) throw new AppError('invalid', 'Caminho de saída do render precisa ser absoluto.');

    const projectDir = resolve(this.config.get<string>('REMOTION_DIR')?.trim() || join(process.cwd(), 'video'));
    const entry = this.config.get<string>('REMOTION_ENTRY')?.trim() || 'src/index.ts';
    const chromeMode = this.config.get<string>('REMOTION_CHROME_MODE')?.trim();
    const directory = await mkdtemp(join(tmpdir(), 'service-b-render-props-'));
    const propsPath = join(directory, 'props.json');

    try {
      await writeFile(propsPath, JSON.stringify(props), { encoding: 'utf8', mode: 0o600 });
      const args = ['render', entry, compositionId, outputPath, `--props=${propsPath}`, '--log=error', ...(chromeMode ? [`--chrome-mode=${chromeMode}`] : [])];
      await this.execute(join(projectDir, 'node_modules', '.bin', 'remotion'), args, {
        cwd: projectDir, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: this.childEnv(), killSignal: 'SIGTERM',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const failure = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string; stderr?: string };
      if (failure.code === 'ENOENT') throw new AppError('unavailable', 'Remotion não instalado. Execute npm ci em video/.');
      this.logger.warn(`Render falhou. composition=${compositionId} killed=${!!failure.killed} signal=${failure.signal ?? 'n/a'} stderr=${sanitize(failure.stderr)}`);
      throw new AppError('upstream', failure.killed ? 'O render excedeu o tempo limite.' : 'Falha ao renderizar o vídeo.');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private childEnv () {
    return Object.fromEntries(Object.entries(process.env).filter(([key]) => INHERITED_ENV.includes(key) || key.startsWith('REMOTION_')));
  }
}

// Remove URLs (podem ser assinadas) e limita o tamanho antes de logar.
function sanitize (stderr?: string) {
  return (stderr ?? '').replace(/https?:\/\/\S+/g, '[url]').replace(/\s+/g, ' ').trim().slice(-1500);
}
