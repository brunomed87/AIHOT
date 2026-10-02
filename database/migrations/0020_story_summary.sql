-- Resumo factual próprio do acontecimento, mostrado quando ainda não há síntese. Acontecimentos de repercussão
-- imported with one carry it; stories without it fall back to a report's summary.
ALTER TABLE stories ADD COLUMN summary text;
