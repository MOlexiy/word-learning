-- CreateTable
CREATE TABLE "word_drafts" (
    "id" UUID NOT NULL,
    "user_id" VARCHAR(32) NOT NULL,
    "word" VARCHAR(200) NOT NULL,
    "meaning" VARCHAR(500) NOT NULL DEFAULT '',
    "added_by" VARCHAR(32),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "word_drafts_user_id_created_at_idx" ON "word_drafts"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "word_drafts" ADD CONSTRAINT "word_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_drafts" ADD CONSTRAINT "word_drafts_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("username") ON DELETE SET NULL ON UPDATE CASCADE;
