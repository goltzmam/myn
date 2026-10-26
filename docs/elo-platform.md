# Elo: navigation, conversation and infrastructure

## Product changes

- Primary navigation: Home, Elo, Agents. Settings stays at the bottom.
- Elo unifies the previous Wake/Guide/Live entry points. One composer provides text, voice and screen controls; language and playback preferences are tucked away.
- Home is a return hub: welcome, one entry to Elo, actual recent conversations, and links to agents and history. Conversation input, microphone and screen controls live only in Elo. Home no longer duplicates the conversation experience. No invented history, engagement counters or fabricated responses.
- History and subscription are nested in Settings alongside account, voice/language and privacy. Old conversation URLs continue to resolve, and existing sessions of all three stored modes can resume.
- Removed workspace labels, privacy badges, mode cards, upgrade banners and AI marketing copy from the application shell. Product metadata and landing copy were aligned.
- Legacy one-time conversation handoffs remain supported without putting private text in URLs. Arbitrary incoming URL text never auto-submits a paid request. The new Home does not collect a draft.
- Mobile sidebar has an explicit open/close action. Controls retain names for screen readers and keyboard navigation; reduced-motion preferences remain respected.
- Subscription checkout and billing portal controls are unavailable when their payment configuration is missing; no live charges were enabled.

## Database and authorization applied

The authorized Supabase Management token was used to apply migrations 0001, 0002, 0003 and 0004. The real project now has 12 application tables with row-level security enabled on all 12 and ownership policies installed. Defaults/plans and built-in agents were seeded without duplicating existing records. Existing auth users received profiles.

Self-service deletion uses a narrowly scoped authenticated database function; clients cannot choose another user's ID, and accounts with active subscriptions cannot be deleted. The web app does not need an administrative service key for this action. Account-level Management credentials were used only in tooling, never embedded in the browser or committed.

A real integration check (`scripts/verify-platform.mjs`) created confirmed disposable users without sending emails and verified:

- Password sign-in and profile creation.
- Authenticated session creation, transcript/summary persistence and retrieval.
- Rejection of cross-user reads/writes and self-granted paid subscriptions.
- Persistent usage reservations.
- Signed-cookie Next.js session API access and Home without the database warning.
- Authenticated Home, Elo and populated history rendered in Chromium.
- Self-service account deletion and cleanup of test accounts.

Browser validation inside this restricted cloud environment uses a test-only transport bridge: unchanged requests to the actual Supabase project are forwarded through native HTTPS fetch with the trusted environment proxy. It does not fabricate provider/database responses and does not disable TLS verification. Test account credentials and project administrative keys stay in memory only.

A real verification exposed an origin-check bug: Next can build its internal request URL from the bind address. Same-origin validation now compares the browser Origin against the actual Host while continuing to reject foreign origins. This was verified by the signed-cookie test and regression tests.

## Configuration verified or still required

The existing Supabase Site URL is the production domain `https://myn-gideaos-projects-e50d11cd.vercel.app/`, with callback allowlists already configured. Email/password is enabled, email confirmation is required, and Google OAuth is not enabled. Email delivery/SMTP has not been certified by the confirmed-account test.

An actual OpenAI visual inference check still returned HTTP 401 `invalid_api_key` in this cloud instance. The code tests for text/voice/vision use explicit fixtures only in the test process. This does not certify live provider audio or visual reasoning, nor prove which credential the Vercel runtime currently receives. Valid provider credentials/credits must be configured in the deployment before real conversation can be certified.

Stripe account credentials and price IDs were not available. No checkout, charge or billing webhook was claimed as live-verified. They remain separate deployment configuration; no secret values are invented.

The production domain currently has a Vercel authentication gate. A GitHub push can trigger deployment, but deployment completion and the owner’s Vercel session are not available through the tools in this conversation.

## Home / Elo separation

Home now uses a left-aligned return-hub layout with an Elo invitation, real session continuation and quieter navigation shortcuts. The duplicate text composer, microphone, screen-sharing shortcut and starter prompts were removed from Home. The header new-conversation action appears only in Elo. Elo remains the focused conversation canvas. Home fetches only the data it displays.

Validation: 66 unit/integration/database tests passed; 20 browser tests passed; production build and TypeScript checks passed. New checks ensure Home has no conversation input, stored sessions resume the correct ID, and mobile reduced-motion settings preserve the sidebar's essential offscreen layout. Desktop and mobile visual captures were inspected. This change does not alter database schema or provider credentials.

## Streaming conversation and responsive room

Elo no longer repeats its section name in the header/content. The only new-conversation action lives in Elo. Messages have readable spacing, Markdown, copy and replay actions. A fixed-height room keeps the composer visible, scrolls the transcript independently and shows the shared-screen preview alongside it on desktop or above it on tablet/phone. Short viewports collapse the preview; the visual viewport follows the mobile keyboard. Scroll follows new content unless the reader scrolls back.

All compact production conversations use `/api/chat`, including current image frames. Provider deltas reach the transcript while sentence chunks are synthesized and played sequentially. Language changes cancel queued older-language audio and apply to the next turn. Transcription detects the original spoken language independently of the requested response language. Voice acquires the microphone, generates and plays an introduction, then begins recording; listening pauses through processing/playback to avoid feedback. This is hands-free turn-taking with STT + Responses + TTS, not simultaneous full-duplex WebRTC audio. Mobile screen capture remains browser-dependent.

Migration 0004 adds ownership-scoped, idempotent assistant-only introductions. It was applied to the real Supabase project. Questions are saved before inference and save acknowledgments distinguish provider failure from database failure; answers and introductions persist through authenticated RPCs. Provider interruptions and timeouts clear the pending state with an actionable error. The private history and export remain available.

`/api/conversation/status` requires authentication. GET reveals only credential presence, storage readiness, deployment environment and source revision; it never reveals credentials. POST performs an explicit small real inference and consumes an interaction allowance. Settings → Voice exposes this check. The user confirmed MYN_AI_KEY is configured for Vercel Production. That is separate from this cloud instance, whose latest real probe still reports AI_AUTH_FAILED. A credential-presence check is not a successful inference check. The Vercel authentication gate prevents verifying the production runtime from this environment; do not report live production voice or vision as certified.

Validation: 84 unit/API/database checks; 20 Playwright public-flow checks; build and TypeScript. An authenticated Chromium regression using real Supabase auth plus explicitly isolated media/provider fixtures checked desktop, tablet, phone, keyboard and landscape layouts; captured screen-frame forwarding; language selection; and generated introduction before the transcribed voice turn. Real disposable-account integration separately verified auth, ownership isolation, private multilingual storage, usage accounting and deletion, then removed its temporary users. Browser provider fixtures do not certify live provider voice/vision.

Reproduce the authenticated layout regression only with authorized secure Supabase Management configuration: `MYN_TEST_ORIGIN=http://127.0.0.1:3021 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node --use-env-proxy --use-system-ca scripts/verify-conversation-layout.mjs`. An already running fresh production build is required at the supplied local origin. Optional `MYN_PROVIDER_CHECK=1` on `scripts/verify-platform.mjs` runs the bounded real provider probe; avoid repeated paid checks once its result is known.

## Immersive presence

Elo now offers an immersive voice view inspired by the supplied dark-blue reference: a softly lit blue core, concentric rings, a stable star field and a floating control bar for sound, transcript, microphone, screen and language. The core distinguishes idle, actual microphone listening, response preparation and playback. Microphone energy affects its scale only while listening; the speaking animation indicates playback activity, not a fabricated audio waveform. Stars and rings honor reduced-motion preferences.

The voice button enters this view; the expand action also opens it without starting recording or a provider request. Transcript and typing are revealed on demand. Closing or pressing Escape returns to the existing chat without discarding messages/drafts or interrupting the ongoing voice session. A focus trap, focus restoration and scroll lock keep keyboard navigation within the view. The same existing authenticated conversation, screen and history paths are reused. No new provider capability or live production certification is implied by the visual change.

Validation: 85 automated checks passed, plus 20 Playwright public checks, build and TypeScript. The authenticated media-fixture browser regression checks the immersive view on desktop/tablet/mobile/landscape, draft preservation and that opening the view does not invoke the provider. Existing shared-screen geometry, language and greeting-before-listening checks remain in that regression.
