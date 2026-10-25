# Implementation report

## Scope and phase status

This repository now contains an executable initial implementation. The full master specification is **not complete**. Missing cloud credentials prevent end-to-end validation of the core acceptance journey. No AI responses, authenticated records or payments are simulated in the product. The landing illustration is explicitly labeled as a demo.

| Phase | Implemented code | Remaining work |
|---|---|---|
| 1 Foundation | Next.js, TypeScript, Tailwind, shadcn-style Radix/CVA button, dark responsive design, marketing routes, Supabase SSR email auth/recovery/callback, protected dashboard, settings, PostgreSQL/RLS | Onboarding wizard, complete PT-BR translation, avatars, complete accessibility review |
| 2 Core AI | OpenAI adapter, streaming Wake text, on-demand audio transcription/synthesis, private persisted conversations and bounded recent history/summary | Credential-backed tests, true continuous real-time voice, richer long-term summarization, attachments |
| 3 Guide | Explicit screen capture, local preview, pause/resume/stop, cleanup, JPEG downscaling, on-demand current-frame analysis, structured steps, evidence-required progress, summaries, contextual follow-up | Actual screen/microphone/AI acceptance journey, automatic change-triggered sampling, robust semantic progress evaluation, stuck detection |
| 4 Live and agents | Live fallback voice sessions and summary prompt, five seeded specialist agents, private custom agent CRUD, agent selection via session link, shared session engine | Continuous realtime audio, knowledge attachments, meeting-specific structured summary UI |
| 5 Commercial | Configurable plan/quotas, atomic reservation rate limits, Stripe checkout/portal and signed/idempotent webhook processing, subscription entitlement checks, admin role guard/counts | Stripe test-mode end-to-end tests, concurrent subscription prevention, Teams workspaces, management UI, MRR/churn/margin metrics, pricing synchronization |
| 6 Hardening | Automated unit/database/browser tests, production build, secure headers, cross-origin checks, server validation, CI, deployment docs, manifest, offline fallback and update prompt | Full observability, token-cost reconciliation, managed retention, exhaustive security/load/accessibility checks |

## Validation

- 15 unit/database checks cover image input validation, evidence-backed steps, visual change detection, profile creation, real PostgreSQL row policies, cross-user write rejection, entitlement write denial, atomic exchange persistence, durable rate limits, delete cascades, service-only billing writes, duplicate/stale billing events.
- 8 Playwright checks cover landing → signup, protected Guide redirect, webhook rejection, cross-origin AI rejection, mobile overflow, public pages, dashboard redirect and private-data-free offline fallback.
- Production Next.js build and TypeScript check run separately.
- Database tests use PGlite PostgreSQL with a minimal emulation of Supabase's auth schema/roles; they do not establish that a remote Supabase instance is migrated or connected.
- Browser tests use the installed Chromium. They do not grant real screen/microphone permissions, create a user, or call paid services.
- Manual visual review: desktop landing screenshot; illustration is marked as a demo.

Latest executed results: 15 unit/database tests passed; 8 Playwright tests passed; production build and TypeScript checks passed. A first PWA navigation test failed due to an automatic reload; the implementation was corrected and all 8 browser checks passed on the repeated run. Real auth, AI, audio and Stripe interactions remain untested until credentials and service configuration are supplied. Do not call the product production-ready or the MVP acceptance criteria passed.

## Credentials and configuration

Core: Supabase project URL/publishable key, applied migration, and `MYN_AI_KEY`. Optional commercial/admin: Stripe credentials/price IDs, canonical `APP_URL`, Supabase server service-role key. Enter secrets through secure environment settings, never chat or Git. See `deployment.md` for proxy-secret restrictions.

## Next verification

Configure Supabase and OpenAI, restart/rebuild, then execute the 13-step Guide acceptance journey in `docs/specification.md`: signup, share, ask through microphone, receive actual visual guidance and speech, follow/verify, end, inspect saved history. Then finish the outstanding features in the phase table and execute Stripe test mode before enabling paid plans publicly.


## Continuação: versão para experimentar

- Nova área pública `/try`, dashboard e navegação, sem contornar a autenticação das APIs ou acessar dados privados.
- Testes locais em `/try/guide`, `/try/wake`, `/try/live` e `/try/settings`: compartilhamento autorizado, preview, pausa, parada, gravação por até 15 segundos, medidor de microfone, reprodução e descarte. Nenhuma mídia é enviada ao servidor nessa área.
- Checklist de dispositivos autenticado em `/app/onboarding`.
- Node dev/start agora respeita o proxy via `--use-env-proxy --use-system-ca`, mantendo verificação TLS.
- Última validação: 15 testes unitários/banco passaram, 13 testes Playwright passaram, build de produção e TypeScript passaram. Os testes de mídia usam fontes sintéticas dentro do navegador para verificar o ciclo de vida e o encoder real; não representam permissão física de tela ou microfone.
- As variáveis Supabase e `MYN_AI_KEY` estão presentes. O Supabase continua com CONNECT 403 pela política de rede. A inclusão do hostname exato foi salva no rascunho, mas isso não aplica a política à máquina atual. A migração remota permanece não verificada.
- A listagem de modelos OpenAI respondeu; uma chamada real à Responses API com screenshot público falhou com HTTP 401 e código `invalid_api_key`. Nenhuma resposta visual foi fabricada. Atualize a credencial existente com uma chave válida nas configurações seguras; não crie um segundo binding.
- `scripts/verify-vision.mjs` é uma verificação manual opcional com chamada paga, fora do CI. Inicie o servidor e execute com `node --use-env-proxy --use-system-ca scripts/verify-vision.mjs`; neste ambiente use também `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. Ela captura somente a página pública `/try/guide` e verifica orientação estruturada sobre o botão visível.


## Mentor bug fix (latest)

See `mentor-fix.md` for the current behavior, setup requirement and test scope. The latest validation completed 59 unit/integration/database tests and 15 Playwright checks successfully, with production build and TypeScript checks passing. The new hands-free mentor loop supersedes the earlier description of manual-only voice. It remains a turn-based transcription/reasoning/speech pipeline, not a WebRTC Realtime connection. Real Supabase tables are still missing (PGRST205), so the complete authenticated production acceptance journey remains blocked on database initialization and real provider credentials/credits. No remote migration or production deployment success is claimed by these local test results.


## Atualização Elo e infraestrutura real (mais recente)

A condição anterior de tabelas ausentes foi resolvida: migrações 0001/0002/0003 aplicadas no Supabase real. Doze tabelas com RLS foram verificadas, e o login, os perfis, as sessões, o histórico, o isolamento entre contas, as regras de assinatura e a exclusão própria passaram em verificações reais com usuários temporários removidos ao final. O teste de cookie assinado do Next.js também passou. O resultado não certifica entrega de emails de cadastro/redefinição ou configuração Stripe.

A UX foi redesenhada para Home, Elo e Agente; configurações incluem histórico e assinatura. Ver `elo-platform.md` para as mudanças, verificação visual autenticada, limites e requisitos de provedor. A chamada real de visão ainda retornou 401 invalid_api_key neste ambiente; não há alegação de voz real verificada.
