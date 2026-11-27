import { Injectable, Logger } from '@nestjs/common';
import { parsePublicUrl, safeFetch } from '@/shared/libs/http/safe-fetch';
import { WebsitePage, WebsiteScanner, WebsiteSnapshot } from '../../domain/providers/website-scanner';

// Páginas internas que mais dizem sobre o negócio, pela URL ou pelo texto do link.
const RELEVANT_LINK = /sobre|quem[-\s]?somos|about|empresa|hist[oó]ria|servi[cç]o|produto|card[aá]pio|menu|cat[aá]logo|solu[cç][oõ]es|contato|contact|onde/i;
const MAX_EXTRA_PAGES = 4;
const MAX_PAGE_TEXT = 5000;
const HTML = /text\/html|application\/xhtml/;
// Perfis do Instagram que não são de empresa (links de compartilhamento e páginas do próprio Instagram).
const NOT_A_PROFILE = /^(p|reel|reels|tv|explore|stories|accounts|about|developer|legal|direct)$/i;

// Leitura do site sem navegador: HTML da página inicial e de algumas páginas internas, com os sinais estruturados
// (JSON-LD, metatags, ícones, cores) extraídos por expressões simples. Sites montados só no navegador (SPA) rendem
// pouco texto; os metadados e o JSON-LD costumam estar no HTML mesmo assim.
@Injectable()
export class HtmlWebsiteScanner implements WebsiteScanner {
  private readonly logger = new Logger(HtmlWebsiteScanner.name);
  protected fetch = safeFetch;

  async scan (url: string): Promise<WebsiteSnapshot> {
    const home = await this.fetch(url, { accept: HTML });
    const homeHtml = home.body.toString('utf8');
    const base = home.url;
    const host = new URL(base).hostname.replace(/^www\./, '');
    const links = [...homeHtml.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(([, href, label]) => ({ href: decode(href), label: textOf(label) }));
    const extra = unique(links
      .filter(({ href, label }) => RELEVANT_LINK.test(href) || RELEVANT_LINK.test(label))
      .map(({ href }) => absolute(href, base))
      .filter((link): link is string => !!link && new URL(link).hostname.replace(/^www\./, '') === host && link !== base))
      .slice(0, MAX_EXTRA_PAGES);
    const extraPages = await Promise.all(extra.map(link => this.fetch(link, { accept: HTML, timeoutMs: 8000 }).then(page => ({ url: page.url, html: page.body.toString('utf8') })).catch(() => null)));
    const all = [{ url: base, html: homeHtml }, ...extraPages.filter((page): page is { url: string; html: string } => !!page)];
    const stylesheet = absolute(attr(homeHtml, /<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/i, 'href') ?? '', base);
    const css = stylesheet && new URL(stylesheet).hostname.replace(/^www\./, '') === host
      ? await this.fetch(stylesheet, { maxBytes: 600_000, timeoutMs: 6000 }).then(file => file.body.toString('utf8')).catch(() => '')
      : '';
    const everything = all.map(page => page.html).join('\n');
    this.logger.log(`Site lido. host=${host} páginas=${all.length}`);

    return {
      url: base,
      siteName: meta(homeHtml, 'og:site_name') ?? meta(homeHtml, 'application-name'),
      pages: all.map(page => pageOf(page.url, page.html)),
      structuredData: all.flatMap(page => jsonLd(page.html)).slice(0, 10),
      logoCandidates: logos(homeHtml, base),
      themeColor: normalizeHex(meta(homeHtml, 'theme-color')),
      cssColors: topColors(`${css}\n${[...everything.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(([, style]) => style).join('\n')}\n${[...everything.matchAll(/style\s*=\s*["']([^"']+)["']/gi)].map(([, style]) => style).join('\n')}`),
      instagramHandles: unique([...everything.matchAll(/instagram\.com\/([A-Za-z0-9._]{1,30})/gi)].map(([, handle]) => handle.toLowerCase()).filter(handle => !NOT_A_PROFILE.test(handle))).slice(0, 3),
      phones: unique([...everything.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map(([, phone]) => decode(phone).trim())).slice(0, 3),
      whatsapp: unique([...everything.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=)(\d{10,15})/gi)].map(([, number]) => number)).slice(0, 3),
    };
  }
}

function pageOf (url: string, html: string): WebsitePage {
  return { url, title: textOf(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '') || null, description: meta(html, 'description') ?? meta(html, 'og:description'), text: visibleText(html).slice(0, MAX_PAGE_TEXT) };
}

// Texto visível: sem scripts, estilos, SVG e comentários; tags viram espaço.
export function visibleText (html: string) {
  return textOf(html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<head\b[\s\S]*?<\/head>/i, ' '));
}

function textOf (html: string) {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

function decode (text: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ccedil: 'ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value < 0x110000 ? String.fromCodePoint(value) : ' ';
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

// Valor de uma metatag por name ou property, em qualquer ordem de atributos.
function meta (html: string, name: string) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = /(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];

    if (key?.toLowerCase() === name) return decode(/content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '').trim() || null;
  }
  return null;
}

function attr (html: string, tagPattern: RegExp, name: string) {
  const tag = tagPattern.exec(html)?.[0];
  return tag ? new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag)?.[1] ?? null : null;
}

function absolute (href: string, base: string) {
  try {
    if (!href || /^(mailto|tel|javascript|data):/i.test(href)) return null;
    return parsePublicUrl(decode(href), base).toString();
  } catch {
    return null;
  }
}

function jsonLd (html: string) {
  return [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(([, json]) => {
    try {
      return [JSON.parse(json.trim())];
    } catch {
      return [];
    }
  });
}

// Candidatos a logo, do mais para o menos confiável: logo do JSON-LD, imagem com "logo" no nome, classe ou alt,
// ícones grandes (apple-touch-icon) e a imagem de compartilhamento (og:image). Sem .ico (formato de favicon, que não
// serve de logo) nem .svg (não é importado como imagem).
function logos (html: string, base: string) {
  const fromJsonLd = jsonLd(html).flatMap(function find (node: unknown): string[] {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(find);
    const record = node as Record<string, unknown>;
    const logo = record.logo;
    const own = typeof logo === 'string' ? [logo] : logo && typeof logo === 'object' && typeof (logo as { url?: unknown }).url === 'string' ? [(logo as { url: string }).url] : [];
    return [...own, ...Object.values(record).filter(value => value && typeof value === 'object').flatMap(find)];
  });
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => tag).filter(tag => /logo|marca|brand/i.test(tag)).map(tag => /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '');
  // apple-touch-icon (180 px) antes dos ícones comuns, que costumam ter 16 ou 32 px.
  const icons = [...html.matchAll(/<link\b[^>]*rel\s*=\s*["'][^"']*(apple-touch-icon|icon)[^"']*["'][^>]*>/gi)]
    .sort((a, b) => Number(/apple-touch-icon/i.test(b[0])) - Number(/apple-touch-icon/i.test(a[0]))).map(([tag]) => /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '');
  return unique([...fromJsonLd, ...images, ...icons, meta(html, 'og:image') ?? ''].map(href => absolute(href, base)).filter((href): href is string => !!href && !/\.(svg|ico)(\?|$)/i.test(href))).slice(0, 6);
}

function normalizeHex (value: string | null) {
  const hex = value?.trim().toLowerCase();

  if (!hex) return null;

  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;

  return /^#[0-9a-f]{3}$/.test(hex) ? `#${[...hex.slice(1)].map(char => char + char).join('')}` : null;
}

// Cores mais frequentes no CSS, sem branco, preto e cinzas (que não identificam a marca).
function topColors (css: string) {
  const counts = new Map<string, number>();
  for (const [hex] of css.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const color = normalizeHex(hex);

    if (!color) continue;

    const [r, g, b] = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));

    if (Math.max(r, g, b) - Math.min(r, g, b) < 24) continue;

    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color]) => color);
}

function unique<T> (items: T[]) {
  return [...new Set(items)];
}
