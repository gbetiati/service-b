import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { productImages, FONT_FAMILY, SafeArea, benefitGap, fitFontSize, mix, optionalColor, readableOn, safeColor, splitWords, useEnter, useLayout, useSafeArea } from '../shared';
import { AdAudio, AudioCues } from '../audio';

// Vitrine com anotações: a foto em tela cheia encolhe para um círculo iluminado no centro, que fica na tela até o fim
// (sem cortes; com mais fotos, a do círculo troca em fade a cada benefício), e cada benefício aparece como etiqueta ligada ao produto por uma linha. O fundo é a cor principal
// escurecida; a cor de apoio marca etiquetas, selo de preço e CTA.
// Linha do tempo (30 fps, 450 frames = 15 s). As etiquetas entram no ritmo da locução.
const SCENES = { hook: [0, 72], callouts: [84, 221], price: [305, 70], cta: [375, 75] } as const;
const calloutGap = (count: number) => benefitGap(count, SCENES.callouts[1] - 40, 70);
// Frames em que gancho, benefícios e chamada aparecem, para a locução acompanhar o texto.
const audioCues = (bullets: number): AudioCues => ({ hook: 2, benefits: Array.from({ length: bullets }, (_, index) => SCENES.callouts[0] + 4 + index * calloutGap(bullets)), cta: SCENES.cta[0] });
const SHRINK = [58, 84] as const;

export const ProductAdCallouts: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? color;

  return (
    <AbsoluteFill style={{ backgroundColor: mix(color, '#000000', 0.8), color: '#ffffff', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(copy.bullets.length)} />
      <Stage images={productImages(product)} bullets={copy.bullets.length} color={color} accent={accent} />
      <Sequence from={SCENES.hook[0]} durationInFrames={SCENES.hook[1]} name="Hook">
        <HookScene headline={copy.headline} name={product.name} color={accent} duration={SCENES.hook[1]} />
      </Sequence>
      <Sequence from={SCENES.callouts[0]} durationInFrames={SCENES.callouts[1]} name="Callouts">
        <CalloutsScene bullets={copy.bullets} accent={accent} duration={SCENES.callouts[1]} />
      </Sequence>
      <Sequence from={SCENES.price[0]} durationInFrames={SCENES.price[1]} name="Price">
        <PriceScene name={product.name} price={product.price} oldPrice={product.oldPrice} color={accent} duration={SCENES.price[1]} />
      </Sequence>
      <Sequence from={SCENES.cta[0]} durationInFrames={SCENES.cta[1]} name="CTA">
        <CtaScene cta={copy.cta} logoUrl={brand.logoUrl} color={accent} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Posição do círculo do produto. No CTA ele sobe e encolhe para abrir espaço ao botão.
function useOrbit (ctaProgress = 0) {
  const { width } = useVideoConfig();
  const { landscape } = useLayout();
  const safe = useSafeArea();
  const radius = Math.min(safe.width, safe.height) * (landscape ? 0.4 : 0.36);
  return { cx: width / 2, cy: safe.centerY - radius * 0.38 * ctaProgress, radius: radius * (1 - 0.36 * ctaProgress), baseRadius: radius };
}

// Frame em que cada foto entra no círculo: a principal desde o início e as outras junto com o 2º e o 3º benefício
// (sem benefícios suficientes, ao longo das etiquetas). A troca é um fade, para o círculo continuar sem cortes.
const PHOTO_FADE = 12;
function photoStarts (images: number, bullets: number) {
  const cues = audioCues(bullets).benefits;
  return Array.from({ length: images }, (_, index) => index === 0 ? 0 : cues[index] ?? SCENES.callouts[0] + (index * SCENES.callouts[1]) / images);
}

// Camada contínua: fotos, brilho na cor da marca e anéis girando. Usa o frame global.
const Stage: React.FC<{ images: string[]; bullets: number; color: string; accent: string }> = ({ images, bullets, color, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const { unit } = useLayout();
  const cta = spring({ frame: frame - SCENES.cta[0], fps, config: { damping: 200 } });
  const { cx, cy, radius } = useOrbit(cta);
  const shrink = interpolate(frame, SHRINK, [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const lerp = (from: number, to: number) => from + (to - from) * shrink;
  const zoom = interpolate(frame, [0, SHRINK[1], durationInFrames], [1.15, 1, 1.08]);
  const glow = shrink * (0.5 + Math.sin(frame / 14) * 0.08);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: glow, background: `radial-gradient(circle at ${cx}px ${cy}px, ${color} 0%, ${color}55 ${radius * 1.3}px, transparent ${radius * 2.4}px)` }} />
      <svg width={width} height={height} style={{ position: 'absolute', opacity: shrink }}>
        <circle cx={cx} cy={cy} r={radius + 30 * unit} fill="none" stroke={accent} strokeWidth={5 * unit} strokeDasharray={`${4 * unit} ${20 * unit}`} strokeLinecap="round"
          transform={`rotate(${frame * 0.6} ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={radius + 60 * unit} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2 * unit} />
      </svg>
      <div style={{
        position: 'absolute', left: lerp(0, cx - radius), top: lerp(0, cy - radius), width: lerp(width, radius * 2), height: lerp(height, radius * 2),
        borderRadius: lerp(0, radius), overflow: 'hidden', boxShadow: `0 ${30 * unit}px ${90 * unit}px rgba(0,0,0,${0.6 * shrink})`,
      }}>
        {photoStarts(images.length, bullets).map((start, index) => (
          <Img key={index} src={images[index]} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`,
            opacity: index === 0 ? 1 : interpolate(frame, [start, start + PHOTO_FADE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }} />
        ))}
        <AbsoluteFill style={{ opacity: 1 - shrink, background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.55) 100%)' }} />
      </div>
    </AbsoluteFill>
  );
};

const HookScene: React.FC<{ headline: string; name: string; color: string; duration: number }> = ({ headline, name, color, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const tag = useEnter(0, 14);
  const exit = interpolate(frame, [duration - 14, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });

  return (
    <SafeArea style={{ justifyContent: 'flex-start', opacity: 1 - exit, transform: `translateY(${-exit * 80 * unit}px)` }}>
      <div style={{ alignSelf: 'flex-start', backgroundColor: color, color: readableOn(color), fontSize: 34 * unit, fontWeight: 800, padding: `${10 * unit}px ${24 * unit}px`, borderRadius: 999, marginBottom: 28 * unit, transform: `scale(${0.7 + 0.3 * tag})`, opacity: tag, transformOrigin: 'left center' }}>
        {name}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.26em', maxWidth: landscape ? '70%' : '100%', fontSize: (landscape ? 88 : 96) * unit, fontWeight: 900, lineHeight: 1.04, letterSpacing: -2 * unit, textShadow: `0 ${4 * unit}px ${24 * unit}px rgba(0,0,0,0.5)` }}>
        {splitWords(headline).map((word, index) => {
          const progress = spring({ frame: frame - 2 - index * 3, fps, config: { damping: 200 } });
          return (
            <span key={index} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.06em' }}>
              <span style={{ display: 'inline-block', transform: `translateY(${(1 - progress) * 105}%)` }}>{word}</span>
            </span>
          );
        })}
      </div>
    </SafeArea>
  );
};

// Etiquetas alternando esquerda e direita. No 16x9 o ponto encosta na borda do círculo; nos formatos estreitos a etiqueta
// avança sobre a foto para ter largura de leitura.
const CalloutsScene: React.FC<{ bullets: string[]; accent: string; duration: number }> = ({ bullets, accent, duration }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const safe = useSafeArea();
  const { cx, cy, radius } = useOrbit();
  const exit = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stagger = calloutGap(bullets.length);
  const lineLength = 56 * unit;
  const dot = 28 * unit;

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      {bullets.map((bullet, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const y = bullets.length === 1 ? cy : cy - radius * 0.7 + (index * radius * 1.4) / (bullets.length - 1);
        const dy = y - cy;
        const dotX = landscape ? cx + side * Math.sqrt(radius ** 2 - dy ** 2) * 0.97 : cx - side * radius * 0.15;
        const room = side < 0 ? dotX - safe.left : width - safe.right - dotX;
        const start = 4 + index * stagger;
        const pop = spring({ frame: frame - start, fps, config: { damping: 10, mass: 0.5 } });
        const line = spring({ frame: frame - start - 4, fps, config: { damping: 200 }, durationInFrames: 10 });
        const label = spring({ frame: frame - start - 8, fps, config: { damping: 200 } });
        const ring = ((frame - start) % 30) / 30;

        return (
          <div key={index} style={{
            position: 'absolute', top: y, display: 'flex', alignItems: 'center', flexDirection: side < 0 ? 'row' : 'row-reverse', transform: 'translateY(-50%)',
            ...(side < 0 ? { right: width - dotX - dot / 2 } : { left: dotX - dot / 2 }),
          }}>
            <div style={{
              maxWidth: room - lineLength - dot, backgroundColor: '#ffffff', color: '#111111', borderLeft: `${10 * unit}px solid ${accent}`, fontSize: (landscape ? 40 : 42) * unit, fontWeight: 800, lineHeight: 1.15,
              padding: `${18 * unit}px ${28 * unit}px`, borderRadius: 22 * unit, boxShadow: `0 ${14 * unit}px ${40 * unit}px rgba(0,0,0,0.45)`,
              opacity: label, transform: `translateX(${side * (1 - label) * -40 * unit}px)`,
            }}>{bullet}</div>
            <div style={{ width: lineLength, display: 'flex', justifyContent: side < 0 ? 'flex-end' : 'flex-start' }}>
              <div style={{ width: `${line * 100}%`, height: 4 * unit, backgroundColor: '#ffffff' }} />
            </div>
            <div style={{ position: 'relative', width: dot, height: dot, flexShrink: 0, transform: `scale(${pop})` }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${3 * unit}px solid ${accent}`, transform: `scale(${1 + ring * 1.4})`, opacity: frame >= start ? 1 - ring : 0 }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: accent, border: `${5 * unit}px solid #ffffff` }} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Preço em selo sobre o círculo. No 16x9 o nome e o preço vão para a esquerda do círculo.
const PriceScene: React.FC<{ name: string; price?: string; oldPrice?: string; color: string; duration: number }> = ({ name, price, oldPrice, color, duration }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const safe = useSafeArea();
  const { cx, cy, radius } = useOrbit();
  const title = useEnter(0);
  const sticker = useEnter(6, 11);
  const exit = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const size = 340 * unit;
  const stickerX = Math.min(cx + radius * 0.62, width - safe.right - size / 2);
  const stickerY = cy + radius * 0.58;
  const titleStyle: React.CSSProperties = { fontSize: 56 * unit, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1 * unit, opacity: title, transform: `translateY(${(1 - title) * 30 * unit}px)` };

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      {landscape ? (
        <div style={{ position: 'absolute', left: safe.left, width: cx - radius - safe.left - 80 * unit, top: cy, transform: 'translateY(-50%)' }}>
          <div style={titleStyle}>{name}</div>
        </div>
      ) : (
        <div style={{ position: 'absolute', left: safe.left, right: safe.right, top: safe.top, height: cy - radius - safe.top - 40 * unit, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', textAlign: 'center' }}>
          <div style={titleStyle}>{name}</div>
        </div>
      )}
      {price && (
        <div style={{
          position: 'absolute', left: stickerX - size / 2, top: stickerY - size / 2, width: size, height: size, borderRadius: '50%', backgroundColor: color, color: readableOn(color),
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', border: `${8 * unit}px solid #ffffff`,
          boxShadow: `0 ${20 * unit}px ${60 * unit}px rgba(0,0,0,0.5)`, transform: `scale(${sticker}) rotate(${(1 - sticker) * -120 - 8}deg)`,
        }}>
          {oldPrice && <div style={{ fontSize: 34 * unit, fontWeight: 600, opacity: 0.75, textDecoration: 'line-through' }}>{oldPrice}</div>}
          <div style={{ fontSize: fitFontSize(price, 66, 8) * unit, fontWeight: 900, letterSpacing: -1 * unit }}>{price}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// Botão abaixo do círculo, com brilho que atravessa o botão em loop.
const CtaScene: React.FC<{ cta: string; logoUrl?: string; color: string }> = ({ cta, logoUrl, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit } = useLayout();
  const safe = useSafeArea();
  const move = spring({ frame, fps, config: { damping: 200 } });
  const { cy, radius } = useOrbit(move);
  const button = useEnter(10, 12);
  const logo = useEnter(4);
  const shine = ((frame - 20) % 45) / 45;

  return (
    <AbsoluteFill>
      {logoUrl && <Img src={logoUrl} style={{ position: 'absolute', left: safe.left, top: safe.top, maxWidth: 260 * unit, maxHeight: 90 * unit, objectFit: 'contain', opacity: logo }} />}
      <div style={{ position: 'absolute', left: safe.left, right: safe.right, top: cy + radius + 70 * unit, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          position: 'relative', overflow: 'hidden', backgroundColor: color, color: readableOn(color), fontSize: 70 * unit, fontWeight: 900, padding: `${28 * unit}px ${70 * unit}px`, borderRadius: 999,
          border: `${4 * unit}px solid rgba(255,255,255,0.85)`, boxShadow: `0 0 ${80 * unit}px ${color}88`, transform: `scale(${button * (1 + Math.sin(frame / 6) * 0.02)})`,
        }}>
          {cta}
          {frame > 20 && <div style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', left: `${-40 + shine * 180}%`, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', transform: 'skewX(-20deg)' }} />}
        </div>
      </div>
    </AbsoluteFill>
  );
};
