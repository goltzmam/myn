# Deployment and credentials

## Supabase

1. Create a Supabase project. Apply the combined `public/setup/myn-database.sql` in the SQL Editor, or run both numbered files in `supabase/migrations/` through your migration workflow. The bootstrap is repeatable and backfills existing users without deleting conversations. Existing installations need `0002_mentor_transcripts.sql` for the mentor endpoints. Do not run migrations on every application startup.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the browser-safe publishable/anon key). Public variables must be present **at build time**. Rebuild after changing them.
3. Enable email/password authentication and email verification. Set Site URL and allow `/auth/callback` redirect URLs for your production origin and local development.
4. Configure production SMTP. The browser login uses password authentication; For Google OAuth, enable the Google provider in Supabase, configure its OAuth credentials and redirect URI, then set `NEXT_PUBLIC_ENABLE_GOOGLE=true` before building.
5. `SUPABASE_SERVICE_ROLE_KEY` is server-only, required only for account deletion, webhook writes and admin metrics. Never prefix it with `NEXT_PUBLIC_`.
6. Admin authorization uses `user.app_metadata.role === 'admin'`, never user-editable metadata. Grant this through a trusted administrative process. No default admin is provisioned.

## OpenAI

Set server-side `MYN_AI_KEY`. The SDK also accepts `OPENAI_API_KEY` for conventional local deployments. In cloud environment settings, `OPENAI_` names are reserved, so use `MYN_AI_KEY` with HTTPS destination `api.openai.com`.

Configurable defaults: `OPENAI_TEXT_MODEL=gpt-4.1-mini`, `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`, `OPENAI_SPEECH_MODEL=gpt-4o-mini-tts`. These identifiers are included in the installed official SDK. The official SDK API reference and README were retrieved during implementation; the platform documentation website returned HTTP 403. Model access/availability still requires a real project API call. Do not assume project access from SDK type definitions alone.

The API uses Responses with `store:false`, structured visual guidance, streamed Wake text, audio transcription, and AI-generated Coral speech. Provider retention policies still apply despite disabling Responses storage. Requests contain only the selected current screenshot and bounded conversation text. Screenshots are not stored by MYN. Review provider data controls before launch.

## Stripe

Use test mode first. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_MAX_PRICE_ID`, `STRIPE_TEAMS_PRICE_ID` and `APP_URL` with your canonical origin. Create monthly prices consistent with the plans table, and enable the Stripe customer billing portal for cancellations, changes and invoices. Prices and database quotas must be kept aligned manually.

Register `/api/billing/webhook` for `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Signature verification precedes processing. An atomic PostgreSQL function records the event and updates entitlements; duplicate events are ignored, older timestamps cannot overwrite newer state. Billing metadata comes from the server-created subscription. `STRIPE_WEBHOOK_SECRET` is used for local HMAC verification and must be a real server secret, not a proxy placeholder. Do not configure it as a proxy-only credential. Production charges were not enabled or tested.

Existing subscriptions should be managed through the portal; creating multiple concurrent subscriptions for one account is not yet prevented. Team plans are per-seat price integrations only; team workspaces and invitations are not implemented. Complete these controls before public billing launch.

## Vercel

Import this repository, select Next.js, use Node.js 24, install with `npm ci`, build with `npm run build`. Configure variables securely in Vercel. Never commit `.env.local`. Configure the Supabase URL/anon key before building. Server routes allow up to 60 seconds; choose a hosting plan supporting this. Production must use HTTPS for microphone and screen sharing. The fallback voice pipeline uses HTTPS requests and needs no persistent WebSocket runtime.

Use the existing isolated cloud checkout; do not create a Git worktree unless explicitly requested. Processes do not survive environment publication. Follow the saved startup instructions to restart the server.

## Network

Package installation: `registry.npmjs.org`. Source/docs: `github.com`, `raw.githubusercontent.com`. Application integrations: `api.openai.com`, `api.stripe.com`, and the actual Supabase project hostname. Add that hostname only after identifying the project. Never replace an unknown allowlist or disable TLS checks. Browser download is optional here because `/usr/bin/chromium` is installed.

## Before public launch

Run credential-backed signup/verification/recovery, cross-account RLS checks on Supabase, actual screen and microphone permissions in supported desktop browsers, real AI guidance/progress verification and history, Stripe test checkout/renewal/cancellation/failure events. Review legal text, provider retention, accessibility and full localization. Configure monitoring and incident response. Current CSP permits inline scripts and eval for framework compatibility; tighten it with nonces before launch. No deployment, push, publication or live charge was performed.

## Diagnóstico desta instância

Os valores de Supabase e OpenAI já estão presentes. A autenticação da Responses API recusou a chave existente com `401 invalid_api_key`; corrija o valor de `MYN_AI_KEY` em configurações seguras. O projeto Supabase foi identificado como `mjeualrxkgqdffwidiuv.supabase.co`; sua inclusão foi salva no rascunho de rede preservando `api.openai.com`. Revise e salve a alteração de rede no ambiente para aplicá-la e depois reteste a conexão. Salvar o rascunho pela ferramenta não aplica a política nem publica o ambiente. Não foi possível consultar ou migrar esse banco remoto.

## Mentor update

See `mentor-fix.md`. The application now supports a hands-free, pause-detected voice conversation loop with automatic language detection. The root bug in the shown dashboard was confirmed as missing Supabase tables, not a screen capture failure. A new website deployment does not install the database. Apply the combined bootstrap before testing `/app/guide`; `/try` remains a device-only test. For one-time automated installation, a secure Supabase Management API token is required. No administrative token was available during code validation.

## Estado após instalação do banco

As três migrações foram aplicadas ao projeto configurado e verificadas com acesso autenticado real. Os requisitos antigos de aplicar manualmente as tabelas deixaram de bloquear essa instância. A exclusão própria agora usa RPC autenticada com escopo do usuário, sem precisar de service-role key no app. Para reproduzir a validação, use `node --use-env-proxy --use-system-ca scripts/verify-platform.mjs` com o token administrativo fornecido de forma segura; contas descartáveis são criadas e removidas. `MYN_TEST_ORIGIN` habilita a checagem de cookie e rotas Next; `MYN_SCREENSHOTS=1` e `PLAYWRIGHT_CHROMIUM_EXECUTABLE` habilitam a inspeção de Home, Elo e histórico autenticados.

O domínio canônico encontrado na configuração de autenticação é `https://myn-gideaos-projects-e50d11cd.vercel.app/`. Não substitua essa configuração por um endereço imutável de deployment sem necessidade. Credenciais do ambiente cloud não são copiadas automaticamente para a Vercel. A inferência real ainda retornou 401 neste ambiente, e pagamentos/SMTP/social login permanecem dependentes de configuração específica.
