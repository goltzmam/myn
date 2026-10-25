# myn.

The AI that shows you where to click.

A new Next.js application with Supabase accounts and private session storage, OpenAI visual guidance and voice, and Stripe subscription integrations. External services must be configured before the authenticated experience can be exercised. This is an initial implementation, not the complete production product specified in `docs/specification.md`.

## Local development

Use Node.js 24 and npm 11 (see `.nvmrc`).

```sh
cd /workspace/myn
npm ci --cache /tmp/myn-npm
cp .env.example .env.local
# Fill configuration values securely, then:
npm run dev
```

Do not overwrite an existing `.env.local`. No credentials are committed. Open `docs/deployment.md` for service setup and `docs/implementation-report.md` for validation evidence and missing capabilities.

```sh
npm test
npm run typecheck
npm run build
npm run start
# In another terminal; Chromium is already available in this cloud machine:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

Outside this cloud image, install the browser with `npx playwright install --with-deps chromium` and omit the executable override. Browser downloads may require `cdn.playwright.dev` and its redirect destinations in your network settings.

## Testar a interface agora

Na página inicial, clique em **Experimentar interface**, ou abra a rota `/try` na aplicação. O dashboard público permite navegar sem conta. Em `/try/guide`, compartilhe uma tela com permissão explícita e teste o microfone, com reprodução e descarte local do áudio. Esses testes não enviam mídia ao servidor, não criam sessões e não simulam respostas de IA.

Para testar no seu computador, extraia o pacote, execute `npm ci` e `npm run dev` com Node.js 24. Abra a aplicação na porta 3000 e use o botão Experimentar interface. A área de testes funciona sem `.env.local`; as rotas autenticadas continuam protegidas. O compartilhamento de tela exige desktop e contexto seguro.

Os comandos `dev` e `start` usam as opções nativas do Node 24 para respeitar o proxy e os certificados do sistema, sem desabilitar TLS. A presença de variáveis não garante que suas credenciais ou serviços funcionem.

## Architecture

- `app/`: App Router pages and authenticated server APIs.
- `components/`: landing, dashboard, session controls, history, agents, account and billing.
- `lib/ai/`: replaceable provider interface; OpenAI Responses structured visual analysis and streaming Wake text.
- `lib/vision/`: local compressed screen-frame extraction, change detection utility.
- `lib/auth/`: Supabase SSR and browser clients; `proxy.ts` refreshes cookies.
- `lib/billing/`: billing adapter and Stripe integration.
- `supabase/migrations/`: PostgreSQL schema, RLS, atomic quota reservations and billing event processing.
- `tests/`: policy and PostgreSQL/PGlite tests; Playwright public-flow checks.

Screenshots are analyzed on demand only, never inserted into the database. Screen sharing never starts without a user click and browser permission. Voice uses a hands-free, pause-detected record/transcribe/reason/speak loop. Listening resumes after speech playback and pauses during replies to avoid feedback; this is not a WebRTC Realtime connection. Conversation language defaults to auto detection and can be set to a language code independently of the interface. Messages and summaries remain until deletion; there is no automatic retention job. Quota reservations count failed provider calls as well as successful calls. Provider costs are not inferred from unverified token pricing.

## Ativar mentor, voz e histórico

Se o dashboard informa que o histórico não está disponível, as tabelas/RPCs do banco ainda não foram instaladas. Abra `/app/setup` na aplicação e siga as instruções para o proprietário executar `public/setup/myn-database.sql` no SQL Editor do Supabase. O bootstrap é repetível e inclui ambas as migrações. Ele preserva conversas e configurações existentes e cria perfis para usuários que se cadastraram antes da instalação.

Para instalação por automação, disponibilize `SUPABASE_ACCESS_TOKEN` com destino HTTPS `api.supabase.com` em configurações seguras e execute `npm run db:setup`. Esse token é administrativo e não deve ser configurado com prefixo público nem colocado no chat ou Git. Um token de serviço/anon não substitui o Management API token para executar DDL.

Na Vercel, configure também `MYN_AI_KEY` e as duas variáveis públicas de Supabase. As configurações do ambiente de desenvolvimento não são copiadas automaticamente para a Vercel. A chave OpenAI precisa ser válida e ter créditos/permissões de modelos. Faça redeploy após alterar variáveis.

Depois do deploy e do banco instalado, entre na conta, abra **Guide** em `/app/guide` e selecione **Conversar com mentor / Talk to your mentor**. A área `/try` continua sendo somente um teste local de dispositivos e não conversa com a IA.

## Elo e estado atual

A navegação principal agora é Home, Elo e Agente. Elo reúne texto, voz e tela em `/app/elo`; histórico e assinatura ficam em `/app/settings/history` e `/app/settings/billing`. Os links antigos são mantidos por redirecionamento.

As três migrações foram aplicadas ao projeto Supabase configurado. Login real, persistência, RLS e exclusão da própria conta foram verificados com contas descartáveis e limpeza ao final. O teste real de inferência neste ambiente retornou `401 invalid_api_key`; a configuração e os créditos do provedor no deploy precisam ser verificados separadamente. Veja `docs/elo-platform.md`.

`SUPABASE_SERVICE_ROLE_KEY` permanece opcional para administração e webhooks de cobrança; não é necessária para o fluxo normal de conversa nem para a exclusão da própria conta. O token Management não deve ser copiado para o navegador.
