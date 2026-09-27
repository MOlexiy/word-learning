-- AlterTable
ALTER TABLE "word_cards" ADD COLUMN     "image_author" VARCHAR(200),
ADD COLUMN     "image_hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image_page_url" VARCHAR(500),
ADD COLUMN     "image_url" VARCHAR(500);
