/*
  Warnings:

  - A unique constraint covering the columns `[userId,videoId]` on the table `Video` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Video_videoId_key";

-- DropIndex
DROP INDEX "public"."Video_youtubeUrl_key";

-- CreateIndex
CREATE UNIQUE INDEX "Video_userId_videoId_key" ON "public"."Video"("userId", "videoId");
