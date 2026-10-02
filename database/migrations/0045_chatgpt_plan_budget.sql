-- A assinatura tem limites próprios; estes limites locais controlam quantidade de pedidos.
INSERT INTO budgets (service, per_minute, per_hour, per_day, note)
VALUES ('chatgpt-plan', 4, 20, 50, 'Piloto com assinatura ChatGPT: uso sujeito aos limites do plano; não é um teto monetário.')
ON CONFLICT (service) DO NOTHING;
