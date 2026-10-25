# MYN — MASTER BUILD PROMPT
## Complete AI-Native SaaS Development Specification

### YOUR MISSION

You are the lead software architect, principal full-stack engineer, AI engineer, product designer, security engineer and technical co-founder responsible for building **MYN**.

Your mission is to create MYN from scratch as a premium, production-oriented, globally scalable artificial intelligence platform.

You have full responsibility for designing the architecture, creating the codebase, implementing the product, integrating AI capabilities, configuring infrastructure, building the interface, writing tests and preparing deployment.

**Build the application. Do not stop at producing a development plan.**

Work autonomously through implementation phases, making reasonable technical decisions and documenting them.

The final deliverable must be a working application with real functionality, not a collection of mockups.

---

# 1. PRODUCT IDENTITY

**Product name:** MYN

**Brand display:** myn.

**Category:** Real-Time Visual AI Companion

**Primary tagline:** The AI that shows you where to click.

**Secondary tagline:** Don't explain. Just show.

**Product description:**

MYN is a real-time AI companion that can understand a user's shared screen, communicate through natural voice and guide them through digital tasks.

MYN helps people use software, solve technical problems, understand interfaces, learn workflows and complete tasks without constantly switching between applications or explaining their screen through text.

The experience should feel like having an intelligent expert sitting beside the user, watching the screen with permission and providing contextual assistance.

### Fundamental product principle

**MYN does not simply answer questions. MYN helps users complete tasks.**

The platform must combine:

- Visual understanding.
- Natural voice interaction.
- Conversational intelligence.
- Contextual reasoning.
- Task planning.
- Step-by-step guidance.
- Progress verification.
- Session memory.
- Specialized AI agents.
- Real-time assistance.

### Long-term vision

Build a universal AI assistance layer for digital work.

MYN should eventually support web applications, desktop applications, professional workflows, learning, productivity and supervised computer interaction.

The initial product must prioritize reliable visual guidance and voice assistance.

---

# 2. DEVELOPMENT DIRECTIVES

This is a new application.

Create the complete project from scratch.

Do not depend on any previous application, repository, database or codebase.

### Engineering requirements

1. Use modern, stable technologies.
2. Build modular, maintainable code.
3. Implement real features.
4. Keep AI integrations replaceable.
5. Prioritize security.
6. Optimize latency.
7. Control infrastructure costs.
8. Design for international users.
9. Write automated tests.
10. Prepare production deployment.

### Execution rules

- Inspect the working directory before creating files.
- Initialize the application if no project exists.
- Establish the architecture.
- Create the database schema.
- Build the design system.
- Implement authentication.
- Implement the AI services.
- Build the product interfaces.
- Integrate the services.
- Test the application.
- Fix errors.
- Document deployment.

Do not fabricate successful API calls.

Do not use simulated AI responses in production.

When credentials are unavailable, implement the complete integration interface and provide configuration instructions.

Continue developing independent components while external credentials remain pending.

Do not claim untested functionality is operational.

---

# 3. TECHNOLOGY STACK

Use the following stack as the default architecture.

### Frontend

- Next.js with App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide icons.
- Motion for animations.
- Zustand for session and interface state.
- TanStack Query where appropriate.
- Progressive Web App support.

### Backend

- Node.js.
- TypeScript.
- Next.js server APIs.
- Zod validation.
- Supabase PostgreSQL.
- Supabase Authentication.
- Supabase Storage where necessary.
- Server-side AI integrations.
- Dedicated real-time services where necessary.

### Artificial intelligence

Implement a modular AI provider layer supporting:

- Multimodal visual reasoning.
- Real-time voice.
- Speech transcription.
- Speech synthesis.
- Streaming text.
- Structured AI outputs.
- Session context.
- Task reasoning.

Use supported OpenAI APIs as the initial AI infrastructure.

Verify current API capabilities and model identifiers through official documentation during implementation.

Do not hardcode deprecated model names.

### Payments

Use Stripe Billing as the initial subscription infrastructure.

Implement a billing adapter so another payment provider can be added later without rewriting subscription logic.

### Deployment

- Vercel for the web application.
- Supabase for persistent data.
- A compatible persistent runtime for real-time connections when needed.
- GitHub Actions for continuous integration.

Avoid unnecessary microservices during the initial development.

---

# 4. PRODUCT DESIGN SYSTEM

MYN must look and feel like a premium international technology product.

### Design philosophy

- Architectural minimalism.
- Dark-first interface.
- Refined typography.
- Spacious layouts.
- Subtle animations.
- Excellent usability.
- Strong visual hierarchy.
- Minimal visual noise.
- Consistent components.
- Desktop-first application experience.

### Color palette

Primary background: `#111318`

Secondary background: `#1D2027`

Elevated surface: `#252933`

Primary text: `#F5F5F7`

Secondary text: `#A6A8B3`

Primary accent: `#B9B7FF`

Borders: `#343741`

Success: `#42C79A`

Warning: `#F2B66D`

Error: `#F16B78`

### Typography

Use Geist or Inter.

### Logo

Create a minimalist typographic wordmark:

**myn.**

Use lowercase geometric typography.

Create an application icon using a refined lowercase "m".

Avoid generic AI robot, brain or circuit icons.

### Interface requirements

- Responsive layouts.
- Smooth transitions.
- Skeleton loading states.
- Accessible controls.
- Keyboard navigation.
- Tooltips.
- Empty states.
- Clear error messages.
- Connection indicators.
- Reduced-motion support.

Use reusable design tokens and components.

---

# 5. APPLICATION ROUTES

Implement the following application structure.

### Public

- `/`
- `/features`
- `/how-it-works`
- `/pricing`
- `/download`
- `/privacy`
- `/terms`

### Authentication

- `/login`
- `/signup`
- `/forgot-password`
- `/auth/callback`

### Application

- `/app`
- `/app/wake`
- `/app/guide`
- `/app/live`
- `/app/agents`
- `/app/agents/new`
- `/app/agents/[id]`
- `/app/history`
- `/app/history/[id]`
- `/app/settings`
- `/app/settings/audio`
- `/app/settings/privacy`
- `/app/settings/account`
- `/app/billing`

### Administration

- `/admin`
- `/admin/users`
- `/admin/sessions`
- `/admin/usage`
- `/admin/subscriptions`
- `/admin/system`

Enforce authentication and authorization on protected routes.

---

# 6. LANDING PAGE

Create a visually impressive, high-converting landing page.

### Navigation

Logo: myn.

Links:

- Product.
- Features.
- How it works.
- Pricing.
- Sign in.

Primary button:

**Get started**

### Hero

Headline:

**The AI that shows you where to click.**

Subheadline:

Share your screen. Ask anything. Get real-time guidance from an AI that understands what you're working on.

Primary CTA:

**Get started free**

Secondary CTA:

**See how MYN works**

### Hero visual

Create a realistic interactive product demonstration showing:

- A computer application.
- A floating MYN assistant.
- Voice visualization.
- Screen-sharing status.
- AI instructions.
- A task checklist.
- Task progress.

Demonstration interactions must be labeled as demos until connected to real AI services.

### Product sections

**01 — Share your screen**

Let MYN see the application you're working on.

**02 — Ask naturally**

Speak to MYN without typing long explanations.

**03 — Get guided**

Receive instructions based on your actual screen.

**04 — Stay in flow**

Continue working while MYN guides you.

**05 — Complete your task**

Track progress and receive contextual assistance.

### Three modes

Showcase:

- Wake.
- Guide.
- Live.

### Specialized agents

Show how users can select AI experts for different activities.

### Pricing

Present clear subscription plans.

### Final CTA

**Don't explain. Just show.**

---

# 7. AUTHENTICATION AND ONBOARDING

Implement secure user authentication.

### Authentication

- Email and password.
- Google sign-in when configured.
- Email verification.
- Password recovery.
- Session persistence.
- Logout.
- Account deletion.

### Onboarding

After signup, guide the user through:

1. Welcome to MYN.
2. Choose language.
3. Select primary use case.
4. Test microphone.
5. Check screen-sharing compatibility.
6. Choose preferred AI voice.
7. Start first session.

### Suggested use cases

- Coding.
- Business.
- Marketing.
- Productivity.
- Learning.
- General assistance.

Keep onboarding short and skippable where appropriate.

---

# 8. MAIN DASHBOARD

Build a premium application dashboard.

### Sidebar

- Home.
- Wake.
- Guide.
- Live.
- My Agents.
- History.
- Billing.
- Settings.

### Header

- User avatar.
- Subscription status.
- Notifications.
- Settings shortcut.

### Main content

Headline:

**What are we working on today?**

Display three prominent cards:

### Wake

Talk with your AI companion.

### Guide

Share your screen and get step-by-step assistance.

### Live

Get real-time voice assistance.

### Additional components

- Recent sessions.
- Continue previous task.
- Favorite agents.
- Monthly usage.
- Subscription status.
- Suggested workflows.

The dashboard should be functional, not decorative.

---

# 9. WAKE MODE

Wake is MYN's general conversational AI assistant.

### Core features

- Text chat.
- Real-time voice.
- Streaming responses.
- Conversation history.
- Contextual memory.
- Agent selection.
- File attachments where supported.
- Multilingual conversations.

### Experience

Users can type or speak naturally.

MYN should respond intelligently, clearly and concisely.

### Interface

- Conversation timeline.
- Message input.
- Microphone control.
- Voice visualization.
- Agent selector.
- Stop response.
- New conversation.
- Session history.

### Context

Preserve the current conversation state.

Summarize older messages when context becomes too large.

Do not silently store sensitive personal information beyond the declared retention policy.

---

# 10. GUIDE MODE — FLAGSHIP FEATURE

Guide is the most important part of MYN.

It must provide real visual AI guidance.

### Primary objective

Help users complete tasks by observing an explicitly shared screen and providing contextual voice instructions.

### Required capabilities

- Screen sharing.
- Real multimodal AI analysis.
- Natural voice questions.
- Spoken AI guidance.
- Goal identification.
- Task planning.
- Step-by-step assistance.
- Progress verification.
- Error identification.
- Context retention.
- Adaptive instructions.
- Session history.
- Session summaries.

### User journey

1. User opens Guide.
2. MYN asks what they want to accomplish.
3. User describes the objective.
4. MYN requests screen-sharing permission.
5. User selects a window, tab or screen.
6. MYN analyzes the first frame.
7. MYN identifies the application context.
8. MYN creates a practical plan.
9. MYN explains the next step.
10. User follows the instruction.
11. MYN analyzes the updated screen.
12. MYN verifies progress.
13. MYN updates the checklist.
14. The process continues until completion.

### Example

User:

"MYN, help me configure my application's database."

MYN:

"I can see your project dashboard. Let's start by opening the database section."

User clicks.

MYN:

"Great. You're now in the database interface. Select the option to create a new table."

User encounters an error.

MYN:

"I can see an error message. Let me explain what it means and how we can fix it."

The AI must adapt to the actual interface.

Never invent buttons, menus or completed actions.

---

# 11. GUIDE SCREEN CAPTURE ENGINE

Implement screen sharing using supported browser APIs.

Primary API:

`navigator.mediaDevices.getDisplayMedia()`

### Requirements

- Explicit user permission.
- Window/tab/screen selection.
- Local screen preview.
- Screen-sharing indicator.
- Pause.
- Resume.
- Stop.
- Stream cleanup.
- Permission error handling.
- Compatibility detection.

### Visual frame pipeline

Create a reusable service responsible for:

1. Receiving the authorized media stream.
2. Extracting visual frames.
3. Resizing frames.
4. Compressing frames.
5. Detecting meaningful visual changes.
6. Sending frames to the multimodal AI service.
7. Recording observation timestamps.
8. Managing capture frequency.
9. Avoiding redundant processing.

### Capture strategies

Support:

- On-demand analysis.
- Analysis after meaningful visual changes.
- Periodic sampling when necessary.
- Manual Check Now.
- Analysis triggered by user questions.

### Performance

Optimize:

- Resolution.
- Compression.
- Frequency.
- Network bandwidth.
- AI processing latency.
- API consumption.

Do not send full-resolution screenshots unnecessarily.

### Visual truthfulness

MYN must distinguish:

- What is visible.
- What is inferred.
- What is uncertain.
- What was visible previously.
- What may have changed.

Never claim to see something that is not supported by the latest observation.

---

# 12. GUIDE TASK INTELLIGENCE

Create a dedicated task intelligence engine.

Suggested module:

`GuideContextEngine`

### Responsibilities

- Understand the user's goal.
- Interpret visual observations.
- Maintain session context.
- Generate task plans.
- Track completed steps.
- Detect blockers.
- Adapt instructions.
- Verify progress.
- Generate summaries.

### Session state

Maintain structured information:

- Session ID.
- User ID.
- Current objective.
- Active task.
- Current step.
- Completed steps.
- Pending steps.
- Recent visual observations.
- Recent conversation.
- Known errors.
- Last observation timestamp.
- Session status.

### Task planning

Generate a dynamic checklist.

Simple tasks may require two steps.

Complex tasks may require multiple phases.

Plans should adapt when the user encounters unexpected interfaces.

### Progress verification

Never mark a step completed merely because the screen changed.

Use:

- Visual evidence.
- Explicit user confirmation.
- Structured task-state reasoning.

### Stuck detection

Detect possible inactivity without interrupting unnecessarily.

Consider:

- Whether the screen changed.
- Whether the user is speaking.
- Whether the user is reading instructions.
- Whether the session is paused.
- Whether an application is loading.

Provide helpful prompts rather than repetitive notifications.

---

# 13. REAL-TIME VOICE ENGINE

Build natural, low-latency voice interaction.

### Features

- Microphone capture.
- Speech recognition.
- Streaming voice input.
- AI voice responses.
- Speech interruption.
- Mute.
- Audio output control.
- Device selection.
- Transcript synchronization.
- Connection recovery.

### Supported languages

- English.
- Portuguese (Brazil).

### Conversational behavior

MYN should:

- Respond naturally.
- Speak clearly.
- Avoid excessive explanations.
- Provide short instructions in Guide.
- Support interruptions.
- Maintain context.
- Avoid repeating information unnecessarily.

### Technical implementation

Use supported real-time voice APIs when appropriate.

Where necessary, implement a fallback pipeline:

Speech input → transcription → AI reasoning → speech synthesis.

Prevent feedback loops where the microphone captures MYN's own voice.

Track usage and processing costs.

---

# 14. LIVE MODE

Live is MYN's real-time conversational assistance mode.

### Capabilities

- Live voice conversations.
- Real-time transcription.
- Contextual assistance.
- Meeting notes.
- Summaries.
- Action items.
- Session history.
- Optional screen context.

### Experience

The user can speak naturally during a working session and receive assistance.

### Limitations

Only capture audio sources explicitly supported by the browser and authorized by the user.

Do not imply access to other applications' audio without implementing the required permissions and integrations.

### Session summary

At the end of a Live session, generate:

- Main discussion points.
- Decisions.
- Action items.
- Questions.
- Next steps.

---

# 15. MY AGENTS

Build a specialized AI agent system.

### Default agents

**Coding Expert**

Programming, debugging, APIs, databases, deployment and software development.

**Marketing Expert**

Advertising, campaign configuration, analytics and growth.

**Spreadsheet Expert**

Excel, Google Sheets, formulas and reporting.

**E-commerce Expert**

Online stores, payments, checkout and product operations.

**Productivity Expert**

General software assistance and digital workflows.

### Custom agents

Allow users to create their own agents.

Fields:

- Name.
- Description.
- Specialty.
- Instructions.
- Language.
- Avatar.
- Optional knowledge resources.

### Agent architecture

Agents should reuse the same voice, vision and conversation infrastructure.

Avoid duplicate implementations.

Custom agent instructions must not override platform security policies.

---

# 16. SESSION HISTORY AND MEMORY

Create a reliable session management system.

### Store

- Session metadata.
- Objective.
- Messages.
- Task steps.
- Completion state.
- Summaries.
- Usage information.

### User capabilities

- View sessions.
- Search history.
- Rename sessions.
- Delete sessions.
- Export transcripts.
- Resume task context.
- Review completed steps.

### Session summary

Generate:

- Objective.
- Actions completed.
- Problems encountered.
- Solutions attempted.
- Remaining steps.
- Recommendations.

Do not permanently store raw screen captures by default.

---

# 17. DATABASE ARCHITECTURE

Use PostgreSQL with Supabase.

Create migrations, constraints, indexes and RLS policies.

### Core tables

**profiles**
- id
- full_name
- avatar_url
- language
- created_at

**plans**
- id
- name
- price_monthly
- included_minutes
- features
- active

**subscriptions**
- id
- user_id
- plan_id
- provider_subscription_id
- status
- current_period_end

**sessions**
- id
- user_id
- mode
- title
- objective
- status
- started_at
- ended_at

**messages**
- id
- session_id
- role
- content
- created_at

**session_steps**
- id
- session_id
- title
- description
- status
- position
- verified_at

**session_summaries**
- id
- session_id
- summary
- completed_tasks
- pending_tasks
- created_at

**agents**
- id
- owner_id
- name
- description
- instructions
- specialty
- visibility
- created_at

**usage_events**
- id
- user_id
- session_id
- event_type
- quantity
- estimated_cost
- created_at

**user_preferences**
- user_id
- language
- voice_settings
- privacy_settings

**billing_events**
- id
- user_id
- provider_event_id
- event_type
- processed_at

**audit_logs**
- id
- actor_id
- action
- metadata
- created_at

### Security

Implement:

- Foreign keys.
- Unique constraints.
- Appropriate indexes.
- Row-level security.
- Server-side authorization.
- Secure administrative access.

Users must only access their own private records.

---

# 18. SUBSCRIPTIONS AND BILLING

Build a flexible subscription system.

### Initial plans

**Free**
- Limited trial.
- Basic voice.
- Limited Guide usage.
- Basic history.

**Pro — $10/month**
- Increased voice and Guide allowances.
- Specialized agents.
- Full history.
- Session summaries.

**Max — $19/month**
- Higher usage limits.
- Extended sessions.
- Advanced features.

**Teams — $29/user/month**
- Team billing.
- Administrative management.
- Shared workspace capabilities.
- Higher usage allowances.

Prices and quotas must be configurable.

### Billing features

- Checkout.
- Subscription creation.
- Renewals.
- Cancellation.
- Plan upgrades.
- Plan downgrades.
- Payment failure handling.
- Billing history.
- Webhook verification.
- Idempotent event processing.
- Entitlement checks.

Never trust client-side billing state.

Do not enable live charges without the required configuration.

---

# 19. AI USAGE AND COST CONTROL

MYN must be economically sustainable.

### Track

- Voice minutes.
- Screen-analysis requests.
- Input tokens.
- Output tokens.
- Session duration.
- AI cost.
- Infrastructure cost.
- Average cost per user.
- Usage by plan.

### Controls

- Configurable quotas.
- Rate limiting.
- Maximum session duration.
- Visual-analysis throttling.
- Cost alerts.
- Graceful quota exhaustion.
- Administrative overrides.

Avoid uncontrolled unlimited AI consumption.

Provide transparent usage information to users.

---

# 20. SETTINGS

Create a complete settings area.

### Account

- Name.
- Email.
- Password management.
- Avatar.
- Account deletion.

### Audio

- Microphone selection.
- Speaker selection where supported.
- Voice selection.
- Language.
- Voice playback.
- Microphone testing.

### Privacy

- Session retention.
- History deletion.
- Screen-sharing information.
- Data export.
- Consent preferences.

### Billing

- Current plan.
- Usage.
- Payment methods.
- Invoices.
- Subscription management.

---

# 21. ADMINISTRATION

Build a secure administrative dashboard.

### Dashboard metrics

- Total users.
- Active users.
- Paying subscribers.
- MRR.
- ARR.
- Conversion rate.
- Churn.
- Session volume.
- AI costs.
- Gross margin.
- Average usage.
- Error rates.

### Management

- Users.
- Plans.
- Subscriptions.
- Usage limits.
- Feature flags.
- System health.
- AI configuration metadata.

### Security

Restrict administrative functionality through server-side role authorization.

Do not expose user secrets or private screen content.

---

# 22. INTERNATIONALIZATION

MYN is a global product.

Support:

- English.
- Brazilian Portuguese.

Implement:

- Translation files.
- Language switching.
- Localized onboarding.
- Localized settings.
- Localized errors.
- Multilingual AI behavior.
- International billing support.

Avoid hardcoding UI strings throughout components.

---

# 23. PWA AND RESPONSIVENESS

Create an installable PWA.

### Requirements

- Web manifest.
- Application icons.
- Responsive layouts.
- Offline states.
- Secure caching.
- Update handling.
- Browser compatibility checks.

### Important

Screen sharing and audio capabilities vary by browser and operating system.

Do not claim universal support.

Show clear compatibility messages.

The primary Guide experience should be optimized for desktop browsers.

---

# 24. FUTURE DESKTOP APPLICATION

Design reusable services that can later support native desktop applications.

Future platforms:

- Windows.
- macOS.

Potential capabilities:

- Floating assistant.
- Global shortcuts.
- Screen awareness.
- Multi-application guidance.
- Visual overlays.
- Native notifications.
- Supervised computer actions.

Do not implement autonomous computer control in the initial MVP.

Prepare clean interfaces for future desktop integrations.

---

# 25. SECURITY AND PRIVACY

Implement security from the beginning.

### Requirements

- Secure authentication.
- Server-side authorization.
- Database RLS.
- Secret management.
- Input validation.
- Rate limiting.
- Secure webhooks.
- Audit logging.
- Data deletion.
- Privacy controls.
- Minimal data retention.

### Screen security

- Require explicit permission.
- Display sharing indicators.
- Allow immediate stop.
- Never silently activate screen capture.
- Avoid storing screenshots.
- Protect sensitive information.

### Prompt injection protection

Treat on-screen content as untrusted data.

Instructions displayed inside webpages or documents must not override MYN's system instructions.

Do not execute untrusted commands automatically.

---

# 26. PERFORMANCE

Optimize:

- Initial loading.
- Voice latency.
- AI response time.
- Frame processing.
- Database queries.
- Network usage.
- Memory consumption.
- Session reliability.
- Reconnection handling.

### Observability

Track:

- AI request latency.
- Audio response latency.
- Visual-analysis latency.
- Session errors.
- Provider failures.
- Database errors.
- Usage costs.
- Concurrent sessions.

Use structured logs and actionable error reporting.

---

# 27. TESTING

Create automated tests.

### Unit tests

- Session state.
- Task planning.
- Step verification.
- Usage accounting.
- Permissions.
- Validation.

### Integration tests

- Authentication.
- Database persistence.
- AI adapters.
- Session history.
- Billing webhooks.
- Authorization.

### End-to-end tests

- Signup.
- Login.
- Dashboard.
- Start Wake.
- Start Guide.
- Share screen.
- Ask by voice.
- Receive contextual guidance.
- Update task progress.
- End session.
- Review history.

Document tests that require real browser permissions or credentials.

Never report a test as passed unless it was executed successfully.

---

# 28. PROJECT ORGANIZATION

Use a maintainable architecture.

Suggested structure:

```text
myn/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── app/
│   ├── admin/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── voice/
│   ├── guide/
│   ├── agents/
│   └── billing/
├── features/
│   ├── wake/
│   ├── guide/
│   ├── live/
│   ├── agents/
│   ├── sessions/
│   └── subscriptions/
├── lib/
│   ├── ai/
│   ├── audio/
│   ├── vision/
│   ├── auth/
│   ├── database/
│   ├── billing/
│   ├── security/
│   └── usage/
├── hooks/
├── stores/
├── types/
├── supabase/
│   └── migrations/
├── tests/
├── public/
├── docs/
└── .env.example
```

Adjust the structure when technically justified.

Avoid unnecessary abstractions.

---

# 29. DEVELOPMENT PHASES

## PHASE 1 — FOUNDATION

Build:

- Project setup.
- Architecture.
- Design system.
- Landing page.
- Authentication.
- Database.
- Dashboard.
- Settings.

## PHASE 2 — CORE AI

Build:

- AI provider abstraction.
- Text conversation.
- Voice infrastructure.
- Session persistence.
- Wake mode.

## PHASE 3 — GUIDE

Build:

- Screen sharing.
- Visual analysis.
- Voice guidance.
- Task planning.
- Progress verification.
- Adaptive context.
- Session summaries.

This phase has the highest product priority.

## PHASE 4 — LIVE AND AGENTS

Build:

- Live mode.
- Specialized agents.
- Custom agents.
- Agent management.

## PHASE 5 — COMMERCIAL SYSTEM

Build:

- Subscriptions.
- Billing.
- Usage tracking.
- Limits.
- Admin dashboard.

## PHASE 6 — PRODUCTION HARDENING

Build:

- Automated tests.
- Performance optimizations.
- Security review.
- Monitoring.
- Error recovery.
- Deployment configuration.

Complete each phase with working code and tests before progressing.

---

# 30. MVP ACCEPTANCE CRITERIA

MYN's core experience is functional only when an authenticated user can:

1. Open the application.
2. Start Guide.
3. Share a screen.
4. Ask a question through the microphone.
5. Receive an AI response based on the actual shared screen.
6. Hear the response.
7. Follow the instruction.
8. Have MYN analyze the updated screen.
9. Receive the next contextual instruction.
10. Continue without losing context.
11. Finish the task.
12. End the session.
13. Review the session history and summary.

Do not replace any of these steps with simulated functionality.

If an external credential is missing, report that dependency clearly.

---

# 31. EXECUTION AND REPORTING

Begin implementation immediately.

### Step 1

Inspect the current directory and initialize the project.

### Step 2

Create the application architecture and development environment.

### Step 3

Implement the database and authentication.

### Step 4

Build the interface and application routes.

### Step 5

Implement the real AI services.

### Step 6

Build and validate Guide.

### Step 7

Implement the remaining modes and commercial features.

### Step 8

Run tests and fix failures.

### Step 9

Prepare deployment.

### Step 10

Produce a final technical report.

For each phase, report:

- Features implemented.
- Files created or modified.
- Tests executed.
- Test results.
- External credentials required.
- Known limitations.
- Next implementation steps.

Do not repeatedly request permission for routine development decisions.

Request approval before destructive operations, production charges or irreversible changes.

---

# 32. FINAL DIRECTIVE

You are building MYN as a serious AI-native technology company.

The product should be:

- Premium.
- Intelligent.
- Fast.
- Reliable.
- Secure.
- International.
- Scalable.
- Commercially sustainable.

The central product experience is:

**SEE → UNDERSTAND → GUIDE → VERIFY → COMPLETE**

Build a real AI companion that helps people accomplish digital tasks through contextual visual understanding and natural voice communication.

**Do not stop at planning. Start creating the codebase and implementing the product now.**

**MYN — The AI that shows you where to click.**