import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/fonts';
import type { ProductAdProps } from '../../../src/modules/video-generation/domain/entities/product-ad';

const FONT_FAMILY = 'Inter';

// Fonte local (video/public/fonts): o render não depende de rede para tipografia.
loadFont({ family: FONT_FAMILY, url: staticFile('fonts/Inter.ttf'), weight: '100 900' });

// Linha do tempo (30 fps, 360 frames = 12 s).
const SCENES = { intro: [0, 105], bullets: [105, 105], price: [210, 75], cta: [285, 75] } as const;

export const ProductAd: React.FC<ProductAdProps> = ({ copy, product, brand }) => {
  const color = safeColor(brand.primaryColor);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0b0f', fontFamily: `${FONT_FAMILY}, sans-serif`, color: '#fff' }}>
      <Sequence from={SCENES.intro[0]} durationInFrames={SCENES.intro[1]} name="Intro">
        <IntroScene imageUrl={product.imageUrl} name={product.name} headline={copy.headline} color={color} />
      </Sequence>
      <Sequence from={SCENES.bullets[0]} durationInFrames={SCENES.bullets[1]} name="Bullets">
        <BulletsScene imageUrl={product.imageUrl} bullets={copy.bullets} color={color} />
      </Sequence>
      <Sequence from={SCENES.price[0]} durationInFrames={SCENES.price[1]} name="Price">
        <PriceScene imageUrl={product.imageUrl} name={product.name} price={product.price} oldPrice={product.oldPrice} color={color} />
      </Sequence>
      <Sequence from={SCENES.cta[0]} durationInFrames={SCENES.cta[1]} name="CTA">
        <CtaScene cta={copy.cta} logoUrl={brand.logoUrl} color={color} />
      </Sequence>
    </AbsoluteFill>
  );
};

function useLayout () {
  const { width, height } = useVideoConfig();
  return { unit: Math.min(width, height) / 1080, landscape: width > height, portrait: height > width };
}

function useEnter (delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 } });
}

const ProductImage: React.FC<{ imageUrl: string; zoom: number; dim?: number; blur?: number }> = ({ imageUrl, zoom, dim = 0, blur = 0 }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, filter: blur ? `blur(${blur}px)` : undefined }} />
    {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />}
  </AbsoluteFill>
);

const IntroScene: React.FC<{ imageUrl: string; name: string; headline: string; color: string }> = ({ imageUrl, name, headline, color }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.12], { extrapolateRight: 'clamp' });
  const enter = useEnter(10);
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <ProductImage imageUrl={imageUrl} zoom={zoom} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 80 * unit, paddingBottom: (landscape ? 80 : 140) * unit }}>
        <div style={{ transform: `translateY(${(1 - enter) * 60 * unit}px)`, opacity: enter, maxWidth: landscape ? '60%' : '100%' }}>
          <div style={{ display: 'inline-block', backgroundColor: color, color: readableOn(color), fontSize: 34 * unit, fontWeight: 700, padding: `${10 * unit}px ${22 * unit}px`, borderRadius: 12 * unit, marginBottom: 24 * unit }}>
            {name}
          </div>
          <div style={{ fontSize: 92 * unit, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 * unit }}>{headline}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BulletsScene: React.FC<{ imageUrl: string; bullets: string[]; color: string }> = ({ imageUrl, bullets, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const zoom = interpolate(frame, [0, 105], [1.12, 1.2], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <ProductImage imageUrl={imageUrl} zoom={zoom} dim={0.6} blur={8 * unit} />
      <AbsoluteFill style={{ justifyContent: 'center', padding: 90 * unit, gap: 36 * unit, alignItems: landscape ? 'flex-start' : 'stretch' }}>
        {bullets.map((bullet, index) => {
          const progress = spring({ frame: frame - 8 - index * 14, fps, config: { damping: 200 } });
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 28 * unit, opacity: progress, transform: `translateX(${(1 - progress) * -80 * unit}px)` }}>
              <div style={{ width: 22 * unit, height: 22 * unit, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <div style={{ fontSize: 60 * unit, fontWeight: 700, lineHeight: 1.15 }}>{bullet}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PriceScene: React.FC<{ imageUrl: string; name: string; price?: string; oldPrice?: string; color: string }> = ({ imageUrl, name, price, oldPrice, color }) => {
  const { unit } = useLayout();
  const enter = useEnter(0);
  const priceEnter = useEnter(10);

  return (
    <AbsoluteFill>
      <ProductImage imageUrl={imageUrl} zoom={1.2} dim={0.7} blur={14 * unit} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 80 * unit }}>
        <div style={{ fontSize: 52 * unit, fontWeight: 600, opacity: enter, marginBottom: 28 * unit }}>{name}</div>
        {price && oldPrice && (
          <div style={{ fontSize: 56 * unit, fontWeight: 500, opacity: 0.7 * enter, textDecoration: 'line-through', textDecorationThickness: 4 * unit }}>{oldPrice}</div>
        )}
        {price && (
          <div style={{ fontSize: 150 * unit, fontWeight: 900, color, transform: `scale(${0.6 + 0.4 * priceEnter})`, opacity: priceEnter, letterSpacing: -3 * unit }}>{price}</div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC<{ cta: string; logoUrl?: string; color: string }> = ({ cta, logoUrl, color }) => {
  const { unit } = useLayout();
  const enter = useEnter(0);
  const pulse = 1 + Math.sin(useCurrentFrame() / 6) * 0.02;

  return (
    <AbsoluteFill style={{ backgroundColor: color, justifyContent: 'center', alignItems: 'center', gap: 60 * unit }}>
      {logoUrl && <Img src={logoUrl} style={{ maxWidth: 360 * unit, maxHeight: 180 * unit, objectFit: 'contain', opacity: enter }} />}
      <div style={{ backgroundColor: readableOn(color), color, fontSize: 72 * unit, fontWeight: 800, padding: `${28 * unit}px ${64 * unit}px`, borderRadius: 999, transform: `scale(${(0.8 + 0.2 * enter) * pulse})`, opacity: enter }}>
        {cta}
      </div>
    </AbsoluteFill>
  );
};

function safeColor (value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#2563eb';
}

function readableOn (hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
}
