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

// Primeira regra que o roteiro descumpre, ou null quando ele está dentro de AD_SCRIPT_LIMITS e sobrevive ao formato de texto
// (sem quebra de linha e sem espaços nas pontas, para `parseAdScript(formatAdScript(script))` devolver o mesmo roteiro).
export function adScriptViolation ({ hook, benefits, callToAction }: AdScript): string | null {
  const scene = (name: string, text: string, { min, max }: { min: number; max: number }) => {
    if (/[\r\n]/.test(text) || text !== text.trim()) return `${name} com quebra de linha ou espaço nas pontas`;
    return text.length < min || text.length > max ? `${name} com ${text.length} caracteres (de ${min} a ${max})` : null;
  };
  const { benefits: count } = AD_SCRIPT_LIMITS;

  if (benefits.length < count.min || benefits.length > count.max) return `${benefits.length} benefícios (de ${count.min} a ${count.max})`;

  return scene('Gancho', hook, AD_SCRIPT_LIMITS.hook)
    ?? benefits.map((benefit, index) => scene(`Benefício ${index + 1}`, benefit, AD_SCRIPT_LIMITS.benefit)).find(Boolean)
    ?? scene('Chamada', callToAction, AD_SCRIPT_LIMITS.callToAction);
}

// Lê um roteiro no formato de `formatAdScript`. Retorna null se o texto estiver em outro formato ou fora dos limites das cenas.
export function parseAdScript (script: string): AdScript | null {
  const lines = script.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  const value = (label: string) => lines.find(line => line.startsWith(label))?.slice(label.length).trim();
  const hook = value(labels.hook);
  const callToAction = value(labels.callToAction);
  const benefitsStart = lines.indexOf(labels.benefits);
  const benefits = benefitsStart < 0 ? [] : lines.slice(benefitsStart + 1).filter(line => line.startsWith('- ')).map(line => line.slice(2).trim());

  if (hook === undefined || callToAction === undefined) return null;

  const scenes = { hook, benefits, callToAction };
  return adScriptViolation(scenes) ? null : scenes;
}
