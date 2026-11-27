// O que foi lido do site da empresa: as páginas mais relevantes (inicial, sobre, serviços, contato) e os sinais
// estruturados que ajudam a montar o perfil sem depender só do texto.
export type WebsitePage = { url: string; title: string | null; description: string | null; text: string };

export type WebsiteSnapshot = {
  url: string;
  siteName: string | null;
  pages: WebsitePage[];
  // Blocos JSON-LD (schema.org Organization/LocalBusiness...), a fonte mais confiável de nome, endereço e telefone.
  structuredData: unknown[];
  logoCandidates: string[];
  themeColor: string | null;
  // Cores mais usadas no CSS da página, da mais para a menos frequente.
  cssColors: string[];
  instagramHandles: string[];
  phones: string[];
  whatsapp: string[];
};

export abstract class WebsiteScanner {
  abstract scan (url: string): Promise<WebsiteSnapshot>;
}
