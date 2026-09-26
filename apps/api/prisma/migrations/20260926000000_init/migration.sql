-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'teacher');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "users" (
    "username" VARCHAR(32) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "teacher_id" VARCHAR(32),
    "teacher_status" "TeacherStatus",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("username")
);

-- CreateTable
CREATE TABLE "word_cards" (
    "id" UUID NOT NULL,
    "user_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "means" TEXT NOT NULL DEFAULT '',
    "used" TEXT NOT NULL DEFAULT '',
    "n" VARCHAR(200) NOT NULL DEFAULT '',
    "v" VARCHAR(200) NOT NULL DEFAULT '',
    "adj" VARCHAR(200) NOT NULL DEFAULT '',
    "adv" VARCHAR(200) NOT NULL DEFAULT '',
    "collocations" TEXT NOT NULL DEFAULT '',
    "topic" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "k" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "word_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_random_progress" (
    "card_id" UUID NOT NULL,
    "repetition_step" SMALLINT NOT NULL,
    "locked_until" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "card_random_progress_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" VARCHAR(32) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_teacher_id_teacher_status_idx" ON "users"("teacher_id", "teacher_status");

-- CreateIndex
CREATE INDEX "word_cards_user_id_name_idx" ON "word_cards"("user_id", "name");

-- CreateIndex
CREATE INDEX "card_random_progress_locked_until_idx" ON "card_random_progress"("locked_until");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("username") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_cards" ADD CONSTRAINT "word_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_random_progress" ADD CONSTRAINT "card_random_progress_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "word_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom: інваріанти, які Prisma-схема не виражає
ALTER TABLE "card_random_progress" ADD CONSTRAINT "card_random_progress_step_check" CHECK ("repetition_step" BETWEEN 1 AND 6);
ALTER TABLE "users" ADD CONSTRAINT "users_teacher_link_check" CHECK (("teacher_id" IS NULL) = ("teacher_status" IS NULL));
