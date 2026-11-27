const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Content } = require('../dist/modules/content/domain/entities/content.entity');
const { ContentAsset } = require('../dist/modules/content/domain/entities/content-asset.entity');
const { ContentMediaType } = require('../dist/modules/content/domain/entities/content-media-type');
const { ContentStatus } = require('../dist/modules/content/domain/entities/content-status');
const { ContentMapper } = require('../dist/modules/content/application/mappers/content.mapper');
const { ReviewContentUseCase } = require('../dist/modules/content/application/use-cases/review-content.usecase');
const { AppError } = require('../dist/shared/core/errors/app.error');

const fields = {
  campaingId: 'campaign', campaingRulesId: 'rule', productId: 'product', productIds: [], aiScript: 'Gancho: Oi', editorial: {},
  audio: { backgroundMusic: false, voiceover: false }, contentMediaType: ContentMediaType.VIDEO, assets: [new ContentAsset(0, 'media-1')],
};
const content = (videoStatus = 'READY', humanApprove = null) =>
  new Content('content', 'company', fields, 2, ContentStatus.READY, new Date(0), new Date(0), 'READY', videoStatus, 'READY', null, 'READY', humanApprove);

test('every content starts awaiting human review, and a new revision needs a new review', () => {
  assert.equal(Content.create('company', fields).humanApprove, null);
  assert.equal(ContentMapper.toResponse(content('READY', true)).humanApprove, true, 'the API returns the review');
  assert.equal(content('READY', true).reviseWith({ aiScript: 'Gancho: Novo' }).humanApprove, null);
});

test('ReviewContentUseCase approves only the reviewed revision with a ready video; reproving works any time', async () => {
  const saved = [];
  const repository = { findById: async () => content('PENDING'), setHumanApproval: async (...args) => { saved.push(args); return content('PENDING', args[2]); } };
  const useCase = new ReviewContentUseCase(repository);

  await assert.rejects(useCase.execute('content', { revision: 2, approved: true }), error => error instanceof AppError && error.kind === 'conflict' && /Gere o vídeo/.test(error.message));
  assert.equal((await useCase.execute('content', { revision: 2, approved: false })).humanApprove, false);
  await assert.rejects(useCase.execute('content', { revision: 1, approved: false }), /desatualizada/, 'a stale revision is refused');

  repository.findById = async () => content('READY');
  assert.equal((await useCase.execute('content', { revision: 2, approved: true })).humanApprove, true);
  assert.deepEqual(saved, [['content', 2, false], ['content', 2, true]]);

  repository.setHumanApproval = async () => null;
  await assert.rejects(useCase.execute('content', { revision: 2, approved: true }), /desatualizada/, 'a revision changed in the meantime is refused');
});
