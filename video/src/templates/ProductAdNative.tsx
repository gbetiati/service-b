import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../src/modules/video-generation/domain/entities/product-ad';
import { FONT_FAMILY, SafeArea, fitFontSize, optionalColor, readableOn, safeColor, splitWords, useEnter, useLayout } from './shared';
import { AdAudio } from './audio';

// Visual nativo de Reels: foto em tela cheia com leve movimento de câmera na mão, cortes secos de zoom e legendas no
// estilo das legendas automáticas (2 a 3 palavras por vez, a palavra falada destacada na cor da marca). Lê bem sem som.
// Linha do tempo (30 fps, 450 frames = 15 s): legendas até o frame 330, no ritmo da locução, depois preço e CTA.
const CAPTIONS_END = 330;
const SCENES = { price: [330, 60], cta: [390, 60] } as const;
// Enquadramentos dos cortes: cada trecho da legenda (headline e cada benefício) abre com um zoom diferente.
const SHOTS = [
  { zoom: 1.08, origin: '50% 50%' }, { zoom: 1.32, origin: '35% 40%' }, { zoom: 1.18, origin: '65% 60%' },
  { zoom: 1.42, origin: '50% 35%' }, { zoom: 1.24, origin: '40% 65%' },
];

type Word = { text: string; segment: number; start: number };
type Chunk = { words: Word[]; start: number; end: number };

export const ProductAdNative: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const frame = useCurrentFrame();
  const color = safeColor(brand.primaryColor);
  // Destaques alternam a cor principal e a de apoio a cada trecho da legenda; sem apoio, só a principal.
  const accent = optionalColor(brand.secondaryColor) ?? color;
  const { words, chunks, segmentStarts } = buildCaptions([copy.headline, ...copy.bullets]);
  const segment = frame >= CAPTIONS_END ? -1 : segmentStarts.filter(start => start <= frame).length - 1;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={{ hook: 0, benefits: segmentStarts.slice(1), cta: SCENES.cta[0] }} />
      <HandheldPhoto imageUrl={product.imageUrl} shot={segment} shotStart={segment >= 0 ? segmentStarts[segment] : CAPTIONS_END} />
      <Sequence from={0} durationInFrames={CAPTIONS_END} name="Captions">
        <Captions words={words} chunks={chunks} colors={[color, accent]} />
      </Sequence>
      <Sequence from={SCENES.price[0]} durationInFrames={SCENES.price[1]} name="Price">
        <PriceSticker color={color} accent={accent} name={product.name} price={product.price} oldPrice={product.oldPrice} />
      </Sequence>
      <Sequence from={SCENES.cta[0]} durationInFrames={SCENES.cta[1]} name="CTA">
        <CtaScene cta={copy.cta} logoUrl={brand.logoUrl} color={accent} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Distribui as palavras igualmente até CAPTIONS_END e agrupa em blocos de até 3 palavras e 16 letras, quebrando em
// pontuação e sempre que muda o trecho (headline ou benefício).
function buildCaptions (segments: string[]) {
  const all = segments.flatMap((text, segment) => splitWords(text).map(word => ({ text: word, segment })));
  const duration = all.length ? CAPTIONS_END / all.length : CAPTIONS_END;
  const words: Word[] = all.map((word, index) => ({ ...word, start: index * duration }));
  const chunks: Chunk[] = [];
  for (const word of words) {
    const current = chunks[chunks.length - 1];
    const previous = current?.words[current.words.length - 1];
    const length = current ? current.words.reduce((sum, item) => sum + item.text.length + 1, word.text.length) : 0;
    if (!current || current.words.length >= 3 || length > 16 || previous!.segment !== word.segment || /[.,!?;:]$/.test(previous!.text)) {
      chunks.push({ words: [word], start: word.start, end: word.start + duration });
    } else {
      current.words.push(word);
      current.end = word.start + duration;
    }
  }
  const segmentStarts = segments.map((_, segment) => words.find(word => word.segment === segment)?.start).filter((start): start is number => start !== undefined);
  return { words, chunks, segmentStarts: segmentStarts.length ? segmentStarts : [0] };
}

// Câmera na mão: deriva suave somada a um tremor leve. Cada trecho troca o enquadramento com um corte seco.
const HandheldPhoto: React.FC<{ imageUrl: string; shot: number; shotStart: number }> = ({ imageUrl, shot, shotStart }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const framing = shot < 0 ? { zoom: 1.06, origin: '50% 50%' } : SHOTS[shot % SHOTS.length];
  const push = 1 + Math.min(1, (frame - shotStart) / 90) * 0.05;
  const x = Math.sin(frame / 17) * 8 * unit + Math.sin(frame / 6.3) * 2 * unit;
  const y = Math.cos(frame / 13) * 6 * unit + Math.cos(frame / 5.1) * 1.5 * unit;
  const rotate = Math.sin(frame / 23) * 0.5;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transformOrigin: framing.origin, transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${framing.zoom * push * 1.04})` }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.45) 100%)' }} />
    </AbsoluteFill>
  );
};

// Texto branco com contorno preto (legível sobre qualquer foto); a palavra atual ganha caixa na cor da marca.
const captionText = (unit: number): React.CSSProperties => ({
  color: '#ffffff', WebkitTextStroke: `${10 * unit}px #000000`, paintOrder: 'stroke fill', textShadow: `0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,0.45)`,
});

const Captions: React.FC<{ words: Word[]; chunks: Chunk[]; colors: [string, string] }> = ({ words, chunks, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const chunk = chunks.find(item => frame >= item.start && frame < item.end);
  if (!chunk) return null;
  const active = words.filter(word => word.start <= frame).length - 1;
  const pop = spring({ frame: frame - chunk.start, fps, config: { damping: 12, mass: 0.4 } });
  // Fonte pelo tamanho do bloco, para ele caber numa linha sempre que possível.
  const letters = chunk.words.reduce((sum, word) => sum + word.text.length + 1, -1);
  const fontSize = Math.max(64, Math.min(landscape ? 96 : 108, 1250 / Math.max(letters, 1))) * unit;

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 22 * unit, rowGap: 10 * unit, maxWidth: landscape ? '70%' : '100%',
        fontSize, fontWeight: 900, lineHeight: 1.1, textTransform: 'uppercase', textAlign: 'center', transform: `scale(${0.8 + 0.2 * pop})`, opacity: Math.min(1, pop * 2),
      }}>
        {chunk.words.map(word => {
          const current = words.indexOf(word) === active;
          const color = colors[word.segment % 2];
          return current ? (
            <span key={word.start} style={{ backgroundColor: color, color: readableOn(color), padding: `${2 * unit}px ${20 * unit}px`, borderRadius: 18 * unit, transform: 'rotate(-2deg) scale(1.06)', boxShadow: `0 ${8 * unit}px ${24 * unit}px rgba(0,0,0,0.35)` }}>{word.text}</span>
          ) : (
            <span key={word.start} style={captionText(unit)}>{word.text}</span>
          );
        })}
      </div>
    </SafeArea>
  );
};

// Adesivo branco inclinado, como os de texto do próprio app, balançando de leve. Sem preço, mostra só o nome.
const PriceSticker: React.FC<{ name: string; price?: string; oldPrice?: string; color: string; accent: string }> = ({ name, price, oldPrice, color, accent }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pop = useEnter(0, 9);
  const wobble = Math.sin(frame / 8) * 1.5;

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        backgroundColor: '#ffffff', color: '#111111', borderRadius: 34 * unit, padding: `${34 * unit}px ${56 * unit}px`, textAlign: 'center', maxWidth: '100%',
        borderBottom: `${16 * unit}px solid ${color}`, outline: `${8 * unit}px solid ${accent}`, outlineOffset: -4 * unit,
        boxShadow: `0 ${24 * unit}px ${60 * unit}px rgba(0,0,0,0.45)`, transform: `scale(${pop}) rotate(${-4 + wobble}deg)`,
      }}>
        <div style={{ fontSize: (price ? 40 : 76) * unit, fontWeight: price ? 700 : 900, lineHeight: 1.1, color: price ? '#4b5563' : '#111111' }}>{name}</div>
        {price && oldPrice && <div style={{ fontSize: 44 * unit, fontWeight: 600, color: '#9ca3af', textDecoration: 'line-through', textDecorationThickness: 4 * unit, marginTop: 10 * unit }}>{oldPrice}</div>}
        {price && <div style={{ fontSize: fitFontSize(price, 120, 9) * unit, fontWeight: 900, letterSpacing: -3 * unit, lineHeight: 1.05 }}>{price}</div>}
      </div>
    </SafeArea>
  );
};

// CTA em legenda grande e uma seta quicando para baixo, na direção do botão de ação do anúncio.
const CtaScene: React.FC<{ cta: string; logoUrl?: string; color: string }> = ({ cta, logoUrl, color }) => {
  const frame = useCurrentFrame();
  const { unit, landscape } = useLayout();
  const pop = useEnter(0, 11);
  const arrow = useEnter(10);
  const bounce = Math.abs(Math.sin(frame / 6)) * 26 * unit;

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center', gap: 40 * unit }}>
      {logoUrl && <Img src={logoUrl} style={{ maxWidth: 260 * unit, maxHeight: 100 * unit, objectFit: 'contain', opacity: pop }} />}
      <div style={{ fontSize: (landscape ? 100 : 110) * unit, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase', textAlign: 'center', transform: `scale(${pop})`, ...captionText(unit) }}>{cta}</div>
      <div style={{ width: 130 * unit, height: 130 * unit, borderRadius: '50%', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: arrow, transform: `translateY(${bounce}px) scale(${arrow})`, boxShadow: `0 ${12 * unit}px ${30 * unit}px rgba(0,0,0,0.4)` }}>
        <svg width={70 * unit} height={70 * unit} viewBox="0 0 24 24">
          <path d="M12 4v15M5 12l7 7 7-7" fill="none" stroke={readableOn(color)} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </SafeArea>
  );
};
