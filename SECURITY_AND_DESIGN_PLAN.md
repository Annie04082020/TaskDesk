# TaskDesk Security and Design Improvement Plan

## Goals

- Keep TaskDesk local-first and low-pressure while reducing high-value attack surfaces.
- Make high-permission features understandable, reversible, and visibly under user control.
- Reduce cognitive load for first-time and tired users without removing power-user workflows.

## Phase 1 - Security Baseline

1. Harden extension trust boundaries.
   - Keep content scripts limited to TaskDesk production and local development origins.
   - Validate sender URLs in the background worker before accepting focus events.
   - Keep message payloads small, typed, and schema-normalized.

2. Reduce sensitive data exposure.
   - Do not export or sync `pinHash` or `pinLock`.
   - Treat PIN lock as a privacy screen unless full data encryption is added.
   - Add a user-facing warning that GitHub tokens are stored locally and should not be saved on shared devices.

3. Strengthen browser-side defenses.
   - Maintain a restrictive CSP with no inline scripts and no remote script sources.
   - Keep `style-src 'unsafe-inline'` only while inline styles remain in the app.
   - Add regression checks for CSP-sensitive inline handlers.

4. Android hardening follow-up.
   - Clamp all `@JavascriptInterface` inputs by length, type, and allowed ranges.
   - Ensure the WebView only loads bundled/local TaskDesk content.
   - Keep external links outside the privileged WebView.

## Phase 2 - Safer Sync UX

1. Replace Push/Pull as the primary workflow with one "Safe Sync" action.
2. Move destructive or directional sync actions into an advanced section.
3. Show a preview before overwriting local data:
   - local count
   - remote count
   - deleted count
   - last sync time
4. Label sync code as sensitive because it contains task data and portable settings.
5. Add an undo snapshot before pull/merge operations.

## Phase 3 - Cognitive Load Reduction

1. Add a simple mode for new or depleted users.
   - Show only Inbox, Today, and Now.
   - Hide quadrants, analytics, and advanced sync until requested.

2. Make recommendation reasoning inspectable.
   - Keep the default short.
   - Offer a small "why this" detail that explains energy, deadline, size, and context.

3. Reduce decision fatigue.
   - Prefer one primary action per surface.
   - Use progressive disclosure for secondary controls.
   - Keep recovery actions visible after mistakes.

## Phase 4 - Human Factors and Trust

1. Add a Guardian status dashboard.
   - show whether browser extension, Android guardian, Kairos, and local lock are active
   - show exactly what each one can access or block
   - provide one-click disable for each guardian layer

2. Reframe interruption analytics.
   - Use neutral language.
   - Avoid failure framing.
   - Ask for at most one reason after interruption.

3. Add consent checkpoints for high-permission features.
   - Accessibility service
   - browser extension
   - GitHub token
   - sync code sharing

## Phase 5 - Design System Cleanup

1. Replace inline styles with reusable classes so CSP can remove `style-src 'unsafe-inline'`.
2. Standardize controls:
   - toggles for binary state
   - segmented controls for modes
   - icon buttons with labels/tooltips for repeated actions
3. Keep dense productivity surfaces quiet and scan-friendly.
4. Add responsive checks for long Chinese and mixed-language task titles.

## Success Metrics

- No extension focus event is accepted from non-TaskDesk origins.
- Backup, Gist sync, and sync code payloads do not contain `pinHash`.
- A new user can create, choose, focus, pause, and complete a task without opening advanced tools.
- Sync actions are understandable without knowing Push/Pull terminology.
- High-permission features always show active/inactive state and a clear off switch.
