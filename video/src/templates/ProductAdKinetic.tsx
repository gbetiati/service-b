import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../src/modules/video-generation/domain/entities/product-ad';
import { FONT_FAMILY, ProductImage, optionalColor, readableOn, safeColor, useEnter, useLayout } from './shared';
import { AdAudio, AudioCues } from './audio';

// Tipografia em movimento: palavras grandes, cortes rápidos e as cores da marca alternando a cada tela.
// Linha do tempo (30 fps, 450 frames = 15 s). Cada benefício fica uma tela inteira, no ritmo da locução.
const SCENES = { headline: [0, 90], reveal: [90, 60], benefits: [150, 180], price: [330, 45], cta: [375, 75] } as const;
// Frames em que gancho, benefícios e chamada aparecem, para a locução acompanhar o texto.
const audioCues = (bullets: number): AudioCues => ({ hook: 0, benefits: Array.from({ length: bullets }, (_, index) => SCENES.benefits[0] + index * Math.floor(SCENES.benefits[1] / bullets)), cta: SCENES.cta[0] });

export const ProductAdKinetic: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  // Sem cor de apoio, alterna a principal com um fundo escuro neutro.
  const accent = optionalColor(brand.secondaryColor) ?? '#111111';

  return (
    <AbsoluteFill style={{ backgroundColor: color, fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(copy.bullets.length)} />
      <Sequence from={SCENES.headline[0]} durationInFrames={SCENES.headline[1]} name="Headline">
        <HeadlineScene headline={copy.headline} color={color} />
      </Sequence>
      <Sequence from={SCENES.reveal[0]} durationInFrames={SCENES.reveal[1]} name="Reveal">
        <RevealScene imageUrl={product.imageUrl} name={product.name} color={color} />
      </Sequence>
      <Sequence from={SCENES.benefits[0]} durationInFrames={SCENES.benefits[1]} name="Benefits">
        <BenefitsScene imageUrl={product.imageUrl} bullets={copy.bullets} colors={[accent, color]} duration={SCENES.benefits[1]} />
      </Sequence>
      <Sequence from={SCENES.price[0]} durationInFrames={SCENES.price[1]} name="Price">
        <PriceScene imageUrl={product.imageUrl} name={product.name} price={product.price} oldPrice={product.oldPrice} color={color} />
      </Sequence>
      <Sequence from={SCENES.cta[0]} durationInFrames={SCENES.cta[1]} name="CTA">
        <CtaScene cta={copy.cta} logoUrl={brand.logoUrl} color={color} accent={accent} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Cada palavra da headline entra com impacto, uma após a outra, e as anteriores ficam na tela.
const HeadlineScene: React.FC<{ headline: string; color: string }> = ({ headline, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit } = useLayout();
  const words = headline.split(/\s+/);
  const beat = Math.max(6, Math.floor(60 / words.length));
  const exit = interpolate(frame, [80, 90], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: color, color: readableOn(color), justifyContent: 'center', padding: 90 * unit, opacity: exit }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 30 * unit, rowGap: 6 * unit }}>
        {words.map((word, index) => {
          const progress = spring({ frame: frame - index * beat, fps, config: { damping: 14, mass: 0.6 } });
          return (
            <span key={index} style={{ display: 'inline-block', fontSize: 120 * unit, fontWeight: 900, lineHeight: 1, letterSpacing: -3 * unit, textTransform: 'uppercase', opacity: Math.min(1, progress * 2), transform: `scale(${1.6 - 0.6 * progress})`, transformOrigin: 'left bottom' }}>
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// A foto é revelada por um círculo que cresce a partir do centro.
const RevealScene: React.FC<{ imageUrl: string; name: string; color: string }> = ({ imageUrl, name, color }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const radius = interpolate(frame, [0, 22], [0, 110], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const zoom = interpolate(frame, [0, 60], [1.25, 1.05], { extrapolateRight: 'clamp' });
  const label = useEnter(16);

  return (
    <AbsoluteFill style={{ backgroundColor: color }}>
      <AbsoluteFill style={{ clipPath: `circle(${radius}% at 50% 50%)` }}>
        <ProductImage imageUrl={imageUrl} zoom={zoom} />
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 110 * unit }}>
        <div style={{ fontSize: 86 * unit, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 2 * unit, opacity: label, transform: `translateY(${(1 - label) * 40 * unit}px)` }}>{name}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Uma tela por benefício, alternando as cores da marca, com a foto em miniatura no canto.
const BenefitsScene: React.FC<{ imageUrl: string; bullets: string[]; colors: [string, string]; duration: number }> = ({ imageUrl, bullets, colors, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit } = useLayout();
  const slide = Math.floor(duration / bullets.length);
  const index = Math.min(bullets.length - 1, Math.floor(frame / slide));
  const local = frame - index * slide;
  const background = colors[index % 2];
  const wipe = interpolate(local, [0, 8], [0, 100], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const text = spring({ frame: local - 4, fps, config: { damping: 200 } });
  const thumb = 220 * unit;

  return (
    <AbsoluteFill style={{ backgroundColor: colors[(index + 1) % 2] }}>
      <AbsoluteFill style={{ backgroundColor: background, clipPath: `inset(0 ${100 - wipe}% 0 0)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', padding: 100 * unit, color: readableOn(background) }}>
        <div style={{ fontSize: 40 * unit, fontWeight: 800, opacity: 0.7 * text, marginBottom: 24 * unit }}>{`${index + 1}/${bullets.length}`}</div>
        <div style={{ fontSize: 96 * unit, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 * unit, opacity: text, transform: `translateY(${(1 - text) * 80 * unit}px)` }}>{bullets[index]}</div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', right: 70 * unit, top: 70 * unit, width: thumb, height: thumb, borderRadius: '50%', overflow: 'hidden', border: `${8 * unit}px solid ${readableOn(background)}` }}>
        <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  );
};

// Preço entra com impacto sobre a foto desfocada. Sem preço, mostra o nome do produto.
const PriceScene: React.FC<{ imageUrl: string; name: string; price?: string; oldPrice?: string; color: string }> = ({ imageUrl, name, price, oldPrice, color }) => {
  const { unit } = useLayout();
  const slam = useEnter(2, 10);

  return (
    <AbsoluteFill>
      <ProductImage imageUrl={imageUrl} zoom={1.15} dim={0.55} blur={10 * unit} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: '#ffffff', padding: 80 * unit }}>
        {price && oldPrice && <div style={{ fontSize: 60 * unit, fontWeight: 600, opacity: 0.75 * slam, textDecoration: 'line-through' }}>{oldPrice}</div>}
        <div style={{
          fontSize: (price ? 150 : 110) * unit, fontWeight: 900, letterSpacing: -4 * unit, transform: `scale(${2.2 - 1.2 * slam})`, opacity: Math.min(1, slam * 1.5),
          ...(price ? { backgroundColor: color, color: readableOn(color), padding: `${10 * unit}px ${50 * unit}px`, borderRadius: 28 * unit } : { textShadow: `0 ${8 * unit}px ${30 * unit}px rgba(0,0,0,0.4)` }),
        }}>
          {price ?? name}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// CTA sobre faixas diagonais nas cores da marca, em movimento contínuo.
const CtaScene: React.FC<{ cta: string; logoUrl?: string; color: string; accent: string }> = ({ cta, logoUrl, color, accent }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const enter = useEnter(4, 12);
  const stripe = 120 * unit;
  const offset = (frame * 4 * unit) % (stripe * 2);
  const pulse = 1 + Math.sin(frame / 5) * 0.025;

  return (
    <AbsoluteFill style={{ backgroundColor: color, justifyContent: 'center', alignItems: 'center', gap: 60 * unit }}>
      <AbsoluteFill style={{ overflow: 'hidden', opacity: 0.9 }}>
        {/* Camada maior que a tela, girada, que se desloca inteira: as faixas andam sem emenda nas bordas. */}
        <div style={{ position: 'absolute', left: '-100%', top: '-100%', width: '300%', height: '300%', transform: `rotate(-45deg) translateX(${offset}px)`, backgroundImage: `repeating-linear-gradient(90deg, ${color} 0, ${color} ${stripe}px, ${accent} ${stripe}px, ${accent} ${stripe * 2}px)` }} />
      </AbsoluteFill>
      {logoUrl && <Img src={logoUrl} style={{ position: 'relative', maxWidth: 320 * unit, maxHeight: 160 * unit, objectFit: 'contain', opacity: enter }} />}
      <div style={{ position: 'relative', backgroundColor: '#ffffff', color: '#111111', fontSize: 84 * unit, fontWeight: 900, textTransform: 'uppercase', padding: `${30 * unit}px ${70 * unit}px`, borderRadius: 24 * unit, transform: `scale(${enter * pulse}) rotate(${(1 - enter) * 10 - 2}deg)`, boxShadow: `0 ${20 * unit}px ${60 * unit}px rgba(0,0,0,0.35)` }}>
        {cta}
      </div>
    </AbsoluteFill>
  );
};
