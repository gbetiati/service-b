// Perfil público de uma conta profissional do Instagram (comercial ou de criador), lido pelo @.
export type InstagramProfile = {
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  profilePictureUrl: string | null;
  followers: number | null;
  captions: string[];
};

// Instagram fora do ar para esta consulta (sem configuração, sem permissão no app ou conta pessoal). A varredura
// continua só com o site e o motivo aparece como aviso na revisão.
export class InstagramUnavailableError extends Error {}

export abstract class InstagramProfileProvider {
  // null quando a conta não existe ou não é profissional.
  abstract find (handle: string): Promise<InstagramProfile | null>;
}
