-- Ключ слова в чернетці (як normalizeCardName: регістр, пробіли, ведучі to / a / an / the).
-- Унікальний у межах власника: повторні запити (напр. читалка повторює GET, поки сервер
-- прокидається) більше не створюють копій того самого слова.
ALTER TABLE "word_drafts" ADD COLUMN "word_key" VARCHAR(200);

UPDATE "word_drafts"
SET "word_key" = regexp_replace(lower(regexp_replace(btrim("word"), '\s+', ' ', 'g')), '^(to|a|an|the) ', '');

-- Наявні повтори: лишається найстаріший запис слова.
DELETE FROM "word_drafts" d
USING "word_drafts" older
WHERE d."user_id" = older."user_id"
  AND d."word_key" = older."word_key"
  AND (older."created_at", older."id") < (d."created_at", d."id");

ALTER TABLE "word_drafts" ALTER COLUMN "word_key" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "word_drafts_user_id_word_key_key" ON "word_drafts"("user_id", "word_key");
