import { randomUUID } from 'node:crypto';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { ContentAsset } from './content-asset.entity';
import { ContentStatus } from './content-status';
import type { BrandVoice, ScriptBrief } from '../providers/script.provider';

export const CONTENT_MAX_MEDIA_ASSETS = 5;
export const CONTENT_MAX_SCRIPT_LENGTH = 12000;

export type PreparationStatus = 'NOT_STARTED' | 'PENDING' | 'READY' | 'FAILED';

export type Editorial = { brief?: string; caption?: string; tags?: string[] };

export type ContentFields = {
  campaingId: string;
  campaingRulesId: string;
  productId: string;
  productIds: string[];
  aiScript: string;
  editorial: Editorial;
  assets: ContentAsset[];
};

export type ContentFieldChanges = Partial<Omit<ContentFields, 'assets'>> & { mediaAssetIds?: string[] };

export type ReferencedBrand = {
  name: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
  voiceTone: string | null;
  targetAudience: string | null;
  copyGuidelines: string | null;
};

export type ContentReferences = {
  campaign: { brandId: string; objective: string | null; brand: ReferencedBrand | null } | null;
  rule: { campaingId: string; guidelines: string } | null;
  products: { id: string; brandId: string; name: string; description: string | null }[];
  images: { id: string; productId: string; storageKey: string }[];
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

  // Cria a próxima revisão mantendo os campos que não foram alterados.
  reviseWith ({ mediaAssetIds, ...changes }: ContentFieldChanges) {
    const { fields } = this;
    return this.revise({
      campaingId: changes.campaingId ?? fields.campaingId, campaingRulesId: changes.campaingRulesId ?? fields.campaingRulesId,
      productId: changes.productId ?? fields.productId, productIds: changes.productIds ?? fields.productIds,
      aiScript: changes.aiScript ?? fields.aiScript, editorial: changes.editorial ?? fields.editorial,
      assets: mediaAssetIds ? ContentAsset.fromMediaAssetIds(mediaAssetIds) : fields.assets,
    });
  }

  get allProductIds () {
    if (this.fields.productIds.includes(this.fields.productId)) {
      throw new AppError('invalid', 'Use productIds somente para produtos adicionais.');
    }

    return [this.fields.productId, ...this.fields.productIds];
  }

  validateReferences ({ campaign, rule, products, images }: ContentReferences) {
    const productIds = this.allProductIds;
    const { brandId, brand, objective } = requireRecord(campaign, 'Campanha');

    if (!rule || rule.campaingId !== this.fields.campaingId) {
      throw new AppError('invalid', 'A regra deve pertencer à campanha.');
    }

    if (images.length !== this.fields.assets.length || images.some(image => !productIds.includes(image.productId))) {
      throw new AppError('invalid', 'As imagens devem pertencer aos produtos selecionados.');
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

  buildScriptBrief (references: ContentReferences): ScriptBrief {
    const { brand, objective, rule, products } = this.validateReferences(references);
    return {
      brand: brand.name,
      objective,
      guidelines: rule.guidelines,
      products: products.map(product => product.description ? product.name + ': ' + product.description : product.name),
      brief: this.fields.editorial.brief,
      ...brandVoice(brand),
    };
  }
}

// Campos vazios ficam de fora para não poluir o brief enviado à IA.
function brandVoice ({ voiceTone, targetAudience, copyGuidelines }: ReferencedBrand): BrandVoice {
  return { ...(voiceTone && { voiceTone }), ...(targetAudience && { targetAudience }), ...(copyGuidelines && { copyGuidelines }) };
}
