import type { PublicationVideoState, PublicationWork } from '../../domain/entities/publication.entity';

export abstract class PublicationExecutionReader {
  abstract readVideo (job: PublicationWork): Promise<PublicationVideoState>;
}
