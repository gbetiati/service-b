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

function setup ({ overrides = {}, videoState = {}, startRender = async () => ({ status: 'RENDERING' }), claimed = true } = {}) {
  const date = new Date(Date.now() + 60_000);
  const job = {
    id: 'publication', companyId: 'company', accountActive: true,
    schedule: { date, contentId: 'content', videoId: null },
    credential: { expiresAt: new Date(date.getTime() + 60_000) },
    ...overrides,
  };
  const effects = [];

  const record = name => async (...args) => {
    effects.push([name, ...args]);
  };

  const repository = {
    reserveForProcessing: async () => claimed ? job : null,

    markFailed: record('markFailed'),
    attachApprovedVideo: record('attachApprovedVideo'),
    releaseProcessing: record('releaseProcessing'),
  };
  const request = name => async command => {
    effects.push([name, command]);
    return startRender();
  };
  const generator = { requestScript: request('requestScript'), requestVideo: request('requestVideo') };
  const publisher = { execute: record('publish') };
  const reader = {
    readPreparationState: async () => {
      effects.push(['readPreparationState']);
      return { video: null, approved: false, scriptStatus: 'NOT_STARTED', videoStatus: 'NOT_STARTED', ...videoState };
    },
  };
  return { job, effects, orchestrator: new PublicationOrchestrator(repository, generator, publisher, reader) };
}

test('publication orchestrator skips work without a claim and rejects an invalid credential before reading video', async () => {
  const unclaimed = setup({ claimed: false });
  await unclaimed.orchestrator.execute(unclaimed.job.id);
  assert.deepEqual(unclaimed.effects, []);

  const invalid = setup({ overrides: { credential: null } });
  await invalid.orchestrator.execute(invalid.job.id);
  assert.deepEqual(invalid.effects, [['markFailed', invalid.job, 'A conta precisa ter uma credencial ativa para publicar.']]);
});

test('publication orchestrator rejects a disapproved video and hands an approved one to the publisher', async () => {
  const video = { id: 'video', storageKey: 'video.mp4' };
  const rejected = setup({ videoState: { video, scriptStatus: 'READY', videoStatus: 'READY' } });
  await rejected.orchestrator.execute(rejected.job.id, 'publication');
  assert.deepEqual(rejected.effects.map(([name]) => name), ['readPreparationState', 'markFailed']);

  const incomplete = setup({ videoState: { video, approved: true, scriptStatus: 'PENDING', videoStatus: 'READY', generationStatus: 'READY' } });
  await incomplete.orchestrator.execute(incomplete.job.id, 'publication');
  assert.deepEqual(incomplete.effects.map(([name]) => name), ['readPreparationState', 'releaseProcessing']);

  const approved = setup({ videoState: { video, approved: true, scriptStatus: 'READY', videoStatus: 'READY' } });
  await approved.orchestrator.execute(approved.job.id, 'publication');
  assert.deepEqual(approved.effects, [
    ['readPreparationState'],
    ['attachApprovedVideo', approved.job, 'video'],
    ['publish', approved.job, 'video.mp4', approved.job.credential],
  ]);
});

test('the preparation phase requests each provider only for a step that has not started', async () => {
  for (const [scriptStatus, request] of [['NOT_STARTED', 'requestScript'], ['READY', 'requestVideo']]) {
    const flow = setup({ videoState: { scriptStatus } });
    await flow.orchestrator.execute(flow.job.id, 'preparation');
    assert.deepEqual(flow.effects, [
      ['readPreparationState'],
      [request, { companyId: 'company', contentId: 'content' }],
      ['releaseProcessing', flow.job],
    ]);
  }

  for (const videoState of [{ scriptStatus: 'PENDING' }, { scriptStatus: 'READY', videoStatus: 'PENDING' }]) {
    const waiting = setup({ videoState });
    await waiting.orchestrator.execute(waiting.job.id, 'preparation');
    assert.deepEqual(waiting.effects.map(([name]) => name), ['readPreparationState', 'releaseProcessing']);
  }

  const rejected = setup({ videoState: { scriptStatus: 'READY', videoStatus: 'FAILED' } });
  await rejected.orchestrator.execute(rejected.job.id, 'preparation');
  assert.deepEqual(rejected.effects.map(([name]) => name), ['readPreparationState', 'markFailed']);
});

test('preparation fails on timeout or provider error', async () => {
  const expired = setup({
    overrides: { schedule: { date: new Date(Date.now() - PUBLICATION_GRACE_MS), contentId: 'content' } },
    videoState: { scriptStatus: 'PENDING' },
  });
  await expired.orchestrator.execute(expired.job.id, 'preparation');
  assert.deepEqual(expired.effects.map(([name]) => name), ['readPreparationState', 'markFailed']);

  const failure = setup({ startRender: async () => { throw new Error('failure'); } });
  await failure.orchestrator.execute(failure.job.id, 'preparation');
  assert.deepEqual(failure.effects.map(([name]) => name), ['readPreparationState', 'requestScript', 'markFailed']);
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
