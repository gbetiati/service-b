// Gerador pseudoaleatório com semente: a mesma semente produz sempre a mesma sequência em [0, 1).
// Permite variar os anúncios e, ainda assim, reproduzir e explicar qualquer escolha a partir da semente.
export type Random = () => number;

export function seededRandom (seed: string): Random {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// FNV-1a de 32 bits.
function hash (text: string) {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
  return value >>> 0;
}
