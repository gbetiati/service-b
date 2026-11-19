import { Injectable } from '@nestjs/common';
import { BrandRepository } from '@/modules/brand/domain/repositories/brand.repository';
import { CampaignRepository } from '@/modules/campaign/domain/repositories/campaign.repository';
import { CampaignRulesRepository } from '@/modules/campaign-rules/domain/repositories/campaign-rules.repository';
import { MediaAssetRepository } from '@/modules/media-asset/domain/repositories/media-asset.repository';
import { ProductRepository } from '@/modules/product/domain/repositories/product.repository';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { Content } from '../../domain/entities/content.entity';

@Injectable()
export class ContentCatalogService {
  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly campaignRulesRepository: CampaignRulesRepository,
    private readonly productRepository: ProductRepository,
    private readonly mediaAssetRepository: MediaAssetRepository,
  ) {}

  async resolve (content: Content) {
    const { campaingId, campaingRulesId, assets, editorial } = content.fields;
    
    const productIds = content.allProductIds;
    
    const [campaign, rule, products, images] = await Promise.all([
      this.campaignRepository.findById(campaingId), this.campaignRulesRepository.findById(campaingRulesId),
      Promise.all(productIds.map(id => this.productRepository.findById(id))), this.mediaAssetRepository.findByIds(assets.map(asset => asset.mediaAssetId)),
    ]);
    
    const { brandId, objective } = requireRecord(campaign, 'Campanha');
    
    if (!rule || rule.campaingId !== campaingId) throw new AppError('invalid', 'A regra deve pertencer à campanha.');
    
    if (images.length !== assets.length || images.some(image => !productIds.includes(image.productId))) {
      throw new AppError('invalid', 'As imagens devem pertencer aos produtos selecionados.');
    }
    
    const productDescriptions = products.map(product => {
      if (!product || product.brandId !== brandId) throw new AppError('invalid', 'Os produtos devem pertencer à marca da campanha.');

      return product.description ? product.name + ': ' + product.description : product.name;
    });
    
    const brand = requireRecord(await this.brandRepository.findById(brandId), 'Marca');
    
    return { brand: brand.name, objective, guidelines: rule.guidelines, products: productDescriptions, brief: editorial.brief };
  }
}
