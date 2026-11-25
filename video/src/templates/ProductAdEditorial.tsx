import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../src/modules/video-generation/domain/entities/product-ad';
import { FONT_FAMILY, benefitGap, optionalColor, readableOn, safeColor, useEnter, useLayout } from './shared';
import { AdAudio, AudioCues } from './audio';

// Estilo revista: fundo na cor principal, foto em cartão, texto revelado palavra por palavra.
// Linha do tempo (30 fps, 450 frames = 15 s). Os benefícios entram espaçados, no ritmo da locução.
const SCENES = { intro: [0, 120], benefits: [120, 180], price: [300, 60], cta: [360, 90] } as const;
const bulletGap = (count: number) => benefitGap(count, SCENES.benefits[1] - 40, 55);
// Frames em que gancho, benefícios e chamada aparecem, para a locução acompanhar o texto.
const audioCues = (bullets: number): AudioCues => ({ hook: 14, benefits: Array.from({ length: bullets }, (_, index) => SCENES.benefits[0] + 10 + index * bulletGap(bullets)), cta: SCENES.cta[0] });

export const ProductAdEditorial: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? readableOn(color);

  return (
    <AbsoluteFill style={{ backgroundColor: color, color: readableOn(color), fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(copy.bullets.length)} />
      <Sequence from={SCENES.intro[0]} durationInFrames={SCENES.intro[1]} name="Intro">
        <IntroScene imageUrl={product.imageUrl} name={product.name} headline={copy.headline} color={color} accent={accent} />
      </Sequence>
      <Sequence from={SCENES.benefits[0]} durationInFrames={SCENES.benefits[1]} name="Benefits">
        <BenefitsScene imageUrl={product.imageUrl} bullets={copy.bullets} color={color} accent={accent} />
      </Sequence>
      <Sequence from={SCENES.price[0]} durationInFrames={SCENES.price[1]} name="Price">
        <PriceScene imageUrl={product.imageUrl} name={product.name} price={product.price} oldPrice={product.oldPrice} color={color} accent={accent} />
      </Sequence>
      <Sequence from={SCENES.cta[0]} durationInFrames={SCENES.cta[1]} name="CTA">
        <CtaScene cta={copy.cta} logoUrl={brand.logoUrl} color={color} accent={accent} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Foto do produto num cartão arredondado com sombra.
const PhotoCard: React.FC<{ imageUrl: string; width: number; height: number; zoom: number; style?: React.CSSProperties }> = ({ imageUrl, width, height, zoom, style }) => {
  const { unit } = useLayout();
  return (
    <div style={{ width, height, borderRadius: 36 * unit, overflow: 'hidden', boxShadow: `0 ${30 * unit}px ${80 * unit}px rgba(0,0,0,0.35)`, ...style }}>
      <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }} />
    </div>
  );
};

// Revela o texto uma palavra por vez, subindo de baixo.
const WordReveal: React.FC<{ text: string; delay: number; stagger: number; style?: React.CSSProperties }> = ({ text, delay, stagger, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.28em', ...style }}>
      {text.split(/\s+/).map((word, index) => {
        const progress = spring({ frame: frame - delay - index * stagger, fps, config: { damping: 200 } });
        return (
          <span key={index} style={{ display: 'inline-block', overflow: 'hidden' }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - progress) * 100}%)`, opacity: progress }}>{word}</span>
          </span>
        );
      })}
    </div>
  );
};

const IntroScene: React.FC<{ imageUrl: string; name: string; headline: string; color: string; accent: string }> = ({ imageUrl, name, headline, color, accent }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { unit, portrait } = useLayout();
  const card = useEnter(0, 18);
  const tag = useEnter(22);
  const zoom = interpolate(frame, [0, 120], [1.15, 1], { extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [105, 120], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cardWidth = portrait ? width * 0.78 : width * 0.42;
  const cardHeight = portrait ? height * 0.5 : height * 0.76;

  return (
    <AbsoluteFill style={{ opacity: exit, flexDirection: portrait ? 'column' : 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 64 * unit, padding: 80 * unit }}>
      <PhotoCard imageUrl={imageUrl} width={cardWidth} height={cardHeight} zoom={zoom}
        style={{ transform: `translateY(${(1 - card) * 220 * unit}px) rotate(${(1 - card) * -6}deg)`, opacity: card }} />
      <div style={{ flex: portrait ? undefined : 1, width: portrait ? '100%' : undefined }}>
        <div style={{ display: 'inline-block', backgroundColor: accent, color: readableOn(accent), fontSize: 32 * unit, fontWeight: 700, padding: `${8 * unit}px ${20 * unit}px`, borderRadius: 999, marginBottom: 24 * unit, opacity: tag, transform: `scale(${0.8 + 0.2 * tag})` }}>
          {name}
        </div>
        <WordReveal text={headline} delay={14} stagger={5} style={{ fontSize: (portrait ? 84 : 70) * unit, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 * unit, color: readableOn(color) }} />
      </div>
    </AbsoluteFill>
  );
};

const BenefitsScene: React.FC<{ imageUrl: string; bullets: string[]; color: string; accent: string }> = ({ imageUrl, bullets, color, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const card = useEnter(0);
  const exit = interpolate(frame, [SCENES.benefits[1] - 13, SCENES.benefits[1]], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line = interpolate(frame, [0, SCENES.benefits[1] - 5], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const { portrait } = useLayout();
  const cardSize = landscape ? height * 0.6 : width * (portrait ? 0.42 : 0.26);

  return (
    <AbsoluteFill style={{ opacity: exit, flexDirection: landscape ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 70 * unit, padding: 90 * unit }}>
      <PhotoCard imageUrl={imageUrl} width={cardSize} height={cardSize} zoom={1.05} style={{ opacity: card, transform: `scale(${0.85 + 0.15 * card})`, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 34 * unit, width: landscape ? undefined : '100%', flex: landscape ? 1 : undefined }}>
        {bullets.map((bullet, index) => {
          const progress = spring({ frame: frame - 10 - index * bulletGap(bullets.length), fps, config: { damping: 200 } });
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 28 * unit, opacity: progress, transform: `translateY(${(1 - progress) * 40 * unit}px)` }}>
              <div style={{ width: 76 * unit, height: 76 * unit, borderRadius: '50%', backgroundColor: accent, color: readableOn(accent), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 * unit, fontWeight: 800, flexShrink: 0 }}>
                {String(index + 1).padStart(2, '0')}
              </div>
              <div style={{ fontSize: (portrait ? 54 : 46) * unit, fontWeight: 700, lineHeight: 1.15, color: readableOn(color) }}>{bullet}</div>
            </div>
          );
        })}
        <div style={{ height: 6 * unit, borderRadius: 3 * unit, backgroundColor: accent, width: `${line * 100}%`, opacity: 0.8 }} />
      </div>
    </AbsoluteFill>
  );
};

const PriceScene: React.FC<{ imageUrl: string; name: string; price?: string; oldPrice?: string; color: string; accent: string }> = ({ imageUrl, name, price, oldPrice, color, accent }) => {
  const { width, height } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const card = useEnter(0);
  const sticker = useEnter(8, 12);
  const cardWidth = landscape ? width * 0.5 : width * 0.8;
  const cardHeight = landscape ? height * 0.78 : height * 0.55;
  const stickerSize = 330 * unit;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <PhotoCard imageUrl={imageUrl} width={cardWidth} height={cardHeight} zoom={1.08} style={{ opacity: card, transform: `scale(${0.92 + 0.08 * card})` }} />
      {price ? (
        <div style={{
          position: 'absolute', right: landscape ? width * 0.22 : 70 * unit, bottom: landscape ? height * 0.12 : height * 0.2,
          width: stickerSize, height: stickerSize, borderRadius: '50%', backgroundColor: accent, color: readableOn(accent),
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          transform: `scale(${sticker}) rotate(${(1 - sticker) * -90 - 8}deg)`, boxShadow: `0 ${20 * unit}px ${50 * unit}px rgba(0,0,0,0.3)`,
        }}>
          {oldPrice && <div style={{ fontSize: 34 * unit, fontWeight: 600, opacity: 0.75, textDecoration: 'line-through' }}>{oldPrice}</div>}
          <div style={{ fontSize: 64 * unit, fontWeight: 900, letterSpacing: -1 * unit }}>{price}</div>
        </div>
      ) : (
        <div style={{ position: 'absolute', bottom: landscape ? 50 * unit : height * 0.12, fontSize: 64 * unit, fontWeight: 800, color: readableOn(color), opacity: sticker }}>{name}</div>
      )}
    </AbsoluteFill>
  );
};

const CtaScene: React.FC<{ cta: string; logoUrl?: string; color: string; accent: string }> = ({ cta, logoUrl, color, accent }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const enter = useEnter(0);
  const underline = interpolate(frame, [12, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const background = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <AbsoluteFill style={{ backgroundColor: accent, clipPath: `inset(0 0 ${(1 - background) * 100}% 0)` }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 * unit, opacity: enter, transform: `translateY(${(1 - enter) * 50 * unit}px)` }}>
        {logoUrl && <Img src={logoUrl} style={{ maxWidth: 320 * unit, maxHeight: 160 * unit, objectFit: 'contain' }} />}
        <div style={{ fontSize: 96 * unit, fontWeight: 900, color: readableOn(accent), letterSpacing: -2 * unit, textAlign: 'center', padding: `0 ${60 * unit}px` }}>{cta}</div>
        <div style={{ height: 14 * unit, width: `${underline * 70}%`, minWidth: 0, backgroundColor: color, borderRadius: 7 * unit }} />
      </div>
    </AbsoluteFill>
  );
};
