-- O vídeo de produto passou a ser um provedor de render (VIDEO_PROVIDER=remotion) e não guarda mais jobs próprios.
DROP TABLE "product_video_jobs";

DROP TYPE "ProductVideoStatus";
