# Isolated browser worker

This process is separate from the Next.js/Vercel web application. It performs real Playwright actions; there is no simulated production executor. The web app signs short-lived, owner/task/session/domain/action-scoped commands. Every navigation, click, fill and select requires an exact action review in the app. Sharing a screen does not authorize control.

## Deploy

Use Node.js 24 and the repository lockfile. Install the worker's existing Playwright dependency with `npm ci --include=dev`, then `npx playwright install --with-deps chromium`. Run as an unprivileged service with container/VM CPU, memory and process limits. Use a dedicated disposable browser environment: no host mounts, cloud credentials, SSH agent, user profile, cookie import, or access to internal services. Do not run it in a Vercel function.

Enforce outbound denial of loopback, private, link-local, cloud metadata, reserved IPv4 and IPv6 ranges at the network gateway/firewall, including DNS rebinding/redirects. Permit only required public destinations through the environment proxy. The application also checks exact domains, HTTPS, DNS resolution, redirects and all browser subresources; those checks are defense in depth, not a substitute for network isolation. The worker refuses to start unless `MYN_BROWSER_EGRESS_CONFIRMED=1` acknowledges an actually enforced policy. Setting that flag alone does not enforce a firewall.

Provision a cryptographically random signing secret of at least 32 characters in the deployment's secret manager. Set **the same** server-only `MYN_WORKER_SECRET` on the worker and Vercel. Configure `MYN_WORKER_URL` on Vercel with the worker's HTTPS origin. No worker secret is ever sent to the browser. Use a TLS reverse proxy, disable request-body/access-token logging, cap request size at 64 KiB and response size at 1 MiB, and apply an additional gateway rate limit. The worker listens on loopback by default (`MYN_WORKER_HOST`, `MYN_WORKER_PORT`). `NODE_ENV=production` prohibits test origins. Start with `npm run worker:start`.

Do not expose the local sandbox exception in production. It exists only as a programmatic `testOrigin` argument used by the regression script; the CLI cannot configure it. Worker commands use single-use HMAC tokens with a 30-second expiry. Browser contexts expire after 10 idle minutes; task access grants expire after 30 minutes. A worker restart loses browser cookies/context; the persisted task and verified steps remain. The next action must be re-observed/reviewed, never silently replayed. Cancel/revoke closes the context and invalidates late task results. A click already submitted cannot be rolled back.

## Initial supported boundary

The worker supports accessible public websites: navigation, unique accessible-role/name targets, text input, selection, scrolling, reading, bounded waits, ephemeral screenshots and result assertions. It blocks passwords/secret/payment fields, arbitrary JS tools, downloads, browser permissions, popups, WebSockets and unapproved-domain assets/requests. Login/account dashboards require an independently designed interactive authorization/session mechanism; this release does **not** import local browser login or accept passwords. MFA, CAPTCHA, canvas-only controls, uploads, keyboard-driven desktop interactions and authenticated dashboard setup cannot be claimed as supported. Domain restrictions can prevent apps with unapproved third-party dependencies from loading; add only the destinations explicitly reviewed by the user.

Read/observe does not grant writes. An approved form action permits at most three write requests to approved domains during that action. Page content cannot expand permissions. Screenshots are returned to the owning session and are not persisted. Raw form values, cookies and request bodies are never logged. Task summaries/action reviews still contain the user's objective and non-sensitive proposed form values; users can review/delete task data.

## Verify locally

`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:agent-browser` starts a disposable local sandbox and worker, runs actual Chromium operations, verifies their observable result, rejects unauthorized commands and tests cancellation. No live accounts or paid model calls are used. It does not certify hosted worker availability, model credentials, authenticated third-party workflows or firewall configuration.
