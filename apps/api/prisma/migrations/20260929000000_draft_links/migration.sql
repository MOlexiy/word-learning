-- CreateTable
CREATE TABLE "draft_links" (
    "token" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_links_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "draft_links_user_id_key" ON "draft_links"("user_id");

-- AddForeignKey
ALTER TABLE "draft_links" ADD CONSTRAINT "draft_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("username") ON DELETE CASCADE ON UPDATE CASCADE;
