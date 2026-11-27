// Cadastra Brand, Campaign, CampaignRules e Product da Fábrica de Salgados Dona Lu (@fabrica_donalu) numa Company existente.
// Uso: npx tsx scripts/seed-donalu.ts <companyId>
// Idempotente: se a company já tem a Brand, para sem inserir nada.
import { PrismaClient } from '@prisma/client';

const BRAND_NAME = 'Fábrica de Salgados Dona Lu';

const brand = {
  name: BRAND_NAME,
  primaryColor: null,
  secondaryColor: null,
  tertiaryColor: null,
  quaternaryColor: null,
  voiceTone: 'Alegre, caseiro e bem-humorado, com o jeito acolhedor de salgado feito na hora. Linguagem próxima e animada, que dá água na boca, sem exageros.',
  targetAudience: 'Moradores de Balneário Camboriú e região que querem salgados fritos para festas, aniversários, reuniões, lanches em família e no trabalho, recebendo em casa.',
  copyGuidelines: 'Usar o mote da marca "Proibido comer uma só!". Destacar salgados dourados, crocantes e bem recheados, que dão vontade de comer mais um. Lembrar que o cliente monta o cento escolhendo os salgados. Deixar claro que é delivery para Balneário Camboriú e região. Fechar com uma chamada para pedir pelo link. Não inventar preços, taxas, prazos de entrega, promoções, sabores ou quantidades que não estejam no cadastro.',
};

const campaign = {
  name: 'Delivery de salgados Dona Lu',
  objective: 'Gerar pedidos de delivery do cento de salgados em Balneário Camboriú e região, mostrando os salgados dourados e crocantes e que o cliente monta o cento escolhendo os sabores que quiser.',
};

const rules = [
  {
    name: 'Diretrizes gerais',
    guidelines: 'Divulgar somente o cento de salgados cadastrado, com os salgados listados: coxinhas, risoles, quibes e bolinhas de queijo. Não criar sabores, tamanhos, preços, promoções, taxas ou prazos de entrega. Mostrar os salgados sempre em destaque, dourados e crocantes. Terminar com uma chamada para pedir pelo link.',
  },
  {
    name: 'Somente delivery',
    guidelines: 'A venda é só por delivery em Balneário Camboriú e região. Nunca sugerir retirada no local, loja física, balcão ou consumo no local. Sempre deixar claro que o pedido é feito pelo link e chega em casa.',
  },
  {
    name: 'Monte seu cento',
    guidelines: 'Reforçar que o cliente escolhe quais salgados vêm no cento, combinando coxinhas, risoles, quibes e bolinhas de queijo como preferir. Sugerir ocasiões como festas, aniversários, reuniões e lanche em família, sem prometer quantidades por sabor que não estejam no cadastro.',
  },
];

const product = {
  name: 'Cento de salgados variados',
  description: 'Cento de salgados fritos para montar do seu jeito: você escolhe quais salgados vêm no seu cento entre coxinhas douradas e crocantes, risoles recheados, quibes fritos e bolinhas de queijo. Entrega em Balneário Camboriú e região.',
  price: null,
  oldPrice: null,
};

class AlreadySeeded extends Error {}

async function main () {
  const companyId = process.argv[2];

  if (!companyId) throw new Error('Informe o companyId: npx tsx scripts/seed-donalu.ts <companyId>');

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
