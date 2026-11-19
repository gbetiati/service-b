import type { PublicationVideoState, PublicationWork } from '../../domain/entities/publication.entity';

export abstract class PublicationExecutionReader {
  abstract readPreparationState (job: PublicationWork): Promise<PublicationVideoState>;
}
