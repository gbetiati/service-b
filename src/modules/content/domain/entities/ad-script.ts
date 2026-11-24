// Roteiro estruturado nas cenas do anúncio (gancho, benefícios e chamada), salvo em `aiScript` num formato legível e editável.
export type AdScript = { hook: string; benefits: string[]; callToAction: string };

export const AD_SCRIPT_LIMITS = {
  hook: { min: 3, max: 40 },
  benefit: { min: 3, max: 50 },
  benefits: { min: 2, max: 4 },
  callToAction: { min: 2, max: 25 },
} as const;

const labels = { hook: 'Gancho:', benefits: 'Benefícios:', callToAction: 'Chamada:' } as const;

export function formatAdScript ({ hook, benefits, callToAction }: AdScript) {
  return [`${labels.hook} ${hook}`, labels.benefits, ...benefits.map(benefit => `- ${benefit}`), `${labels.callToAction} ${callToAction}`].join('\n');
}

// Lê um roteiro no formato de `formatAdScript`. Retorna null se o texto estiver em outro formato ou fora dos limites das cenas.
export function parseAdScript (script: string): AdScript | null {
  const lines = script.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  const value = (label: string) => lines.find(line => line.startsWith(label))?.slice(label.length).trim();
  const hook = value(labels.hook);
  const callToAction = value(labels.callToAction);
  const benefitsStart = lines.indexOf(labels.benefits);
  const benefits = benefitsStart < 0 ? [] : lines.slice(benefitsStart + 1).filter(line => line.startsWith('- ')).map(line => line.slice(2).trim());
  const within = (text: string | undefined, { min, max }: { min: number; max: number }) => !!text && text.length >= min && text.length <= max;

  if (!within(hook, AD_SCRIPT_LIMITS.hook) || !within(callToAction, AD_SCRIPT_LIMITS.callToAction)) return null;

  if (benefits.length < AD_SCRIPT_LIMITS.benefits.min || benefits.length > AD_SCRIPT_LIMITS.benefits.max) return null;

  if (!benefits.every(benefit => within(benefit, AD_SCRIPT_LIMITS.benefit))) return null;

  return { hook: hook!, benefits, callToAction: callToAction! };
}
