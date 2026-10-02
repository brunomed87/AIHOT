# Como contribuir

Problemas reproduzíveis, correções de documentação e melhorias úteis a outros setores são bem-vindos. Nesta cópia, escreva em português.

## Conversas e escopo

Use [Issues desta cópia](https://github.com/brunomed87/AIHOT/issues) para defeitos e propostas com cenário claro. O projeto original mantém [perguntas de uso](https://github.com/KKKKhazix/AIHOT/discussions/categories/q-a), [ideias](https://github.com/KKKKhazix/AIHOT/discussions/categories/ideas) e [projetos da comunidade](https://github.com/KKKKhazix/AIHOT/discussions/categories/show-and-tell). Vulnerabilidades seguem [SECURITY.md](SECURITY.md).

Priorize instalação, coleta genérica, processamento, interfaces públicas, acessibilidade, documentação e falhas reproduzíveis. Discuta cenário e proposta antes de grandes mudanças de arquitetura ou produto. Fontes, marca e critérios do seu setor podem ser adaptados em industry/; veja [personalização](docs/customize.md). O projeto original não compartilha sua lista operacional completa nem mantém adaptadores específicos para Weibo ou Xiaohongshu; coletores próprios podem usar [ingestão externa](docs/sources.md).

## Enviar alterações

1. Crie um fork e uma ramificação a partir da ramificação padrão desta cópia. Use o prefixo codex/ para novas ramificações de trabalho. Forks facilitam contribuições e integração de atualizações.
2. Leia [AGENTS.md](AGENTS.md) e documentos afetados. Cada solicitação resolve um problema claro, sem refatorações alheias.
3. Configure conforme [implantação](docs/deploy.md). Use banco de testes independente e desative coleta, modelos e notificações externas; não teste com produção ou serviços pagos reais.
4. Registre resultados de tipos, testes do backend, compilação e testes da interface. Banco de testes termina em _test ou _ci e recebe migrações antes. Em site ativo, execute node scripts/smoke.ts --base http://localhost:3000. Documentação exige conferir links, sintaxe e apresentação, sem testes artificiais.
5. Envie a solicitação para a ramificação padrão, associe a questão e inclua capturas para alterações de página. Atualize configuração e orientações de atualização quando necessário.

No projeto original, main recebe alterações por solicitações aprovadas após check e docker, com base atualizada; usa integração por squash e remove ramificações de manutenção. Essa política depende da configuração do repositório receptor.

Nunca envie .env, chaves, senha administrativa, cookies, dados de produção ou materiais sem autorização. Remova dados sensíveis de logs e capturas. Código sob [MIT](LICENSE); marcas e terceiros em [NOTICE](NOTICE).
