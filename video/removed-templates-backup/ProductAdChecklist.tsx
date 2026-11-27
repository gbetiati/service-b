import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { imageAt, FONT_FAMILY, ProductImage, SafeArea, benefitGap, fitFontSize, inkOnWhite, optionalColor, readableOn, safeColor, splitWords, useEnter, useLayout, useSafeArea } from '../shared';
import { AdAudio, AudioCues } from '../audio';

// Lista de verificação: a headline promete, cada benefício é marcado num cartão e o vídeo fecha com um toque no CTA.
// Linha do tempo (30 fps, 450 frames = 15 s). Os itens são marcados no ritmo da locução e o fechamento com preço e
// CTA fica 4 s na tela.
const SCENES = { hook: [0, 90], checklist: [90, 240], close: [330, 120] } as const;
const tickGap = (count: number) => benefitGap(count, SCENES.checklist[1] - 60, 70);
// Frames em que gancho, benefícios (quando cada um é marcado) e chamada aparecem, para a locução acompanhar o texto.
const audioCues = (bullets: number): AudioCues => ({ hook: 0, benefits: Array.from({ length: bullets }, (_, index) => SCENES.checklist[0] + 26 + index * tickGap(bullets)), cta: SCENES.close[0] + 16 });

export const ProductAdChecklist: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? readableOn(color);
  // Cor de apoio para elementos sobre fundo branco (caixas marcadas, CTA). Sem ela, a principal.
  const pop = optionalColor(brand.secondaryColor) ?? color;

  return (
    <AbsoluteFill style={{ backgroundColor: color, color: readableOn(color), fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(copy.bullets.length)} />
      <DotGrid color={accent} />
      <Sequence from={SCENES.hook[0]} durationInFrames={SCENES.hook[1]} name="Hook">
        <HookScene imageUrl={imageAt(product, 0)} headline={copy.headline} color={color} accent={accent} duration={SCENES.hook[1]} />
      </Sequence>
      <Sequence from={SCENES.checklist[0]} durationInFrames={SCENES.checklist[1]} name="Checklist">
        <ChecklistScene imageUrl={imageAt(product, 1)} name={product.name} bullets={copy.bullets} color={pop} duration={SCENES.checklist[1]} />
      </Sequence>
      <Sequence from={SCENES.close[0]} durationInFrames={SCENES.close[1]} name="Close">
        <CloseScene imageUrl={imageAt(product, 2)} name={product.name} price={product.price} oldPrice={product.oldPrice} cta={copy.cta} logoUrl={brand.logoUrl} color={pop} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Grade de pontos que desliza devagar: dá textura ao fundo liso sem competir com o texto.
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const size = 48 * unit;
  return (
    <AbsoluteFill style={{
      opacity: 0.12, backgroundImage: `radial-gradient(${color} ${2.5 * unit}px, transparent ${3 * unit}px)`,
      backgroundSize: `${size}px ${size}px`, backgroundPosition: `${(frame * 0.6 * unit) % size}px ${(frame * 0.6 * unit) % size}px`,
    }} />
  );
};

// A foto já está na tela no primeiro frame (miniatura do autoplay); as palavras da headline entram em sequência rápida
// e a última recebe um marca-texto.
const HookScene: React.FC<{ imageUrl: string; headline: string; color: string; accent: string; duration: number }> = ({ imageUrl, headline, color, accent, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const safe = useSafeArea();
  const words = splitWords(headline);
  const card = useEnter(0, 18);
  const marker = interpolate(frame, [words.length * 3 + 10, words.length * 3 + 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const exit = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoom = interpolate(frame, [0, duration], [1.12, 1], { extrapolateRight: 'clamp' });

  return (
    <SafeArea style={{ flexDirection: landscape ? 'row' : 'column', gap: 48 * unit, opacity: exit, alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', columnGap: '0.26em', flex: landscape ? 1 : undefined, fontSize: (landscape ? 84 : 92) * unit, fontWeight: 900, lineHeight: 1.04, letterSpacing: -2 * unit }}>
        {words.map((word, index) => {
          const progress = spring({ frame: frame - index * 3, fps, config: { damping: 12, mass: 0.5 } });
          const last = index === words.length - 1;
          return (
            <span key={index} style={{
              display: 'inline-block', opacity: Math.min(1, progress * 2), transform: `translateY(${(1 - progress) * 40 * unit}px) scale(${0.7 + 0.3 * progress})`, transformOrigin: 'left bottom',
              ...(last && { backgroundImage: `linear-gradient(${accent}88, ${accent}88)`, backgroundRepeat: 'no-repeat', backgroundSize: `${marker * 100}% 38%`, backgroundPosition: '0 88%' }),
            }}>{word}</span>
          );
        })}
      </div>
      {/* No 9x16 o cartão avança sobre a margem de baixo: é imagem, pode ficar sob a interface. */}
      <div style={{
        flex: landscape ? '0 0 46%' : '1 1 0', minHeight: 0, marginBottom: safe.tall ? -safe.bottom * 0.55 : 0, borderRadius: 40 * unit, overflow: 'hidden', position: 'relative',
        boxShadow: `0 ${30 * unit}px ${80 * unit}px rgba(0,0,0,0.35)`, border: `${10 * unit}px solid ${accent}`,
        transform: `translateY(${(1 - card) * 120 * unit}px) rotate(${(1 - card) * 4}deg)`,
      }}>
        <ProductImage imageUrl={imageUrl} zoom={zoom} />
      </div>
    </SafeArea>
  );
};

// Cartão branco com os benefícios: cada linha começa apagada e é marcada em sequência, com contador no cabeçalho.
const ChecklistScene: React.FC<{ imageUrl: string; name: string; bullets: string[]; color: string; duration: number }> = ({ imageUrl, name, bullets, color, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape, portrait } = useLayout();
  const card = useEnter(0, 16);
  const exit = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const step = tickGap(bullets.length);
  const tickAt = (index: number) => 26 + index * step;
  const ticked = bullets.filter((_, index) => frame >= tickAt(index) + 6).length;
  const box = 72 * unit;

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center', opacity: exit }}>
      <div style={{
        width: '100%', maxWidth: landscape ? 1300 * unit : undefined, backgroundColor: '#ffffff', color: '#111111', borderRadius: 44 * unit, padding: 52 * unit, borderTop: `${18 * unit}px solid ${color}`,
        boxShadow: `0 ${30 * unit}px ${90 * unit}px rgba(0,0,0,0.3)`, transform: `translateY(${(1 - card) * 160 * unit}px) scale(${0.94 + 0.06 * card})`, opacity: card,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 * unit, paddingBottom: 34 * unit, marginBottom: 34 * unit, borderBottom: `${3 * unit}px solid #ececf0` }}>
          <div style={{ width: 120 * unit, height: 120 * unit, borderRadius: 26 * unit, overflow: 'hidden', flexShrink: 0 }}>
            <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1, fontSize: 46 * unit, fontWeight: 800, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 40 * unit, fontWeight: 800, color: ticked === bullets.length && bullets.length ? inkOnWhite(color) : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{`${ticked}/${bullets.length}`}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 * unit }}>
          {bullets.map((bullet, index) => {
            const appear = spring({ frame: frame - 8 - index * 4, fps, config: { damping: 200 } });
            const tick = spring({ frame: frame - tickAt(index), fps, config: { damping: 200 }, durationInFrames: 10 });
            const bounce = spring({ frame: frame - tickAt(index), fps, config: { damping: 8, mass: 0.4 } });
            return (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 30 * unit, opacity: appear, transform: `translateX(${(1 - appear) * 40 * unit}px) scale(${1 + Math.sin(bounce * Math.PI) * 0.04})`, transformOrigin: 'left center' }}>
                <div style={{
                  width: box, height: box, borderRadius: 20 * unit, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `${5 * unit}px solid ${tick > 0.05 ? color : '#d4d4d8'}`, backgroundColor: tick > 0.05 ? color : 'transparent',
                }}>
                  <svg width={box * 0.62} height={box * 0.62} viewBox="0 0 24 24">
                    <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={readableOn(color)} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
                  </svg>
                </div>
                <div style={{ fontSize: (portrait ? 50 : 44) * unit, fontWeight: 700, lineHeight: 1.15, color: tick > 0.5 ? '#111111' : '#9ca3af' }}>{bullet}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SafeArea>
  );
};

// Foto em tela cheia, preço e um botão de CTA que recebe um "toque" (ponto que desliza e pressiona, com onda).
const CloseScene: React.FC<{ imageUrl: string; name: string; price?: string; oldPrice?: string; cta: string; logoUrl?: string; color: string }> = ({ imageUrl, name, price, oldPrice, cta, logoUrl, color }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { unit } = useLayout();
  const enter = useEnter(0);
  const priceIn = useEnter(8, 11);
  const button = useEnter(16, 13);
  const zoom = interpolate(frame, [0, durationInFrames], [1.05, 1.18]);
  const tapAt = 50;
  const finger = interpolate(frame, [30, tapAt], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const press = frame >= tapAt ? 1 - Math.sin(Math.min(1, (frame - tapAt) / 8) * Math.PI) * 0.08 : 1;
  const ripple = spring({ frame: frame - tapAt, fps, config: { damping: 200 }, durationInFrames: 24 });
  const fingerOpacity = interpolate(frame, [26, 32, tapAt + 10, tapAt + 18], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse = frame > tapAt + 20 ? 1 + Math.sin((frame - tapAt) / 5) * 0.025 : 1;

  return (
    <AbsoluteFill>
      <ProductImage imageUrl={imageUrl} zoom={zoom} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.8) 100%)' }} />
      <SafeArea style={{ justifyContent: 'space-between', alignItems: 'center', textAlign: 'center', color: '#ffffff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 * unit, opacity: enter, transform: `translateY(${(1 - enter) * -30 * unit}px)` }}>
          {logoUrl && <Img src={logoUrl} style={{ maxWidth: 280 * unit, maxHeight: 110 * unit, objectFit: 'contain' }} />}
          <div style={{ fontSize: 54 * unit, fontWeight: 800, lineHeight: 1.1, textShadow: `0 ${4 * unit}px ${20 * unit}px rgba(0,0,0,0.5)` }}>{name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 * unit }}>
          {price && (
            <div style={{ opacity: Math.min(1, priceIn * 1.5), transform: `scale(${1.6 - 0.6 * priceIn})` }}>
              {oldPrice && <div style={{ fontSize: 46 * unit, fontWeight: 600, opacity: 0.8, textDecoration: 'line-through', textDecorationThickness: 4 * unit }}>{oldPrice}</div>}
              <div style={{ fontSize: fitFontSize(price, 140, 9) * unit, fontWeight: 900, letterSpacing: -3 * unit, lineHeight: 1, textShadow: `0 ${6 * unit}px ${30 * unit}px rgba(0,0,0,0.5)` }}>{price}</div>
            </div>
          )}
          <div style={{ position: 'relative', transform: `scale(${button * press * pulse})` }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 999, border: `${6 * unit}px solid #ffffff`, transform: `scale(${1 + ripple * 0.5})`, opacity: frame >= tapAt ? 1 - ripple : 0 }} />
            <div style={{ backgroundColor: color, color: readableOn(color), fontSize: 66 * unit, fontWeight: 900, padding: `${28 * unit}px ${68 * unit}px`, borderRadius: 999, boxShadow: `0 ${16 * unit}px ${50 * unit}px rgba(0,0,0,0.4)` }}>{cta}</div>
            <div style={{
              position: 'absolute', left: '62%', top: '58%', width: 70 * unit, height: 70 * unit, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)',
              border: `${4 * unit}px solid rgba(0,0,0,0.25)`, opacity: fingerOpacity, transform: `translate(${finger * 220 * unit}px, ${finger * 260 * unit}px) scale(${frame >= tapAt && frame < tapAt + 8 ? 0.8 : 1})`,
            }} />
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};
