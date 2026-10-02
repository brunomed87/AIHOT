# Usar sua assinatura do ChatGPT

Esta instalação local no Windows pode usar um plano elegível ChatGPT Plus ou Pro, com autorização própria para o Radar. O transporte por chave de API continua disponível. Esta integração implementa o protocolo público da OpenAI; não utiliza tokens do Codex nem credenciais de outro aplicativo.

## Conectar

1. Abra `http://127.0.0.1:3040/admin/models` e entre no painel.
2. Na seção **Sua assinatura do ChatGPT**, clique em **Continuar com ChatGPT**.
3. No domínio oficial `auth.openai.com`, escolha a conta e autorize o uso do plano para **Radar Oftalmologia Brasil**. A conta precisa ser elegível; identidade sem a permissão de uso do plano não habilita processamento.
4. Ao retornar ao painel, clique em **Consultar modelos disponíveis**, selecione um modelo e clique em **Usar este modelo**. O catálogo vem da conta autenticada; modelos não disponíveis são recusados.
5. Confira uma chamada pequena com `ai-hot chatgpt test`. Esse comando consome uso do plano e registra o pedido. Só então faça o piloto com notícias e configure operação contínua.

Na instalação, defina `LLM_TRANSPORT=chatgpt-plan` no `.env` privado para que as capacidades que usam o modelo `default` passem pela assinatura. Chamadas automáticas continuam dependendo de `MODEL_CALLS_ENABLED`; conectar não muda esse interruptor nem `COLLECT_ENABLED` ou `OPHTHALMOLOGY_SCOUT_ENABLED`. O teste explícito roda em um processo separado, sem abrir esses interruptores no worker.

```powershell
ai-hot chatgpt status
ai-hot chatgpt models
ai-hot chatgpt test
```

## Uso e limites

O uso participa dos limites da sua assinatura. Não significa processamento ilimitado nem créditos de API inclusos. **Gerenciar uso no ChatGPT** abre as configurações da conta, onde você pode conferir permissões e controlar eventual uso de créditos. A cobrança de API é separada; esta conexão não troca silenciosamente para API quando o plano se esgota.

O limite inicial do serviço `chatgpt-plan` é de 4 pedidos por minuto, 20 por hora e 50 por janela móvel de 24 horas, incluindo tentativas. Pode ser ajustado no painel de orçamento. Esses números limitam pedidos, não dinheiro nem a quantidade de notícias: uma notícia pode precisar de várias chamadas. Pedidos rejeitados por falta de acesso ou uso esgotado não geram um resultado editorial válido. Uma resposta interrompida sem confirmação final fica com resultado desconhecido no mecanismo de recuperação existente.

## Credenciais e protocolo

O retorno de OAuth usa um listener temporário em `127.0.0.1`, com estado aleatório, PKCE e nonce. O backend verifica assinatura, emissor, audiência, validade e nonce do ID token; valida também a identidade na renovação. O identificador desta instalação permanece estável e o registro emitido é reutilizado. Credenciais rotacionadas são persistidas antes de concluir sua validação, sob trava entre processos.

Tokens ficam cifrados por DPAPI CurrentUser em `.data/chatgpt/connection.json`, fora do Git e do navegador. Somente a conta do Windows que criou a conexão pode decifrá-los. Não copie essa pasta para compartilhar a plataforma; ao instalar em outro computador ou usuário, conecte novamente. A seleção do modelo e o identificador da instalação não são credenciais. O mecanismo de backup atual do banco não inclui essa conexão; uma restauração do banco pode exigir novo login.

Inferência usa somente `https://api.openai.com/v1/responses`, com `store:false`, `stream:true`, entrada em array e instruções fora de mensagens de sistema. Não usa endpoints internos do ChatGPT. O pipeline aceita apenas `response.completed`, revalida o formato esperado e mantém registros e limites originais. Temperatura e limites de saída não permitidos nessa modalidade não são enviados. Cancelamento, respostas extensas e interrupções continuam sujeitos ao limite local de tempo e tamanho, sem garantia de um teto de tokens no fornecedor.

**Desconectar** tenta revogar a sessão renovável, remove tokens locais e preserva o registro para um login posterior. Se a revogação remota não puder ser confirmada, o painel informa isso e orienta remover o acesso também no ChatGPT. Não há troca entre contas por coincidência de e-mail.

Esta primeira integração é para o aplicativo local no Windows com `SITE_URL` HTTP em `127.0.0.1`. Não representa habilitação para oferecer a assinatura em um serviço comercial hospedado ou para outros usuários. Uma implantação remota exige avaliar a modalidade e as permissões oficiais aplicáveis.

No Windows, o iniciador mantém o serviço separado do console temporário. Os registros da instalação ficam em `.data/local-stdout.log` e `.data/local-stderr.log`; fechar o terminal que executou `ai-hot start` não deve encerrar o banco.

## Documentação oficial

- [Registro e login](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Modelos e inferência](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Contas, renovação e limites](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Limitações desta modalidade](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

Os testes da integração usam tokens e respostas fictícios locais. Um login concluído e um catálogo carregado ainda não comprovam inferência real; a conferência final exige uma resposta concluída usando a autorização da sua conta.
