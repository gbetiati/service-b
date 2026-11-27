import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { LOGO_BUG_SPACE, LogoBadge, LogoBug, FONT_FAMILY, HAND_FONT, SafeArea, benefitGap, fitFontSize, imageAt, inkOnWhite, optionalColor, readableOn, safeColor, useLayout, useSafeArea } from '../shared';
import { AdAudio, AudioCues } from '../audio';

// Story de criador: a foto fica sempre em tela cheia (sem fundos lisos nem cartões), com os elementos que as pessoas
// usam nos próprios Stories e Reels. A headline vem no texto com fundo arredondado por linha da ferramenta de texto do
// Instagram, uma seta e o nome do produto são "escritos à mão" por cima da foto, os benefícios pulam como stickers no
// terço central e o CTA é um sticker de link.
// Linha do tempo (30 fps, 450 frames = 15 s): gancho 0–105 (foto 1), benefícios 105–345 (foto 2), fechamento 345–450 (foto 3).
// A troca de foto entre as cenas é um deslize lateral curto, como o toque para passar um Story.
const SCENES = { hook: [0, 105], benefits: [105, 240], close: [345, 105] } as const;
const SWIPE = 9;
const stickerGap = (count: number) => benefitGap(count, SCENES.benefits[1] - 50, 72);
const audioCues = (bullets: number): AudioCues => ({
  hook: 0, benefits: Array.from({ length: bullets }, (_, index) => SCENES.benefits[0] + 12 + index * stickerGap(bullets)), cta: SCENES.close[0] + 10,
});

export const ProductAdStory: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? color;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(copy.bullets.length)} />
      <Sequence from={SCENES.hook[0]} durationInFrames={SCENES.hook[1] + SWIPE} name="Gancho">
        <Photo imageUrl={imageAt(product, 0)} enterFrom={0} />
        <HookScene headline={copy.headline} name={product.name} color={color} accent={accent} logo={!!brand.logoUrl} />
      </Sequence>
      <Sequence from={SCENES.benefits[0]} durationInFrames={SCENES.benefits[1] + SWIPE} name="Benefícios">
        <Photo imageUrl={imageAt(product, 1)} enterFrom={1} dim={0.25} />
        <StickersScene bullets={copy.bullets} color={color} accent={accent} />
      </Sequence>
      <Sequence from={SCENES.close[0]} durationInFrames={SCENES.close[1]} name="Fechamento">
        <Photo imageUrl={imageAt(product, 2)} enterFrom={1} dim={0.15} />
        <CloseScene name={product.name} price={product.price} oldPrice={product.oldPrice} cta={copy.cta} logoUrl={brand.logoUrl} color={color} accent={accent} />
      </Sequence>
      <LogoBug logoUrl={brand.logoUrl} />
    </AbsoluteFill>
  );
};

// Foto em tela cheia com aproximação lenta e um leve balanço de câmera na mão. A partir da segunda cena, entra
// deslizando da direita com uma pequena rotação 3D, como a passagem de um Story para o próximo.
const Photo: React.FC<{ imageUrl: string; enterFrom: 0 | 1; dim?: number }> = ({ imageUrl, enterFrom, dim = 0 }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const swipe = enterFrom ? interpolate(frame, [0, SWIPE], [1, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 0;
  const push = 1.06 + Math.min(1, frame / 150) * 0.06;
  const x = Math.sin(frame / 19) * 6 * unit;
  const y = Math.cos(frame / 23) * 5 * unit;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', transform: `translateX(${swipe * 100}%) perspective(1600px) rotateY(${-swipe * 18}deg)`, transformOrigin: 'left center' }}>
      <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${x}px, ${y}px) scale(${push})` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${0.35 + dim}) 0%, rgba(0,0,0,${dim}) 30%, rgba(0,0,0,${dim}) 62%, rgba(0,0,0,${0.45 + dim}) 100%)` }} />
    </AbsoluteFill>
  );
};

// Texto com fundo arredondado por linha (estilo da ferramenta de texto do Instagram): já está inteiro no frame 0 e
// assenta com um pequeno salto. Uma seta desenhada à mão aponta para a foto, com o nome do produto escrito ao lado.
const HookScene: React.FC<{ headline: string; name: string; color: string; accent: string; logo: boolean }> = ({ headline, name, color, accent, logo }) => {
  const safe = useSafeArea();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const settle = spring({ frame, fps, from: 1.08, to: 1, config: { damping: 11, mass: 0.6 } });
  const draw = interpolate(frame, [18, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const head = interpolate(frame, [44, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const write = interpolate(frame, [40, 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fontSize = Math.max(88, Math.min(landscape ? 110 : 124, 3600 / Math.max(headline.length, 1))) * unit;
  // Anotação sempre branca com sombra, como a caneta dos Stories: lê sobre foto clara ou escura.
  const hand = '#ffffff';

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center', paddingTop: safe.top + (logo ? LOGO_BUG_SPACE * unit : 0) }}>
      <div style={{ maxWidth: landscape ? '70%' : '100%', textAlign: 'center', transform: `scale(${settle}) rotate(-2deg)` }}>
        <span style={{
          display: 'inline', backgroundColor: color, color: readableOn(color), fontSize, fontWeight: 900, lineHeight: 1.42, letterSpacing: -1 * unit,
          padding: `${0.06 * fontSize}px ${0.32 * fontSize}px`, borderRadius: 0.28 * fontSize, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone',
          boxShadow: `0 ${10 * unit}px ${30 * unit}px rgba(0,0,0,0.25)`,
        }}>{headline}</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 330 * unit, marginTop: 24 * unit, filter: `drop-shadow(0 ${4 * unit}px ${10 * unit}px rgba(0,0,0,0.55))` }}>
        <svg width="100%" height="100%" viewBox="0 0 900 260" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <path d="M520 10 C 600 40, 640 120, 560 200" fill="none" stroke={hand} strokeWidth={15} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          <path d="M520 168 L 558 206 L 602 176" fill="none" stroke={hand} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - head} />
        </svg>
        <div style={{
          position: 'absolute', right: '56%', top: 90 * unit, maxWidth: '58%', fontFamily: `${HAND_FONT}, cursive`, fontSize: Math.max(76, fitFontSize(name, 112, 16)) * unit, fontWeight: 700,
          color: hand, lineHeight: 0.95, textAlign: 'right', transform: 'rotate(-6deg)',
          clipPath: `inset(0 ${(1 - write) * 100}% 0 0)`,
        }}>{name}</div>
      </div>
    </SafeArea>
  );
};

// Benefícios como stickers: cada um pula no terço central, levemente inclinado para um lado, e fica empilhado.
const StickersScene: React.FC<{ bullets: string[]; color: string; accent: string }> = ({ bullets, color, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const gap = stickerGap(bullets.length);

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 * unit, width: landscape ? '62%' : '100%' }}>
        {bullets.map((bullet, index) => {
          const pop = spring({ frame: frame - 12 - index * gap, fps, config: { damping: 10, mass: 0.55 } });
          const tilt = index % 2 ? 2.2 : -2.2;
          const mark = index % 2 ? accent : color;
          return (
            <div key={index} style={{
              display: 'flex', alignItems: 'center', gap: 24 * unit, maxWidth: '100%', padding: `${26 * unit}px ${40 * unit}px ${26 * unit}px ${26 * unit}px`,
              borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.96)', color: '#111111', boxShadow: `0 ${14 * unit}px ${36 * unit}px rgba(0,0,0,0.3)`,
              transform: `scale(${pop}) rotate(${tilt * pop}deg)`, opacity: Math.min(1, pop * 3),
            }}>
              <div style={{ flex: 'none', width: 74 * unit, height: 74 * unit, borderRadius: '50%', backgroundColor: mark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={42 * unit} height={42 * unit} viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke={readableOn(mark)} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div style={{ fontSize: 58 * unit, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.5 * unit }}>{bullet}</div>
            </div>
          );
        })}
      </div>
    </SafeArea>
  );
};

// Fechamento: preço como etiqueta (quando há), o nome escrito à mão e o CTA no formato do sticker de link do
// Instagram, com um toque animado que mostra onde tocar.
const CloseScene: React.FC<{ name: string; price?: string; oldPrice?: string; cta: string; logoUrl?: string; color: string; accent: string }> = ({ name, price, oldPrice, cta, logoUrl, color, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const sticker = spring({ frame: frame - 10, fps, config: { damping: 11, mass: 0.6 } });
  const tag = spring({ frame: frame - 4, fps, config: { damping: 12 } });
  const write = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: 'clamp' });
  const tap = (frame - 44) % 40;
  const ripple = frame >= 44 ? interpolate(tap, [0, 24], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const pulse = 1 + (frame >= 44 ? Math.max(0, Math.sin((tap / 40) * Math.PI)) * 0.04 : 0);
  const ink = inkOnWhite(color);

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center', gap: 44 * unit }}>
      {logoUrl && <LogoBadge logoUrl={logoUrl} height={150} style={{ opacity: Math.min(1, tag * 1.5), transform: `scale(${0.9 + 0.1 * Math.min(1, tag)})` }} />}
      <div style={{
        fontFamily: `${HAND_FONT}, cursive`, fontSize: Math.max(84, fitFontSize(name, 124, 16)) * unit, fontWeight: 700, color: '#ffffff', textAlign: 'center', lineHeight: 0.95,
        transform: 'rotate(-4deg)', textShadow: `0 ${4 * unit}px ${14 * unit}px rgba(0,0,0,0.5)`, clipPath: `inset(0 ${(1 - write) * 100}% 0 0)`, maxWidth: landscape ? '70%' : '100%',
      }}>{name}</div>
      {price && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 18 * unit, padding: `${14 * unit}px ${34 * unit}px`, borderRadius: 22 * unit, backgroundColor: accent,
          color: readableOn(accent), transform: `scale(${tag}) rotate(${3 * tag}deg)`, boxShadow: `0 ${12 * unit}px ${30 * unit}px rgba(0,0,0,0.3)`,
        }}>
          {oldPrice && <span style={{ fontSize: 40 * unit, fontWeight: 600, opacity: 0.7, textDecoration: 'line-through' }}>{oldPrice}</span>}
          <span style={{ fontSize: fitFontSize(price, 84, 9) * unit, fontWeight: 900, letterSpacing: -1.5 * unit }}>{price}</span>
        </div>
      )}
      <div style={{ position: 'relative', maxWidth: '100%', transform: `scale(${sticker * pulse})` }}>
        {ripple > 0 && <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 120 * unit, height: 120 * unit, marginLeft: -60 * unit, marginTop: -60 * unit, borderRadius: '50%',
          border: `${6 * unit}px solid #ffffff`, opacity: 1 - ripple, transform: `scale(${0.4 + ripple * 2.6})`,
        }} />}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20 * unit, padding: `${24 * unit}px ${44 * unit}px ${24 * unit}px ${30 * unit}px`, borderRadius: 26 * unit,
          backgroundColor: '#ffffff', color: ink, boxShadow: `0 ${16 * unit}px ${44 * unit}px rgba(0,0,0,0.35)`,
        }}>
          <svg width={50 * unit} height={50 * unit} viewBox="0 0 24 24">
            <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"
              fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 60 * unit, fontWeight: 900, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: 0.5 * unit }}>{cta}</span>
        </div>
      </div>
    </SafeArea>
  );
};
