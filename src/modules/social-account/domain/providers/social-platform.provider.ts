export type SocialToken = { accessToken: string; expiresAt: Date };
export type ConnectedAccount = SocialToken & { externalId: string; handle: string; displayName: string | null; scopes: string[] };
export type ContainerStatus = 'pending' | 'ready' | 'published' | 'failed';

export abstract class SocialPlatformProvider {
  abstract authorizationUrl(state: string): string;
  abstract connect(code: string): Promise<ConnectedAccount>;
  abstract refresh(accessToken: string): Promise<SocialToken>;
  abstract createVideo(externalId: string, accessToken: string, videoUrl: string, caption: string): Promise<string>;
  abstract containerStatus(containerId: string, accessToken: string): Promise<ContainerStatus>;
  abstract publish(externalId: string, containerId: string, accessToken: string): Promise<string>;
}
