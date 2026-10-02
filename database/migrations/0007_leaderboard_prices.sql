-- Official, subscription and third-party relay prices are kept apart (F11). Only 'official'
-- é exibido como preço da API; ausência mostra A verificar. Preços nunca afetam posições.
CREATE TABLE lb_prices (
  model_id      text NOT NULL REFERENCES lb_models (id),
  kind          text NOT NULL CHECK (kind IN ('official', 'subscription', 'relay')),
  currency      text NOT NULL CHECK (currency IN ('CNY', 'USD')),
  -- Per million tokens, in `currency`. cached_input is the cache-hit input price.
  input         numeric(14, 6),
  output        numeric(14, 6),
  cached_input  numeric(14, 6),
  source_url    text,
  verified_on   date,
  note          text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, kind)
);
