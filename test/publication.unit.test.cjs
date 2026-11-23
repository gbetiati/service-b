const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { PublicationPolicy } = require('../dist/modules/publication/domain/entities/publication.policy');
const { PublicationOrchestrator } = require('../dist/modules/publication/application/use-cases/publication.orchestrator');
const { PublishScheduledContentUseCase } = require('../dist/modules/publication/application/use-cases/publish-scheduled-content.usecase');
const {
  PUBLICATION_GRACE_MS,
} = require('../dist/modules/publication/domain/entities/publication-timing');

Logger.overrideLogger(false);

test('publication policy requires a token valid after both the scheduled and actual execution times', () => {
  const now = Date.parse('2026-11-19T17:00:00Z');
  const scheduled = new Date(now + 60_000);
  const past = new Date(now - 60_000);

  const canPublish = (active, expiresAt, date = scheduled) =>
    PublicationPolicy.canPublishWithCredential(active, { expiresAt }, date, now);

  assert.equal(canPublish(true, new Date(scheduled.getTime() + 1)), true);
  assert.equal(canPublish(true, scheduled), false);
  assert.equal(canPublish(true, new Date(now), past), false);
  assert.equal(canPublish(true, new Date(now + 1), past), true);
  assert.equal(canPublish(false, new Date(scheduled.getTime() + 1)), false);
  assert.equal(canPublish(true, null), false);
  assert.equal(PublicationPolicy.canPublishWithCredential(true, null, scheduled, now), false);
});

test('publication policy uses an exclusive grace deadline', () => {
  const date = new Date('2026-11-19T17:00:00Z');
  const deadline = date.getTime() + PUBLICATION_GRACE_MS;
  assert.equal(PublicationPolicy.isWithinGraceWindow(date, deadline - 1), true);
  assert.equal(PublicationPolicy.isWithinGraceWindow(date, deadline), false);
});

test('publication policy accepts only approved videos of the current approved or ready revision', () => {
  assert.equal(PublicationPolicy.isApprovedVideo('READY', 2, 'APPROVED', 2), true);
  assert.equal(PublicationPolicy.isApprovedVideo('APPROVED', 2, 'APPROVED', 2), true);
  assert.equal(PublicationPolicy.isApprovedVideo('WAITING', 2, 'APPROVED', 2), false);
  assert.equal(PublicationPolicy.isApprovedVideo('READY', 2, 'REPROVED', 2), false);
  assert.equal(PublicationPolicy.isApprovedVideo('READY', 2, 'APPROVED', 1), false);
});

const input = { companyId: 'company', contentId: 'content' };
const video = { id: 'video', storageKey: 'captioned.mp4', revision: 2, reviewStatus: 'APPROVED' };
const ready = { scriptStatus: 'READY', videoStatus: 'READY', transcriptionStatus: 'READY', subtitleStatus: 'READY' };

function setup (state = {}, { start = async () => ({ status: 'PENDING' }) } = {}) {
  const effects = [];
  const record = name => async (...args) => { effects.push([name, ...args]); };
  const request = name => async command => {
    effects.push([name, command]);
    return start();
  };
  const preparation = {
    request: record('request'),
    complete: record('complete'),
    read: async command => {
      effects.push(['read', command]);
      return {
        revision: 2, video: null, status: 'READY',
        scriptStatus: 'NOT_STARTED', videoStatus: 'NOT_STARTED', transcriptionStatus: 'NOT_STARTED', subtitleStatus: 'NOT_STARTED',
        ...state,
      };
    },
  };
  const generator = { requestScript: request('script'), requestVideo: request('video') };
  const orchestrator = new PublicationOrchestrator(
    generator, preparation, { execute: request('transcription') }, { execute: request('subtitles') }, { companyId: 'company' },
    { execute: async (...args) => { effects.push(['revise', ...args]); return { revision: 2 }; } },
  );
  return { orchestrator, effects };
}

test('starting preparation persists the tenant-owned content request and advances the first incomplete stage', async () => {
  const stages = [
    ['scriptStatus', 'script'], ['videoStatus', 'video'], ['transcriptionStatus', 'transcription'], ['subtitleStatus', 'subtitles'],
  ];
  for (const [field, action] of stages) {
    const flow = setup({ ...ready, [field]: 'NOT_STARTED' });
    assert.equal((await flow.orchestrator.start(input.contentId)).status, 'PENDING');
    assert.deepEqual(flow.effects, [['request', input], ['read', input], [action, { ...input, revision: 2 }]]);
  }
});

test('regeneration creates a revision and requests a fresh render with the existing script', async () => {
  const { orchestrator, effects } = setup({ scriptStatus: 'READY' });
  assert.deepEqual(await orchestrator.start(input.contentId, 1), {
    contentId: input.contentId, revision: 2, status: 'PENDING',
  });
  assert.deepEqual(effects, [
    ['revise', input.contentId, { revision: 1 }, true],
    ['read', input],
    ['video', { ...input, revision: 2 }],
  ]);
});

test('preparation waits for a pending webhook and leaves publication creation to a completed, approved revision', async () => {
  const pending = setup({ ...ready, transcriptionStatus: 'PENDING', video });
  assert.equal((await pending.orchestrator.execute(input)).status, 'PENDING');
  assert.deepEqual(pending.effects, [['read', input]]);

  const approved = setup({ ...ready, video });
  assert.equal((await approved.orchestrator.execute(input)).status, 'READY');
  assert.deepEqual(approved.effects, [['read', input], ['complete', input, 2]]);

  const rejected = setup({ ...ready, video: { ...video, reviewStatus: 'REPROVED' } });
  assert.equal((await rejected.orchestrator.execute(input)).error, 'Use um vídeo aprovado da revisão atual do conteúdo.');
  assert.deepEqual(rejected.effects, [
    ['read', input], ['complete', input, 2],
  ]);
});

test('preparation records a stage failure without starting later work', async () => {
  const failed = setup({ ...ready, transcriptionStatus: 'FAILED' });
  assert.equal((await failed.orchestrator.execute(input)).status, 'FAILED');
  assert.deepEqual(failed.effects, [['read', input], ['complete', input, 2]]);

  const providerError = setup({}, { start: async () => { throw new Error('failure'); } });
  assert.equal((await providerError.orchestrator.execute(input)).status, 'FAILED');
  assert.deepEqual(providerError.effects, [
    ['read', input], ['script', { ...input, revision: 2 }], ['complete', input, 2],
  ]);
});

test('the scheduler calls the publication repository only for ready content with a schedule', async () => {
  const { PublicationScheduler } = require('../dist/modules/publication/infra/schedule/publication.scheduler');
  const effects = [];
  const candidates = ['pending', 'failed', 'ready', 'unscheduled'].map(contentId => ({
    companyId: input.companyId, contentId, updatedAt: new Date(0),
  }));
  const [pending, failed, ready, unscheduled] = candidates;
  const outcomes = {
    pending: { status: 'PENDING' },
    failed: { status: 'FAILED', revision: 2, error: 'Falhou.' },
    ready: { status: 'READY', revision: 2, videoId: video.id },
    unscheduled: { status: 'READY', revision: 2, videoId: video.id },
  };
  const scheduler = new PublicationScheduler(
    { createFromPreparedContent: async content => effects.push(['create', content]) },
    { execute: async ({ contentId }) => outcomes[contentId] },
    { findEligibleContents: async () => [ready, unscheduled] },
    {
      expireSchedules: async () => {},
      findEligibleContents: async () => [pending, failed, ready],
      failPreparation: async (content, revision, error) => effects.push(['failed', { ...content, revision, error }]),
    },
    {},
  );

  await scheduler.prepare();
  assert.deepEqual(effects, [
    ['failed', { companyId: 'company', contentId: 'failed', revision: 2, error: 'Falhou.' }],
    ['create', { companyId: 'company', contentId: 'ready', revision: 2, videoId: video.id }],
  ]);
});

test('the publication phase checks credentials before reading the prepared video', async () => {
  const job = { ...input, id: 'publication', credential: null, schedule: { contentId: 'content', date: new Date() } };
  const effects = [];
  const publisher = new PublishScheduledContentUseCase(
    {
      reserveForProcessing: async id => id === job.id ? job : null,
      markFailed: async (...args) => effects.push(args),
    },
    {}, {}, {}, { read: async () => assert.fail('Deve validar a credencial primeiro.') },
  );

  await publisher.processScheduled('unclaimed');
  assert.deepEqual(effects, []);
  await publisher.processScheduled(job.id);
  assert.deepEqual(effects, [[job, 'A conta precisa ter uma credencial ativa para publicar.']]);
});

test('a ready Instagram container is released without contacting Instagram before the scheduled time', async () => {
  const job = { schedule: { date: new Date(Date.now() + 60_000) }, containerId: 'container' };
  const released = [];
  const publisher = new PublishScheduledContentUseCase(
    { releaseProcessing: async (...args) => released.push(args) },
    {},
    {},
    {},
  );
  await publisher.execute(job, 'video.mp4', {});
  assert.deepEqual(released, [[job]]);
});

test('a failed video download marks the video stage as failed', async () => {
  const { CompleteVideoGenerationUseCase } = require('../dist/modules/video-generation/application/use-cases/complete-video-generation.usecase');
  const generation = { id: 'generation', companyId: 'company', contentId: 'content', revision: 1 };
  const failures = [];
  const useCase = new CompleteVideoGenerationUseCase(
    {
      claimCompletion: async () => ({ generation, claimed: true }),
      fail: async (...args) => failures.push(args),
    },
    { download: async () => { throw new Error('MP4 unavailable'); } },
    {},
    {},
  );

  const result = await useCase.execute({
    submissionId: 'submission', providerId: 'provider', outcome: { state: 'ready', url: 'https://cdn.invalid/render.mp4' },
  });
  assert.equal(result, generation);
  assert.deepEqual(failures, [[generation, 'Falha ao baixar ou salvar o vídeo.']]);
});
