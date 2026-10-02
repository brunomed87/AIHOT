-- Localização incremental: preserva registros antigos e valores personalizados.
ALTER TABLE translations ALTER COLUMN lang SET DEFAULT 'pt';
ALTER TABLE quote_translations ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'zh';
ALTER TABLE quote_translations ALTER COLUMN lang SET DEFAULT 'pt';
UPDATE budgets SET note='Extração alternativa do corpo, cobrada por requisição' WHERE note=U&'\6b63\6587\515c\5e95（\6309\8bf7\6c42\8ba1\8d39）';
UPDATE budgets SET note='Busca no X, cobrada por requisição' WHERE note=U&'X \641c\7d22（\6309\8bf7\6c42\8ba1\8d39）';
UPDATE budgets SET note='Listas e corpo de WeChat, cobrados por requisição' WHERE note=U&'\516c\4f17\53f7\5217\8868\4e0e\6b63\6587（\6309\8bf7\6c42\8ba1\8d39）';
UPDATE budgets SET note='Limite de chamadas de modelo Zhipu' WHERE note=U&'\6a21\578b\8c03\7528\7194\65ad（\667a\8c31）';
UPDATE budgets SET note='Limite de chamadas de modelo DeepSeek' WHERE note=U&'\6a21\578b\8c03\7528\7194\65ad（DeepSeek）';
UPDATE budgets SET note='Limite de modelos e vetores Alibaba DashScope' WHERE note=U&'\6a21\578b\4e0e\5411\91cf\8c03\7528\7194\65ad（\963f\91cc\4e91\767e\70bc）';
UPDATE budgets SET note='Limite de chamadas de modelo Xiaomi MiMo' WHERE note=U&'\6a21\578b\8c03\7528\7194\65ad（\5c0f\7c73 MiMo）';
UPDATE budgets SET note='Limite do modelo padrão, compartilhado por todas as etapas' WHERE note=U&'\6a21\578b\8c03\7528\7194\65ad（\9ed8\8ba4\6a21\578b，\6240\6709\6b65\9aa4\5171\7528）';
UPDATE budgets SET note='Limite de chamadas de vetores' WHERE note=U&'\5411\91cf\8c03\7528\7194\65ad';
UPDATE admin_users SET display_name='Administrador' WHERE display_name=U&'\7ba1\7406\5458';
