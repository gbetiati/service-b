import { randomUUID } from 'node:crypto';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { ContentAsset } from './content-asset.entity';
import { ContentMediaType, mediaMatchesType, mediaTypeLabel } from './content-media-type';
import { ContentStatus } from './content-status';
import type { BrandVoice, ScriptContext } from '../providers/script.provider';

export const CONTENT_MAX_MEDIA_ASSETS = 5;
export const CONTENT_MAX_SCRIPT_LENGTH = 12000;

export type PreparationStatus = 'NOT_STARTED' | 'PENDING' | 'READY' | 'FAILED';

export type Editorial = { brief?: string; caption?: string; tags?: string[] };

// Áudio do anúncio: música de fundo e locução do roteiro por voz sintetizada. Sem nenhuma, o vídeo sai mudo.
export type ContentAudio = { backgroundMusic: boolean; voiceover: boolean };

export const SILENT_AUDIO: ContentAudio = { backgroundMusic: false, voiceover: false };

// Aplica as opções enviadas sobre as atuais; as omitidas (undefined) ficam como estão.
export function mergeAudio (current: ContentAudio, changes: Partial<ContentAudio> = {}): ContentAudio {
  return {
    backgroundMusic: changes.backgroundMusic ?? current.backgroundMusic,
    voiceover: changes.voiceover ?? current.voiceover,
  };
}

export type ContentFields = {
  campaingId: string;
  campaingRulesId: string;
  productId: string;
  productIds: string[];
  aiScript: string;
  editorial: Editorial;
  audio: ContentAudio;
  // Fotos ou vídeos: define quais mídias o conteúdo aceita e quais templates montam o anúncio.
  contentMediaType: ContentMediaType;
  assets: ContentAsset[];
};

export type ContentFieldChanges = Partial<Omit<ContentFields, 'assets' | 'audio'>> & { audio?: Partial<ContentAudio>; mediaAssetIds?: string[] };

export type ReferencedBrand = {
  name: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
  voiceTone: string | null;
  targetAudience: string | null;
  copyGuidelines: string | null;
  logoStorageKey?: string | null;
};

export type ContentReferences = {
  campaign: { brandId: string; objective: string | null; brand: ReferencedBrand | null } | null;
  rule: { campaingId: string; guidelines: string } | null;
  products: { id: string; brandId: string; name: string; description: string | null }[];
  // Mídias associadas ao conteúdo, de qualquer tipo; validateReferences confere se batem com contentMediaType.
  media: { id: string; productId: string; storageKey: string; contentType: string; kind: string }[];
};

export class Content {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly fields: ContentFields,
    readonly revision: number,
    readonly status: ContentStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly scriptStatus: PreparationStatus,
    readonly videoStatus: PreparationStatus,
    readonly transcriptionStatus: PreparationStatus = 'NOT_STARTED',
    readonly transcription: string | null = null,
    readonly subtitleStatus: PreparationStatus = 'NOT_STARTED',
    // Revisão humana da revisão atual: true aprovado, false reprovado, null aguardando (todo conteúdo novo ou revisado).
    readonly humanApprove: boolean | null = null,
  ) {}

  static create (companyId: string, fields: ContentFields) {
    const now = new Date();
    return new Content(randomUUID(), companyId, fields, 1, ContentStatus.WAITING, now, now, Content.scriptStatusFor(fields.aiScript), 'NOT_STARTED');
  }

  // Um roteiro informado dispensa a etapa de geração por IA.
  static scriptStatusFor (aiScript: string): PreparationStatus {
    return aiScript.trim() ? 'READY' : 'NOT_STARTED';
  }

  assertRevision (expected: number | undefined) {
    if (expected !== this.revision) throw new AppError('conflict', 'A revisão informada está desatualizada.');
  }

  revise (fields: ContentFields) {
    return new Content(this.id, this.companyId, fields, this.revision + 1, ContentStatus.WAITING, this.createdAt, new Date(), Content.scriptStatusFor(fields.aiScript), 'NOT_STARTED');
  }

  // Aprovação ou reprovação humana da revisão informada (a que a pessoa viu). Aprovar exige o vídeo pronto: é ele que
  // vai ao ar. Reprovar vale a qualquer momento.
  assertReviewable (revision: number, approved: boolean) {
    this.assertRevision(revision);

    if (approved && this.videoStatus !== 'READY') throw new AppError('conflict', 'Gere o vídeo do conteúdo antes de aprová-lo.');
  }

  // Cria a próxima revisão mantendo os campos que não foram alterados.
  reviseWith ({ mediaAssetIds, ...changes }: ContentFieldChanges) {
    const { fields } = this;
    return this.revise({
      campaingId: changes.campaingId ?? fields.campaingId, campaingRulesId: changes.campaingRulesId ?? fields.campaingRulesId,
      productId: changes.productId ?? fields.productId, productIds: changes.productIds ?? fields.productIds,
      aiScript: changes.aiScript ?? fields.aiScript, editorial: changes.editorial ?? fields.editorial,
      audio: mergeAudio(fields.audio, changes.audio), contentMediaType: changes.contentMediaType ?? fields.contentMediaType,
      assets: mediaAssetIds ? ContentAsset.fromMediaAssetIds(mediaAssetIds) : fields.assets,
    });
  }

  get allProductIds () {
    if (this.fields.productIds.includes(this.fields.productId)) {
      throw new AppError('invalid', 'Use productIds somente para produtos adicionais.');
    }

    return [this.fields.productId, ...this.fields.productIds];
  }

  validateReferences ({ campaign, rule, products, media }: ContentReferences) {
    const productIds = this.allProductIds;
    const { brandId, brand, objective } = requireRecord(campaign, 'Campanha');

    if (!rule || rule.campaingId !== this.fields.campaingId) {
      throw new AppError('invalid', 'A regra deve pertencer à campanha.');
    }

    if (media.length !== this.fields.assets.length || media.some(item => !productIds.includes(item.productId))) {
      throw new AppError('invalid', 'As mídias devem pertencer aos produtos selecionados.');
    }

    const { contentMediaType } = this.fields;

    if (media.some(item => !mediaMatchesType(item.contentType, contentMediaType))) {
      throw new AppError('invalid', `Um conteúdo de ${mediaTypeLabel(contentMediaType)} só aceita ${mediaTypeLabel(contentMediaType, true)}.`);
    }

    const orderedProducts = productIds.map(id => {
      const product = products.find(item => item.id === id);

      if (!product || product.brandId !== brandId) {
        throw new AppError('invalid', 'Os produtos devem pertencer à marca da campanha.');
      }

      return product;
    });

    return { brand: requireRecord(brand, 'Marca'), objective, rule, products: orderedProducts };
  }

  buildScriptContext (references: ContentReferences): ScriptContext {
    const { brand, objective, rule, products } = this.validateReferences(references);
    return {
      brand: brand.name,
      objective,
      guidelines: rule.guidelines,
      products: products.map(product => product.description ? product.name + ': ' + product.description : product.name),
      brief: this.fields.editorial.brief,
      ...(this.fields.contentMediaType === ContentMediaType.VIDEO && { mediaType: ContentMediaType.VIDEO }),
      ...brandVoice(brand),
    };
  }
}

// Campos vazios ficam de fora para não poluir o contexto enviado à IA.
function brandVoice ({ voiceTone, targetAudience, copyGuidelines }: ReferencedBrand): BrandVoice {
  return { ...(voiceTone && { voiceTone }), ...(targetAudience && { targetAudience }), ...(copyGuidelines && { copyGuidelines }) };
}
