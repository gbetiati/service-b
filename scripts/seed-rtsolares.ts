// Cadastra Brand, Campaign, CampaignRules e Product da RT Solares numa Company existente.
// Uso: npx tsx scripts/seed-rtsolares.ts <companyId>
// Idempotente: se a company já tem uma Brand "RT Solares", para sem inserir nada.
import { PrismaClient } from '@prisma/client';

const BRAND_NAME = 'RT Solares';

const brand = {
  name: BRAND_NAME,
  primaryColor: null,
  secondaryColor: null,
  tertiaryColor: null,
  quaternaryColor: null,
  voiceTone: 'Leve, descontraído e confiante, com clima de verão. Linguagem próxima e animada, sem exageros e sem gírias pesadas.',
  targetAudience: 'Homens e mulheres que buscam óculos de sol com estilo e proteção para o verão, praia, viagens e o dia a dia.',
  copyGuidelines: 'Destacar estilo, conforto e proteção contra o sol no verão. Usar cenários de praia, sol, viagem e lazer. Fechar com uma chamada para comprar. Não inventar preços, descontos, materiais, certificações ou características que não estejam no cadastro do produto.',
};

const campaign = {
  name: 'Verão RT Solares',
  objective: 'Vender óculos de sol aproveitando a temporada de verão, mostrando o produto em situações de sol, praia e lazer.',
};

const rules = [
  {
    name: 'Diretrizes gerais',
    guidelines: 'Divulgar somente o produto cadastrado, sem mostrar ou citar outros modelos, marcas ou acessórios. Não criar produtos, cores, modelos, preços, promoções ou características novas. Usar apenas as informações do cadastro do produto. Um produto por conteúdo, com o produto sempre em destaque. Terminar com uma chamada para comprar.',
  },
  {
    name: 'Clima de verão',
    guidelines: 'Ambientar os conteúdos no verão: sol, praia, piscina, viagem e passeios ao ar livre. Tom alegre e leve, com visual claro e iluminado.',
  },
];

const product = {
  name: 'Óculos LG',
  description: 'Óculos de sol LG da RT Solares, para curtir o verão com estilo e proteção.',
  price: null,
  oldPrice: null,
};

class AlreadySeeded extends Error {}

async function main () {
  const companyId = process.argv[2];

  if (!companyId) throw new Error('Informe o companyId: npx tsx scripts/seed-rtsolares.ts <companyId>');

  const prisma = new PrismaClient();

  try {
    const result = await prisma.$transaction(async tx => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });

      if (!company) throw new Error(`Company ${companyId} não encontrada.`);

      const existing = await tx.brand.findFirst({ where: { companyId, name: BRAND_NAME }, select: { id: true } });

      if (existing) throw new AlreadySeeded(`A company "${company.name}" já tem a Brand "${BRAND_NAME}" (id ${existing.id}). Nada foi inserido.`);

      const createdBrand = await tx.brand.create({ data: { ...brand, companyId } });
      const createdCampaign = await tx.campaign.create({ data: { ...campaign, companyId, brandId: createdBrand.id } });

      for (const rule of rules) await tx.campaignRules.create({ data: { ...rule, companyId, campaingId: createdCampaign.id } });

      await tx.product.create({ data: { ...product, companyId, brandId: createdBrand.id } });

      return { company, brandId: createdBrand.id };
    });

    // Conferência no banco, fora da transação: o que ficou gravado de fato.
    const saved = await prisma.brand.findUniqueOrThrow({
      where: { id: result.brandId },
      select: {
        id: true, name: true,
        campaigns: { select: { id: true, name: true, rules: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' } } } },
        products: { select: { id: true, name: true, price: true, oldPrice: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    console.log(`Company: ${result.company.name} (${result.company.id})`);
    console.log(`Brand: ${saved.name} (${saved.id})`);

    for (const c of saved.campaigns) {
      console.log(`  Campaign: ${c.name} (${c.id})`);

      for (const r of c.rules) console.log(`    Rule: ${r.name} (${r.id})`);
    }

    for (const p of saved.products) console.log(`  Product: ${p.name} (${p.id}) price=${p.price} oldPrice=${p.oldPrice}`);
  } catch (error) {
    if (error instanceof AlreadySeeded) {
      console.log(error.message);
      return;
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
