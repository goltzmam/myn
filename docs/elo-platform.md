# Elo: navigation, conversation and infrastructure

## Product changes

- Primary navigation: Home, Elo, Agents. Settings stays at the bottom.
- Elo unifies the previous Wake/Guide/Live entry points. One composer provides text, voice and screen controls; language and playback preferences are tucked away.
- Home has one composer, optional starting suggestions and actual recent conversations. No invented history, engagement counters or fabricated responses.
- History and subscription are nested in Settings alongside account, voice/language and privacy. Old conversation URLs continue to resolve, and existing sessions of all three stored modes can resume.
- Removed workspace labels, privacy badges, mode cards, upgrade banners and AI marketing copy from the application shell. Product metadata and landing copy were aligned.
- Home drafts are passed through one-time same-origin session storage, not placed in URLs. Arbitrary incoming URL text never auto-submits a paid request.
- Mobile sidebar has an explicit open/close action. Controls retain names for screen readers and keyboard navigation; reduced-motion preferences remain respected.
- Subscription checkout and billing portal controls are unavailable when their payment configuration is missing; no live charges were enabled.

## Database and authorization applied

The authorized Supabase Management token was used to apply migrations 0001, 0002 and 0003. The real project now has 12 application tables with row-level security enabled on all 12 and ownership policies installed. Defaults/plans and built-in agents were seeded without duplicating existing records. Existing auth users received profiles.

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
