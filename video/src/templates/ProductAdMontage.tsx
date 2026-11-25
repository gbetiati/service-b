import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../src/modules/video-generation/domain/entities/product-ad';
import { FONT_FAMILY, ProductImage, SafeArea, fitFontSize, optionalColor, readableOn, safeColor, splitWords, inkOnWhite, useEnter, useLayout, useSafeArea } from './shared';
import { AdAudio, AudioCues } from './audio';

// Montagem rápida: cortes no ritmo da headline mostrando detalhes da foto (recortes com zoom e flash a cada corte),
// benefícios em cartões empilhados e, só então, a foto inteira com nome e preço, a recompensa da curiosidade.
// Linha do tempo (30 fps, 450 frames = 15 s). Cada cartão fica na tela o tempo de uma fala.
const SCENES = { hook: [0, 75], cards: [75, 225], reveal: [300, 60], cta: [360, 90] } as const;
// Frames em que gancho, benefícios e chamada aparecem, para a locução acompanhar o texto.
const audioCues = (bullets: number): AudioCues => ({ hook: 0, benefits: Array.from({ length: bullets }, (_, index) => SCENES.cards[0] + index * (SCENES.cards[1] / bullets)), cta: SCENES.cta[0] });

type Crop = { zoom: number; origin: string };
// Recortes de detalhe da mesma foto. A sequência alterna aproximações e enquadramentos abertos para dar ritmo.
const CROPS: Crop[] = [
  { zoom: 1.15, origin: '50% 50%' }, { zoom: 2.1, origin: '25% 30%' }, { zoom: 1.9, origin: '75% 65%' },
  { zoom: 1.6, origin: '60% 22%' }, { zoom: 2.4, origin: '40% 72%' }, { zoom: 1.35, origin: '50% 45%' },
];

export const ProductAdMontage: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  // Cor de apoio: destaques alternados, cartões, selo de preço e CTA. Sem ela, a principal (e cartões brancos).
  const accent = optionalColor(brand.secondaryColor) ?? color;
  const card = optionalColor(brand.secondaryColor) ?? '#ffffff';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', color: '#ffffff', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(copy.bullets.length)} />
      <Sequence from={SCENES.hook[0]} durationInFrames={SCENES.hook[1]} name="Hook">
        <HookScene imageUrl={product.imageUrl} headline={copy.headline} colors={[color, accent]} />
      </Sequence>
      <Sequence from={SCENES.cards[0]} durationInFrames={SCENES.cards[1]} name="Cards">
        <CardsScene imageUrl={product.imageUrl} bullets={copy.bullets} color={color} card={card} duration={SCENES.cards[1]} />
      </Sequence>
      <Sequence from={SCENES.reveal[0]} durationInFrames={SCENES.reveal[1]} name="Reveal">
        <RevealScene imageUrl={product.imageUrl} name={product.name} price={product.price} oldPrice={product.oldPrice} color={accent} />
      </Sequence>
      <Sequence from={SCENES.cta[0]} durationInFrames={SCENES.cta[1]} name="CTA">
        <CtaScene imageUrl={product.imageUrl} cta={copy.cta} logoUrl={brand.logoUrl} color={color} accent={accent} />
      </Sequence>
    </AbsoluteFill>
  );
};

const CropImage: React.FC<{ imageUrl: string; crop: Crop; extra?: number; style?: React.CSSProperties }> = ({ imageUrl, crop, extra = 1, style }) => (
  <div style={{ overflow: 'hidden', ...style }}>
    <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transformOrigin: crop.origin, transform: `scale(${crop.zoom * extra})` }} />
  </div>
);

// Flash branco que some em poucos frames, marcando o corte.
const Flash: React.FC<{ since: number; strength?: number }> = ({ since, strength = 0.6 }) => (
  <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: interpolate(since, [0, 4], [strength, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
);

// Um corte por palavra: a headline inteira já ocupa seu lugar (o layout não pula) e cada palavra acende no seu corte,
// com a atual destacada na cor da marca.
const HookScene: React.FC<{ imageUrl: string; headline: string; colors: [string, string] }> = ({ imageUrl, headline, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const words = splitWords(headline);
  const beat = Math.max(6, Math.min(14, 66 / Math.max(words.length, 1)));
  const index = Math.min(words.length - 1, Math.floor(frame / beat));
  const local = frame - Math.max(0, index) * beat;
  const crop = CROPS[Math.max(0, index) % CROPS.length];
  const punch = 1 + Math.min(1, local / beat) * 0.05;

  return (
    <AbsoluteFill>
      <CropImage imageUrl={imageUrl} crop={crop} extra={punch} style={{ position: 'absolute', inset: 0 }} />
      <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.42)' }} />
      {index > 0 && <Flash since={local} />}
      <SafeArea style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22 * unit, rowGap: 12 * unit, maxWidth: landscape ? '75%' : '100%', fontSize: Math.max(72, fitFontSize(headline, landscape ? 100 : 104, 30)) * unit, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2 * unit, textTransform: 'uppercase', textAlign: 'center' }}>
          {words.map((word, position) => {
            const shown = position <= index;
            const current = position === index;
            const pop = spring({ frame: frame - position * beat, fps, config: { damping: 12, mass: 0.4 } });
            return (
              <span key={position} style={{
                display: 'inline-block', opacity: shown ? Math.min(1, pop * 2) : 0, transform: `scale(${shown ? 1.3 - 0.3 * pop : 1})`, padding: `0 ${14 * unit}px`, borderRadius: 14 * unit,
                ...(current ? { backgroundColor: colors[position % 2], color: readableOn(colors[position % 2]) } : { textShadow: `0 ${6 * unit}px ${24 * unit}px rgba(0,0,0,0.6)` }),
              }}>{word}</span>
            );
          })}
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

// Cartões empilhados: cada benefício entra pela direita e empurra os anteriores para trás. Cada cartão traz um
// recorte diferente da foto.
const CardsScene: React.FC<{ imageUrl: string; bullets: string[]; color: string; card: string; duration: number }> = ({ imageUrl, bullets, color, card, duration }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { unit, landscape, portrait } = useLayout();
  const safe = useSafeArea();
  const slot = bullets.length ? duration / bullets.length : duration;
  const enters = bullets.map((_, index) => spring({ frame: frame - index * slot, fps, config: { damping: 16, mass: 0.7 } }));
  const cardWidth = landscape ? safe.width * 0.5 : safe.width * (portrait ? 0.94 : 0.8);
  const cardHeight = landscape ? safe.height * 0.84 : Math.min(safe.height * 0.86, cardWidth * 1.2);
  const exit = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <ProductImage imageUrl={imageUrl} zoom={1.3} blur={24 * unit} />
      <AbsoluteFill style={{ backgroundColor: color, opacity: 0.82 }} />
      <AbsoluteFill style={{ top: safe.top, height: safe.height, alignItems: 'center', justifyContent: 'center' }}>
        {bullets.map((bullet, index) => {
          const depth = enters.slice(index + 1).reduce((sum, value) => sum + value, 0);
          if (enters[index] <= 0.001 || depth > 2.6) return null;
          return (
            <div key={index} style={{
              position: 'absolute', width: cardWidth, height: cardHeight, borderRadius: 40 * unit, overflow: 'hidden', backgroundColor: card, color: readableOn(card),
              display: 'flex', flexDirection: 'column', boxShadow: `0 ${24 * unit}px ${70 * unit}px rgba(0,0,0,0.35)`,
              transform: `translateX(${(1 - enters[index]) * width}px) translateY(${-depth * 46 * unit}px) scale(${1 - depth * 0.07}) rotate(${(1 - enters[index]) * 8}deg)`,
              filter: `brightness(${1 - depth * 0.18})`, opacity: Math.min(1, (2.6 - depth) * 1.5),
            }}>
              <CropImage imageUrl={imageUrl} crop={CROPS[(index + 1) % CROPS.length]} style={{ flex: '1 1 0', minHeight: 0 }} />
              <div style={{ padding: `${36 * unit}px ${44 * unit}px ${44 * unit}px`, display: 'flex', flexDirection: 'column', gap: 12 * unit }}>
                <div style={{ fontSize: 34 * unit, fontWeight: 900, color: card === '#ffffff' ? inkOnWhite(color) : readableOn(card), opacity: card === '#ffffff' ? 1 : 0.7, letterSpacing: 2 * unit }}>{String(index + 1).padStart(2, '0')}</div>
                <div style={{ fontSize: (portrait ? 58 : 48) * unit, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1 * unit }}>{bullet}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// A foto inteira, num zoom de afastamento rápido depois dos recortes, com nome e preço.
const RevealScene: React.FC<{ imageUrl: string; name: string; price?: string; oldPrice?: string; color: string }> = ({ imageUrl, name, price, oldPrice, color }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const zoom = interpolate(frame, [0, 20, 60], [1.7, 1.04, 1], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  const text = useEnter(10);
  const chip = useEnter(16, 11);

  return (
    <AbsoluteFill>
      <ProductImage imageUrl={imageUrl} zoom={zoom} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.8) 100%)' }} />
      <Flash since={frame} strength={0.9} />
      <SafeArea style={{ justifyContent: 'flex-end', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 70 * unit, fontWeight: 900, lineHeight: 1.05, letterSpacing: -1.5 * unit, opacity: text, transform: `translateY(${(1 - text) * 40 * unit}px)`, textShadow: `0 ${4 * unit}px ${20 * unit}px rgba(0,0,0,0.5)` }}>{name}</div>
        {price && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 * unit, marginTop: 22 * unit, transform: `scale(${chip})`, transformOrigin: 'left center' }}>
            <div style={{ backgroundColor: color, color: readableOn(color), fontSize: fitFontSize(price, 84, 9) * unit, fontWeight: 900, padding: `${8 * unit}px ${30 * unit}px`, borderRadius: 18 * unit, letterSpacing: -2 * unit }}>{price}</div>
            {oldPrice && <div style={{ fontSize: 44 * unit, fontWeight: 600, opacity: 0.8, textDecoration: 'line-through' }}>{oldPrice}</div>}
          </div>
        )}
      </SafeArea>
    </AbsoluteFill>
  );
};

// CTA sobre a cor da marca, com uma faixa de recortes da foto correndo como filme.
const CtaScene: React.FC<{ imageUrl: string; cta: string; logoUrl?: string; color: string; accent: string }> = ({ imageUrl, cta, logoUrl, color, accent }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const safe = useSafeArea();
  const reveal = interpolate(frame, [0, 12], [0, 100], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const enter = useEnter(8, 12);
  const tile = Math.min(300 * unit, safe.height * 0.32);
  const gap = 24 * unit;
  const offset = (frame * 3 * unit) % ((tile + gap) * CROPS.length);

  return (
    <AbsoluteFill style={{ backgroundColor: color, clipPath: `circle(${reveal * 1.5}% at 50% 50%)` }}>
      <div style={{ position: 'absolute', top: safe.top, left: 0, display: 'flex', gap, transform: `translateX(${-offset}px) rotate(-3deg)` }}>
        {[...CROPS, ...CROPS, ...CROPS, ...CROPS].map((crop, index) => (
          <CropImage key={index} imageUrl={imageUrl} crop={crop} style={{ width: tile, height: tile, borderRadius: 26 * unit, flexShrink: 0, border: `${6 * unit}px solid ${accent === color ? readableOn(color) : accent}` }} />
        ))}
      </div>
      <AbsoluteFill style={{ top: safe.top + tile + 40 * unit, bottom: safe.bottom, left: safe.left, right: safe.right, width: 'auto', height: 'auto', alignItems: 'center', justifyContent: 'center', gap: 40 * unit }}>
        {logoUrl && <Img src={logoUrl} style={{ maxWidth: 260 * unit, maxHeight: 100 * unit, objectFit: 'contain', opacity: enter }} />}
        <div style={{
          backgroundColor: accent === color ? readableOn(color) : accent, color: accent === color ? color : readableOn(accent), fontSize: 76 * unit, fontWeight: 900, textTransform: 'uppercase', letterSpacing: -1 * unit, textAlign: 'center',
          padding: `${28 * unit}px ${64 * unit}px`, borderRadius: 24 * unit, transform: `scale(${enter * (1 + Math.sin(frame / 5) * 0.025)}) rotate(${(1 - enter) * -8}deg)`,
          boxShadow: `0 ${18 * unit}px ${50 * unit}px rgba(0,0,0,0.3)`,
        }}>{cta}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
