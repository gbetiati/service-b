const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { PublicationPolicy } = require('../dist/modules/publication/domain/entities/publication.policy');
const { PublicationOrchestrator } = require('../dist/modules/publication/application/use-cases/publication.orchestrator');
const { PublishScheduledContentUseCase } = require('../dist/modules/publication/application/use-cases/publish-scheduled-content.usecase');
const {
  DEFAULT_DEFER_MS, PUBLICATION_GRACE_MS, PUBLICATION_PREPARATION_MS,
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

test('publication policy uses the preparation window and an exclusive grace deadline', () => {
  const date = new Date('2026-11-19T17:00:00Z');
  const deadline = date.getTime() + PUBLICATION_GRACE_MS;
  assert.equal(PublicationPolicy.calculateInitialAttemptAt(date, true).getTime(), date.getTime());
  assert.equal(PublicationPolicy.calculateInitialAttemptAt(date, false).getTime(), date.getTime() - PUBLICATION_PREPARATION_MS);
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
    claim: async () => claimed ? job : null,

    fail: record('fail'),
    markReady: record('markReady'),
    defer: record('defer'),
    waitForVideo: record('waitForVideo'),
  };
  const generator = {
    ensureGenerationStarted: async command => {
      effects.push(['generate', command]);
      return startRender();
    },
  };
  const publisher = { execute: record('publish') };
  const reader = {
    readVideo: async () => {
      effects.push(['readVideo']);
      return { video: null, approved: false, generationStatus: null, ...videoState };
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
  assert.deepEqual(invalid.effects, [['fail', invalid.job, 'A conta precisa ter uma credencial ativa para publicar.']]);
});

test('publication orchestrator rejects a disapproved video and hands an approved one to the publisher', async () => {
  const video = { id: 'video', storageKey: 'video.mp4' };
  const rejected = setup({ videoState: { video } });
  await rejected.orchestrator.execute(rejected.job.id);
  assert.deepEqual(rejected.effects.map(([name]) => name), ['readVideo', 'fail']);

  const approved = setup({ videoState: { video, approved: true } });
  await approved.orchestrator.execute(approved.job.id);
  assert.deepEqual(approved.effects, [
    ['readVideo'],
    ['markReady', approved.job, 'video'],
    ['publish', approved.job, 'video.mp4', approved.job.credential],
  ]);
});

test('publication orchestrator distinguishes a missing, pending, rendering, or failed generation', async () => {
  for (const [status, mode] of [[null, 'generate-script'], ['PENDING_SCRIPT', 'submit-pending'], ['PENDING', 'submit-pending']]) {
    const flow = setup({ videoState: { generationStatus: status } });
    await flow.orchestrator.execute(flow.job.id);
    assert.deepEqual(flow.effects, [
      ['readVideo'],
      ['generate', { companyId: 'company', contentId: 'content', mode }],
      ['waitForVideo', flow.job, PublicationPolicy.graceDeadline(flow.job.schedule.date)],
    ]);
  }

  for (const status of ['SCRIPT_GENERATING', 'SUBMITTING', 'RENDERING']) {
    const waiting = setup({ videoState: { generationStatus: status } });
    await waiting.orchestrator.execute(waiting.job.id);
    assert.deepEqual(waiting.effects.map(([name]) => name), ['readVideo', 'waitForVideo']);
  }

  const failed = setup({ videoState: { generationStatus: 'FAILED' } });
  await failed.orchestrator.execute(failed.job.id);
  assert.deepEqual(failed.effects.map(([name]) => name), ['readVideo', 'fail']);

  const pending = setup({
    videoState: { generationStatus: 'PENDING' },

    startRender: async () => ({ status: 'FAILED' }),
  });
  await pending.orchestrator.execute(pending.job.id);
  assert.deepEqual(pending.effects.map(([name]) => name), ['readVideo', 'generate', 'fail']);
});

test('publication orchestrator times out waiting for video and schedules a single retry on a temporary error', async () => {
  const expired = setup({
    overrides: { schedule: { date: new Date(Date.now() - PUBLICATION_GRACE_MS), contentId: 'content' } },
    videoState: { generationStatus: 'RENDERING' },
  });
  await expired.orchestrator.execute(expired.job.id);
  assert.deepEqual(expired.effects, [['readVideo'], ['fail', expired.job, 'O prazo expirou antes de o vídeo ficar pronto.']]);

  const retry = setup({ startRender: async () => {
    throw new Error('failure');
  } });
  await retry.orchestrator.execute(retry.job.id);
  assert.deepEqual(retry.effects.map(([name]) => name), ['readVideo', 'generate', 'defer']);
});

test('a ready Instagram container is deferred until the actual publication time', async () => {
  const date = new Date(Date.now() + DEFAULT_DEFER_MS);
  const job = { schedule: { date }, containerId: 'container' };
  const deferred = [];
  let publishes = 0;
  const publisher = new PublishScheduledContentUseCase(
    { defer: async (...args) => {
      deferred.push(args);
    } },
    { containerStatus: async () => 'ready',

      publish: async () => {
      publishes++;
    } },
    { decrypt: () => 'token' },
    {},
  );
  await publisher.execute(job, 'video.mp4', {});
  assert.equal(publishes, 0);
  assert.deepEqual(deferred, [[job, undefined, date]]);
});
