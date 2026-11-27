// Antecedência com que o conteúdo agendado começa a ser preparado (roteiro, narração e vídeo): 2 h, para sobrar tempo
// para a revisão humana antes do horário da publicação.
export const PUBLICATION_PREPARATION_MS = 2 * 60 * 60_000;
export const PUBLICATION_GRACE_MS = 30 * 60_000;
export const CLAIM_LEASE_MS = 180_000;
export const PUBLICATION_CRON_BATCH_SIZE = 4;
