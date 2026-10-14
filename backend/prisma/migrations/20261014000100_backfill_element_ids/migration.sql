-- Rows written by older seeds/clients stored the element id only in the row
-- column. Clients identify elements by element_data.id, so backfill it.
UPDATE "elements"
   SET "element_data" = "element_data" || jsonb_build_object('id', "id")
 WHERE "element_data"->>'id' IS DISTINCT FROM "id";
