-- New out-of-line values (article bodies, report content, the search copy) are compressed with lz4,
-- que descompacta várias vezes mais rápido que pglz. Busca de texto completo lê
-- stored body of every candidate, so this roughly halves that step. Existing values keep their
-- compression until they are rewritten.
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET default_toast_compression = lz4', current_database()); END $$;
ALTER TABLE pool_search ALTER COLUMN body SET COMPRESSION lz4;
