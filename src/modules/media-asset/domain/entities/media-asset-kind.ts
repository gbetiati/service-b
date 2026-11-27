// Tipo da foto do produto: só o produto ou com pessoas (em uso, no dia a dia). Os templates de foto escolhem a foto de
// cada cena pelo tipo preferido nela. Vídeos também guardam o tipo, mas os templates de vídeo não o usam.
export enum MediaAssetKind {
  PRODUCT = 'PRODUCT',
  PERSON = 'PERSON',
}
