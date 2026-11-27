// Prepara o logo enviado para o storage: valida a imagem e devolve um PNG de tamanho limitado, mantendo a transparência.
export abstract class LogoImageProcessor {
  abstract normalize (input: Buffer): Promise<Buffer>;
}
