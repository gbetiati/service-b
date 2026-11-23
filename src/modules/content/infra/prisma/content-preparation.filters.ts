import type { Prisma } from '@prisma/client';

const videoReady = { scriptStatus: 'READY', videoStatus: 'READY' } as const;
const transcribed = { ...videoReady, transcriptionStatus: 'READY' } as const;
export const preparationReady = { ...transcribed, subtitleStatus: 'READY' } as const;

export const preparationFailed = {
  OR: [{ scriptStatus: 'FAILED' }, { videoStatus: 'FAILED' }, { transcriptionStatus: 'FAILED' }, { subtitleStatus: 'FAILED' }],
} satisfies Prisma.ContentWhereInput;

export function runnablePreparation (now: Date): Prisma.ContentWhereInput {
  return {
    NOT: preparationFailed,
    OR: [
      { scriptStatus: 'NOT_STARTED' },
      { scriptStatus: 'READY', videoStatus: 'NOT_STARTED' },
      { ...videoReady, transcriptionStatus: 'NOT_STARTED' },
      { ...transcribed, subtitleStatus: 'NOT_STARTED' },
      { ...transcribed, subtitleStatus: 'PENDING', subtitleLeaseUntil: { lte: now } },
    ],
  };
}
