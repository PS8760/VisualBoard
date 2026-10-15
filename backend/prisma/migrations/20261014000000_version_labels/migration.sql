-- Human-readable label for version snapshots ("Manual snapshot", "Auto-save", "Before restore", …)
ALTER TABLE "versions" ADD COLUMN "label" VARCHAR(120);

-- Version timelines are always read newest-first per board.
CREATE INDEX "idx_versions_board_created" ON "versions"("board_id", "created_at" DESC);

-- Element deletion un-pins comment threads by element id.
CREATE INDEX "idx_comments_element" ON "comments"("element_id");
