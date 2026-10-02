# Revisão de idioma — português brasileiro

A cópia Radar Oftalmologia Brasil usa português brasileiro na interface pública, administração, catálogos, instruções dos modelos, RSS, integrações com agentes e documentação de uso. Também traduz mensagens públicas de erro, validações, estados de repercussão e cabeçalhos gráficos dos relatórios. Datas e números de apresentação usam convenções brasileiras.

Os artigos originais continuam disponíveis em seus idiomas. A redação gerada e as novas traduções integrais usam português; artigos e citações em chinês também passam pela tradução. Traduções antigas em chinês não são reutilizadas como traduções em português. Publicações identificadas como pt ou pt-BR dispensam tradução integral. Textos, imagens e links permanecem sujeitos às permissões das fontes.

A migração `0043_portuguese.sql` muda o idioma padrão das traduções e localiza descrições padrão do orçamento e o nome administrativo, preservando personalizações. `0044_portuguese_directory.sql` traduz a classificação genérica de fornecedores do catálogo importado. Não removem textos históricos nem alteram chaves e enumerações dos contratos.

## Conteúdo preservado

Nomes oficiais de pessoas, instituições, produtos e fontes; URLs; identificadores de programas e protocolos; aliases de reconhecimento; entradas estrangeiras necessárias para verificar leitores e idiomas; avisos legais originais e atribuições mantêm sua forma canônica. O código conserva nomes de contratos como `title_zh`, `body.zh` e `text_zh` por compatibilidade; os novos conteúdos desses campos são escritos em português. Arquivos gerados e dependências externas não são traduzidos.

Os calendários dos módulos originais continuam em Asia/Shanghai; o radar oftalmológico usa America/Sao_Paulo. A revisão de idioma não muda horários, valores monetários ou cotas. A licença e os avisos de autoria receberam traduções informativas sem substituir os originais.

As capturas antigas do site de IA foram substituídas por uma prévia da interface desta cópia. Fontes, logotipos oficiais e seus direitos foram preservados.

## Verificação

Execute as verificações de `AGENTS.md`: tipos, testes com banco descartável, compilação, testes da interface e verificação das páginas. Os testes de idioma cobrem artigos chineses, citações chinesas, RSS em português, identidade de instituições, frases com números decimais e códigos de erro públicos. Testes de licenciamento e retirada continuam obrigatórios.

Na revisão de 01/10/2026, passaram 472 testes do sistema e 31 da interface, verificação de tipos, compilação e 43 verificações de páginas e integrações. Três páginas de ranking retornam a indisponibilidade esperada enquanto não existe rodada publicada. As migrações foram verificadas também na instalação local, com chamadas externas desativadas.

Credenciais reais, arquivos `.env`, dados locais e cópias de segurança ficam fora do Git. A publicação desta cópia é no GitHub; a instalação local escuta somente em 127.0.0.1. Coleta e modelos continuam sujeitos às opções de ativação e aos limites definidos pelo responsável.
