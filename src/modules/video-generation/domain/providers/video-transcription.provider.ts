export abstract class VideoTranscriptionProvider {
  abstract transcribe (submissionId: string, videoUrl: string): Promise<void>;
}
