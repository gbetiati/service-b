// Limita renders simultâneos neste processo (CPU e memória do Chrome). Excedentes aguardam em memória, em ordem de chegada.
export class RenderSemaphore {
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('O limite de renders simultâneos precisa ser um inteiro >= 1.');
  }

  get active () {
    return this.running;
  }

  get pending () {
    return this.waiting.length;
  }

  async run<T> (task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire () {
    if (this.running < this.limit) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => this.waiting.push(resolve));
  }

  private release () {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }
}
