import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { imageAt, FONT_FAMILY, ProductImage, benefitGap, fitFontSize, optionalColor, readableOn, safeColor, splitWords, useEnter, useLayout, useSafeArea } from '../shared';
import { AdAudio, AudioCues } from '../audio';

// Oferta primeiro: o vídeo abre com o preço (e o desconto, se houver preço antigo), mostra o produto, os benefícios em
// faixas rápidas e fecha retomando o preço junto do CTA. Sem preço cadastrado, a headline ocupa o lugar da oferta.
// Linha do tempo (30 fps, 450 frames = 15 s). As faixas de benefícios entram no ritmo da locução.
const SCENES = { offer: [0, 75], product: [75, 60], benefits: [135, 195], close: [330, 120] } as const;
const barGap = (count: number) => benefitGap(count, SCENES.benefits[1] - 30, 55);
// Frames em que gancho, benefícios e chamada aparecem, para a locução acompanhar o texto. A locução abre com a
// headline enquanto a oferta ocupa a tela.
const audioCues = (bullets: number): AudioCues => ({ hook: 0, benefits: Array.from({ length: bullets }, (_, index) => SCENES.benefits[0] + 4 + index * barGap(bullets)), cta: SCENES.close[0] + 16 });

export const ProductAdOffer: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? '#111111';
  const discount = discountPercent(product.price, product.oldPrice);
  const tape = `${product.name}  •  ${copy.cta}  •  `;

  return (
    <AbsoluteFill style={{ backgroundColor: color, color: readableOn(color), fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(copy.bullets.length)} />
      <Sequence from={SCENES.offer[0]} durationInFrames={SCENES.offer[1]} name="Offer">
        <OfferScene name={product.name} headline={copy.headline} price={product.price} oldPrice={product.oldPrice} discount={discount} color={color} accent={accent} tape={tape} />
      </Sequence>
      <Sequence from={SCENES.product[0]} durationInFrames={SCENES.product[1]} name="Product">
        <ProductScene imageUrl={imageAt(product, 0)} text={product.price ? copy.headline : product.name} accent={accent} />
      </Sequence>
      <Sequence from={SCENES.benefits[0]} durationInFrames={SCENES.benefits[1]} name="Benefits">
        <BenefitsScene imageUrl={imageAt(product, 1)} bullets={copy.bullets} color={color} accent={accent} />
      </Sequence>
      <Sequence from={SCENES.close[0]} durationInFrames={SCENES.close[1]} name="Close">
        <CloseScene imageUrl={imageAt(product, 2)} price={product.price} oldPrice={product.oldPrice} discount={discount} cta={copy.cta} logoUrl={brand.logoUrl} color={color} accent={accent} tape={tape} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Percentual de desconto calculado dos preços do cadastro ("R$ 1.299,90"). Abaixo de 5% não vale destacar.
function discountPercent (price?: string, oldPrice?: string) {
  if (!price || !oldPrice) return undefined;
  const parse = (value: string) => Number(value.replace(/[^\d,]/g, '').replace(',', '.'));
  const [now, before] = [parse(price), parse(oldPrice)];
  if (!(now > 0) || !(before > now)) return undefined;
  const percent = Math.round((1 - now / before) * 100);
  return percent >= 5 ? percent : undefined;
}

// Margens das cenas com fita: no 9x16 a área segura já sobra; nos outros formatos, abre espaço para as fitas.
function useTapedArea () {
  const safe = useSafeArea();
  const { unit } = useLayout();
  const tape = 170 * unit;
  return { ...safe, top: Math.max(safe.top, tape), bottom: Math.max(safe.bottom, tape) };
}

// Fita diagonal com texto correndo, nas bordas de cima e de baixo.
const Tape: React.FC<{ text: string; edge: 'top' | 'bottom'; background: string }> = ({ text, edge, background }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const enter = useEnter(edge === 'top' ? 0 : 4);
  const height = 84 * unit;
  const direction = edge === 'top' ? -1 : 1;
  const shift = frame * 5 * unit;

  return (
    <div style={{
      position: 'absolute', left: '-20%', width: '140%', height, [edge]: 40 * unit, backgroundColor: background, color: readableOn(background), overflow: 'hidden',
      display: 'flex', alignItems: 'center', transform: `rotate(${direction * -4}deg) translateX(${(1 - enter) * direction * 100}%)`, boxShadow: `0 ${10 * unit}px ${30 * unit}px rgba(0,0,0,0.25)`,
    }}>
      <div style={{ whiteSpace: 'nowrap', fontSize: 40 * unit, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2 * unit, transform: `translateX(${direction * shift - 2000}px)` }}>
        {text.repeat(30)}
      </div>
    </div>
  );
};

// Selo estrelado girando devagar com o percentual de desconto.
const Burst: React.FC<{ percent: number; size: number; color: string; delay: number }> = ({ percent, size, color, delay }) => {
  const frame = useCurrentFrame();
  const pop = useEnter(delay, 9);
  const spikes = 18;
  const points = Array.from({ length: spikes * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? 50 : 42;
    const angle = (index * Math.PI) / spikes;
    return `${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`;
  }).join(' ');

  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `scale(${pop}) rotate(${(1 - pop) * -90 - 12}deg)` }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, transform: `rotate(${frame * 0.8}deg)` }}>
        <polygon points={points} fill={color} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: readableOn(color), fontSize: size * 0.27, fontWeight: 900, letterSpacing: -size * 0.01 }}>{`-${percent}%`}</div>
    </div>
  );
};

const OfferScene: React.FC<{ name: string; headline: string; price?: string; oldPrice?: string; discount?: number; color: string; accent: string; tape: string }> = ({ name, headline, price, oldPrice, discount, color, accent, tape }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const area = useTapedArea();
  const slam = useEnter(0, 10);
  const label = useEnter(6);
  const strike = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const shake = frame < 14 ? Math.sin(frame * 2.2) * (14 - frame) * 0.6 * unit : 0;
  const exit = interpolate(frame, [SCENES.offer[1] - 10, SCENES.offer[1]], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <Tape text={tape} edge="top" background={accent} />
      <Tape text={tape} edge="bottom" background={accent} />
      <AbsoluteFill style={{ paddingTop: area.top, paddingBottom: area.bottom, paddingLeft: area.left, paddingRight: area.right, justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `translateX(${shake}px)` }}>
        {price ? (
          <>
            <div style={{ fontSize: 44 * unit, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 * unit, opacity: label, marginBottom: 18 * unit }}>{name}</div>
            {oldPrice && (
              <div style={{ position: 'relative', fontSize: 64 * unit, fontWeight: 700, opacity: 0.75 * label }}>
                {oldPrice}
                <div style={{ position: 'absolute', left: '-4%', top: '52%', height: 7 * unit, width: `${strike * 108}%`, backgroundColor: accent, transform: 'rotate(-6deg)', borderRadius: 4 * unit }} />
              </div>
            )}
            <div style={{ fontSize: fitFontSize(price, landscape ? 190 : 180, 8) * unit, fontWeight: 900, lineHeight: 1, letterSpacing: -6 * unit, transform: `scale(${2.4 - 1.4 * slam})`, opacity: Math.min(1, slam * 1.6) }}>{price}</div>
            {discount && <div style={{ marginTop: 30 * unit }}><Burst percent={discount} size={260 * unit} color={accent} delay={14} /></div>}
          </>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.24em', fontSize: 120 * unit, fontWeight: 900, lineHeight: 1, letterSpacing: -3 * unit, textTransform: 'uppercase' }}>
            {splitWords(headline).map((word, index) => {
              const progress = spring({ frame: frame - index * 4, fps, config: { damping: 10, mass: 0.5 } });
              return <span key={index} style={{ display: 'inline-block', opacity: Math.min(1, progress * 2), transform: `scale(${2 - progress})` }}>{word}</span>;
            })}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Foto em cartão entrando de lado, com a headline embaixo (ou ao lado, no 16x9).
const ProductScene: React.FC<{ imageUrl: string; text: string; accent: string }> = ({ imageUrl, text, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const safe = useSafeArea();
  const card = spring({ frame, fps, config: { damping: 15, mass: 0.7 } });
  const zoom = interpolate(frame, [0, SCENES.product[1]], [1.2, 1.05]);
  const exit = interpolate(frame, [SCENES.product[1] - 9, SCENES.product[1]], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });

  return (
    <AbsoluteFill style={{ paddingTop: safe.top, paddingBottom: safe.bottom, paddingLeft: safe.left, paddingRight: safe.right, flexDirection: landscape ? 'row' : 'column', alignItems: 'stretch', gap: 44 * unit, transform: `translateX(${-exit * width}px)` }}>
      <div style={{
        flex: landscape ? '0 0 48%' : '1 1 0', minHeight: 0, borderRadius: 40 * unit, overflow: 'hidden', border: `${8 * unit}px solid ${accent}`,
        boxShadow: `0 ${30 * unit}px ${80 * unit}px rgba(0,0,0,0.35)`, transform: `translateX(${(1 - card) * width}px) rotate(${(1 - card) * 12}deg)`,
      }}>
        <ProductImage imageUrl={imageUrl} zoom={zoom} />
      </div>
      <TextBlock text={text} delay={10} />
    </AbsoluteFill>
  );
};

const TextBlock: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', columnGap: '0.26em', flex: landscape ? 1 : undefined, fontSize: (landscape ? 80 : 78) * unit, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 * unit }}>
      {splitWords(text).map((word, index) => {
        const progress = spring({ frame: frame - delay - index * 3, fps, config: { damping: 200 } });
        return <span key={index} style={{ display: 'inline-block', opacity: progress, transform: `translateY(${(1 - progress) * 50 * unit}px)` }}>{word}</span>;
      })}
    </div>
  );
};

// Faixas inclinadas que entram alternando os lados e se endireitam ao parar.
const BenefitsScene: React.FC<{ imageUrl: string; bullets: string[]; color: string; accent: string }> = ({ imageUrl, bullets, color, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { unit, portrait } = useLayout();
  const safe = useSafeArea();
  const stagger = barGap(bullets.length);
  const exit = interpolate(frame, [SCENES.benefits[1] - 10, SCENES.benefits[1]], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Alterna a cor de apoio com a de contraste; se as duas coincidirem (ex.: preto sobre amarelo), usa branco.
  const fills = [accent, readableOn(color) === accent ? '#ffffff' : readableOn(color)];

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <ProductImage imageUrl={imageUrl} zoom={interpolate(frame, [0, SCENES.benefits[1]], [1.1, 1.2])} dim={0.35} blur={6 * unit} />
      <AbsoluteFill style={{ backgroundColor: color, opacity: 0.55 }} />
      <AbsoluteFill style={{ paddingTop: safe.top, paddingBottom: safe.bottom, paddingLeft: safe.left, paddingRight: safe.right, justifyContent: 'center', gap: 28 * unit }}>
        {bullets.map((bullet, index) => {
          const side = index % 2 === 0 ? -1 : 1;
          const progress = spring({ frame: frame - 4 - index * stagger, fps, config: { damping: 14, mass: 0.6 } });
          const fill = fills[index % 2];
          return (
            <div key={index} style={{
              alignSelf: side < 0 ? 'flex-start' : 'flex-end', maxWidth: '92%', backgroundColor: fill, color: readableOn(fill), fontSize: (portrait ? 58 : 50) * unit, fontWeight: 900, lineHeight: 1.12,
              padding: `${24 * unit}px ${36 * unit}px`, borderRadius: 20 * unit, boxShadow: `0 ${16 * unit}px ${40 * unit}px rgba(0,0,0,0.3)`,
              transform: `translateX(${side * (1 - progress) * width}px) skewX(${(1 - Math.min(1, progress)) * side * 18 - 2}deg)`,
            }}>{bullet}</div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Fechamento com a oferta de novo ao lado da foto e um CTA pulsando. No 9x16 empilha; no 16x9, foto à esquerda.
const CloseScene: React.FC<{ imageUrl: string; price?: string; oldPrice?: string; discount?: number; cta: string; logoUrl?: string; color: string; accent: string; tape: string }> = ({ imageUrl, price, oldPrice, discount, cta, logoUrl, color, accent, tape }) => {
  const frame = useCurrentFrame();
  const { unit, landscape } = useLayout();
  const area = useTapedArea();
  const photo = useEnter(0, 14);
  const priceIn = useEnter(8, 11);
  const button = useEnter(16, 12);
  const size = landscape ? area.height * 0.82 : Math.min(area.width * 0.6, area.height * 0.42);
  const pulse = 1 + Math.sin(frame / 5) * 0.03;

  return (
    <AbsoluteFill>
      <Tape text={tape} edge="top" background={accent} />
      <Tape text={tape} edge="bottom" background={accent} />
      <AbsoluteFill style={{ paddingTop: area.top, paddingBottom: area.bottom, paddingLeft: area.left, paddingRight: area.right, flexDirection: landscape ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', gap: 48 * unit }}>
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, transform: `scale(${photo}) rotate(${(1 - photo) * -10 - 3}deg)` }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 36 * unit, overflow: 'hidden', border: `${8 * unit}px solid ${accent}`, boxShadow: `0 ${24 * unit}px ${70 * unit}px rgba(0,0,0,0.35)` }}>
            <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          {discount && <div style={{ position: 'absolute', right: -50 * unit, top: -50 * unit }}><Burst percent={discount} size={190 * unit} color={accent} delay={10} /></div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 30 * unit, flex: landscape ? 1 : undefined }}>
          {logoUrl && <Img src={logoUrl} style={{ maxWidth: 240 * unit, maxHeight: 90 * unit, objectFit: 'contain', opacity: photo }} />}
          {price && (
            <div style={{ opacity: priceIn, transform: `translateY(${(1 - priceIn) * 40 * unit}px)` }}>
              {oldPrice && <div style={{ fontSize: 44 * unit, fontWeight: 700, opacity: 0.7, textDecoration: 'line-through', textDecorationThickness: 4 * unit }}>{oldPrice}</div>}
              <div style={{ fontSize: fitFontSize(price, 120, 9) * unit, fontWeight: 900, letterSpacing: -4 * unit, lineHeight: 1 }}>{price}</div>
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20 * unit, backgroundColor: accent, color: readableOn(accent), fontSize: 62 * unit, fontWeight: 900, textTransform: 'uppercase',
            padding: `${26 * unit}px ${56 * unit}px`, borderRadius: 999, transform: `scale(${button * pulse})`, boxShadow: `0 ${16 * unit}px ${40 * unit}px rgba(0,0,0,0.3)`,
          }}>
            {cta}
            <svg width={52 * unit} height={52 * unit} viewBox="0 0 24 24" style={{ transform: `translateX(${Math.abs(Math.sin(frame / 6)) * 10 * unit}px)` }}>
              <path d="M4 12h15M13 5l7 7-7 7" fill="none" stroke={readableOn(accent)} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
