# Correção do mentor visual e conversacional

## Diagnóstico confirmado

O projeto Supabase respondeu, mas as consultas a profiles, plans, sessions, messages e agents retornaram PGRST205 (tabelas ausentes no schema cache). Sem essas tabelas, a aplicação não pode criar uma sessão nem persistir a conversa. A credencial disponível é pública/anon; não dá autorização para criar tabelas. Não foi disponibilizado token administrativo nesta instância. O código não contorna autenticação nem simula uma conversa para esconder esse bloqueio.

## Mudanças

- Dashboard continua mostrando a navegação e oferece `/app/setup` quando o armazenamento não está preparado.
- Bootstrap repetível em `public/setup/myn-database.sql` com RLS, backfill de perfis, seeds sem duplicação e notificação para recarregar o schema.
- `npm run db:setup` permite aplicar as migrações pela Management API quando um token administrativo for disponibilizado com segurança.
- API de sessões autenticada. Erros de RPC/banco são diferenciados de limites de plano, credenciais inválidas, falta de créditos e indisponibilidade de IA.
- Mentor por voz com detecção de pausa, transcrição no idioma original, análise de um frame atual a cada pergunta, resposta textual e síntese de voz. A escuta retoma após a resposta terminar. É um pipeline de turnos, não uma conexão Realtime/WebRTC.
- Escuta para durante a resposta, evita enviar silêncio/ruídos isolados e libera o microfone ao sair/parar/ocorrer erro. Amostragem de atividade usa timer para continuar funcionando quando o usuário trabalha em outra aba.
- Idioma da conversa independente do idioma da interface: auto ou códigos BCP 47. O modelo recebe instruções de acompanhar o idioma atual, inclusive mudanças durante a sessão. Qualidade depende dos idiomas suportados pelos provedores; não há garantia de qualidade universal.
- Player visível e aviso quando autoplay é bloqueado. Erro na síntese não remove a resposta textual. Uma falha ao salvar a resposta final é informada explicitamente sem descartar o texto recebido.
- Pergunta/transcrição persistida antes de chamar a IA; IDs de turno evitam duplicação no histórico. Respostas e resumo cumulativo ficam vinculados à sessão, com leitura por proprietário, horários e exportação. Áudio bruto e screenshots não são armazenados pelo MYN.
- Limites por minuto separados por operação (20 análises, 60 operações de áudio, 5 ações de cobrança), mantendo as franquias mensais configuráveis do plano.

## Validação e limites

Testes de unidade/integração de código usam provedores e identidade simulados somente no processo de testes. Testes PostgreSQL/PGlite verificam reaplicação do bootstrap, transcrições multilíngues, isolamento, limites e persistência. Testes React verificam pergunta → análise → texto → fala, frame atualizado por turno, fallback de autoplay e falha de áudio sem perda do texto. Testes do hook verificam que não há escuta durante a resposta e que o microfone é liberado. Playwright verifica a aplicação pública e a proteção das APIs.

O fluxo autenticado completo com o Supabase remoto e chamadas reais de voz/visão não pode ser certificado enquanto as migrações não forem aplicadas e as credenciais/créditos não forem verificados no ambiente de produção. Um push bem-sucedido ao GitHub não certifica que o deploy da Vercel foi concluído.
