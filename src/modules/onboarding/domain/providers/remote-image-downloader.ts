// Baixa uma imagem pública (ex.: o logo encontrado no site ou a foto do perfil do Instagram).
export abstract class RemoteImageDownloader {
  abstract download (url: string): Promise<Buffer>;
}
