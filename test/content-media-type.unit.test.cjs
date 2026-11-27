const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { Content } = require('../dist/modules/content/domain/entities/content.entity');
const { ContentAsset } = require('../dist/modules/content/domain/entities/content-asset.entity');
const { ContentMediaType, mediaMatchesType } = require('../dist/modules/content/domain/entities/content-media-type');
const { ProcessScheduledContentUseCase } = require('../dist/modules/publication/application/use-cases/process-scheduled-content.usecase');
const { RequestContext } = require('../dist/shared/core/request-context/request-context');

Logger.overrideLogger(false);

const fields = (contentMediaType, assets = [new ContentAsset(0, 'media-1')]) => ({
  campaingId: 'campaign', campaingRulesId: 'rule', productId: 'product', productIds: [], aiScript: '', editorial: {},
  audio: { backgroundMusic: false, voiceover: false }, contentMediaType, assets,
});
const references = contentType => ({
  campaign: { brandId: 'brand', objective: null, brand: { name: 'Marca', primaryColor: null, secondaryColor: null, voiceTone: null, targetAudience: null, copyGuidelines: null } },
  rule: { campaingId: 'campaign', guidelines: 'g' },
  products: [{ id: 'product', brandId: 'brand', name: 'Limpeza de vidros', description: null }],
  media: [{ id: 'media-1', productId: 'product', storageKey: 'k', contentType }],
});

test('mediaMatchesType accepts only photos for IMAGE and only videos for VIDEO', () => {
  assert.equal(mediaMatchesType('image/jpeg', ContentMediaType.IMAGE), true);
  assert.equal(mediaMatchesType('video/mp4', ContentMediaType.IMAGE), false);
  assert.equal(mediaMatchesType('video/mp4', ContentMediaType.VIDEO), true);
  assert.equal(mediaMatchesType('image/jpeg', ContentMediaType.VIDEO), false);
});

test('a content only accepts media of its own type, and only video content brings the video hook guide to the script', () => {
  const video = Content.create('company', fields(ContentMediaType.VIDEO));
  assert.equal(video.buildScriptContext(references('video/mp4')).mediaType, 'VIDEO');
  assert.throws(() => video.buildScriptContext(references('image/jpeg')), /Um conteúdo de vídeo só aceita vídeos\./);

  const photo = Content.create('company', fields(ContentMediaType.IMAGE));
  assert.equal('mediaType' in photo.buildScriptContext(references('image/jpeg')), false, 'photo content keeps the same script context as before');
  assert.throws(() => photo.buildScriptContext(references('video/mp4')), /Um conteúdo de foto só aceita fotos\./);
});

test('a revision keeps the media type unless it is changed', () => {
  const content = Content.create('company', fields(ContentMediaType.VIDEO));
  assert.equal(content.reviseWith({ aiScript: 'novo' }).fields.contentMediaType, 'VIDEO');
  assert.equal(content.reviseWith({ contentMediaType: ContentMediaType.IMAGE, mediaAssetIds: [] }).fields.contentMediaType, 'IMAGE');
});

test('a scheduled draft creates its content with the product videos when it asks for video, and with the photos otherwise', async () => {
  const media = [
    { id: 'photo-1', contentType: 'image/jpeg' }, { id: 'video-1', contentType: 'video/mp4' }, { id: 'photo-2', contentType: 'image/jpeg' }, { id: 'video-2', contentType: 'video/mp4' },
  ];
  const run = async (draft, available = media) => {
    const prepared = [];
    const failed = [];
    const schedules = {
      claimDraft: async () => ({ id: 'schedule', companyId: 'company', contentDraft: draft }),
      attachCreatedContent: async () => true,
      failDraft: async (_, message) => failed.push(message),
    };
    const createContent = { prepare: async dto => { prepared.push(dto); return { id: 'content' }; } };
    await new ProcessScheduledContentUseCase(schedules, createContent, { findByProduct: async () => available }, new RequestContext()).execute('schedule');
    return { prepared, failed };
  };
  const draft = { campaingId: 'c', campaingRulesId: 'r', productId: 'p' };

  const video = await run({ ...draft, contentMediaType: 'VIDEO' });
  assert.deepEqual(video.prepared[0].mediaAssetIds, ['video-1', 'video-2']);
  assert.equal(video.prepared[0].contentMediaType, 'VIDEO');

  const photo = await run(draft);
  assert.deepEqual(photo.prepared[0].mediaAssetIds, ['photo-1', 'photo-2'], 'drafts saved before the media type keep using photos');
  assert.equal(photo.prepared[0].contentMediaType, 'IMAGE');

  const missing = await run({ ...draft, contentMediaType: 'VIDEO' }, media.filter(item => item.contentType.startsWith('image/')));
  assert.deepEqual(missing.failed, ['Associe ao menos um vídeo real ao produto para criar o conteúdo.']);
});
