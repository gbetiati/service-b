// Tipo de mídia do conteúdo: o anúncio é montado com fotos ou com vídeos reais do produto ou serviço, nunca os dois.
export enum ContentMediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

// Confere se uma mídia (pelo MIME guardado no cadastro) serve para o tipo do conteúdo.
export function mediaMatchesType (contentType: string, mediaType: ContentMediaType) {
  return contentType.startsWith(mediaType === ContentMediaType.VIDEO ? 'video/' : 'image/');
}

export function mediaTypeLabel (mediaType: ContentMediaType, plural = false) {
  if (mediaType === ContentMediaType.VIDEO) return plural ? 'vídeos' : 'vídeo';

  return plural ? 'fotos' : 'foto';
}
