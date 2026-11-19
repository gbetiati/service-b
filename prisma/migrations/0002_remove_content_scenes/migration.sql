BEGIN;

UPDATE "content_history"
SET "snapshot" = "snapshot" - 'scenes'
WHERE jsonb_typeof("snapshot") = 'object' AND "snapshot" ? 'scenes';

UPDATE "video_generations"
SET "input" = "input" - 'scenes'
WHERE jsonb_typeof("input") = 'object' AND "input" ? 'scenes';

DROP TABLE "content_scenes";

COMMIT;
