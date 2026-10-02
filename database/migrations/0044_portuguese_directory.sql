-- Localiza somente nomes padrão importados do catálogo original; preserva metadados personalizados.
UPDATE lb_models SET provider='Outros' WHERE metadata_source='directory' AND provider='Other';
UPDATE lb_models SET provider='Outros' WHERE metadata_source='directory' AND provider='其他';
