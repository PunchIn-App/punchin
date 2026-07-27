# iCloud / CloudKit sync — researched and rejected

> ## ❌ NOT BUILT — considered and rejected (2026-07-24)
>
> Researched in depth (auth flow, PWA behaviour, container setup, architecture fit), then **deliberately
> dropped before any implementation**. Kept so the question isn't re-opened from scratch — the research
> below is accurate as of July 2026 and reusable if Apple's platform materially changes.

**Date:** 2026-07-24
**Status:** ❌ Rejected — not implemented
**Was:** Sub-project 3 of 3 in the "more sync options" effort (issue #295). Final outcome of that effort: **Dropbox shipped** (PR #318, v0.34.0); WebDAV and iCloud both rejected.

## What was evaluated

**Not iCloud Drive** — Apple exposes no third-party web API for a user's iCloud Drive, so browsable
files in the user's Drive are impossible. The only iCloud-backed store reachable from a web app is the
**CloudKit private database**, accessed via CloudKit Web Services (REST at `api.apple-cloudkit.com`),
using a `ckAPIToken` (app identity) plus a `ckWebAuthToken` (user session) obtained by redirecting the
user to an Apple-hosted sign-in page. The Apple Developer Program membership (held) is what unlocks
creating a container and API token without shipping a native app.

**Verdict from the adversarial review: PROTOTYPE-FIRST with a prior of failure. Decision taken: DROP.**

## Why it was rejected

1. **It doesn't answer the request.** Issue #295 said *"I don't use Google or Microsoft or GitHub
   otherwise"* and asked for iCloud **Drive** — storage the user can open and see. CloudKit stores data
   in a **developer-owned container the user cannot browse, find in the Files app, or export**. The
   project had already told the reporter exactly this in a June 2026 comment on #295. Shipping CloudKit
   would deliver a thing already correctly described to the requester as not-what-they-asked-for.
   **Dropbox (shipped) is the actual answer to #295.**

2. **The worst session model of any provider.** There is **no refresh token and no silent renewal**. A
   `ckWebAuthToken` expires **30 minutes** after creation by default, or **2 weeks** only if the user
   ticks "Keep me signed in" — a checkbox on Apple's own page that the app can neither pre-select nor
   detect. So every user re-enters Apple ID + password + a 2FA code **at minimum fortnightly, per
   device**, and possibly every 30 minutes. This directly reverses the v0.28.0 work that moved
   Google/OneDrive *onto* refresh tokens and silent renewal.

3. **Zero net new reach.** With Dropbox merged, every user can already sync. CloudKit serves only people
   with an Apple Account, and "Sign in with Apple" **cannot** be bridged to CloudKit (Apple DTS: the
   identifiers are not linked). Apple support only says *"Some Android devices can use iCloud.com"* —
   an explicitly unsupported configuration.

4. **The primary use case is unverified and partly known-broken.** Apple's own `cloudkit.js` signs in via
   `window.open`, which **returns `null` in an installed iOS standalone PWA** — the button silently does
   nothing. The hand-rolled full-page-redirect alternative is documented to work since iOS 12.2 but has
   **no first-party confirmation for 2024–2026**, and Apple Developer Forums thread 649699 reports a
   **hard freeze on exactly that return path, unresolved from iOS 13 through 2023**.

5. **Irreversible setup decisions + a trust problem.** Container identifiers can **never** be renamed or
   deleted; the production schema is **append-only forever**; dev and production are separate databases
   with no migration path. And because there is no native app, **Apple's sign-in sheet shows no app name
   or icon** — users would see a bare container identifier while being asked for their Apple password and
   2FA code, which reads as phishing.

6. **Unmaintained platform, no support channel.** CloudKit JS is frozen at v2.6.4 (WWDC 2015 era); the
   docs live in Apple's *Documentation Archive*; the missing OAuth-style `state` parameter has been an
   unanswered forum question since 2017; an Aug 2025 bug report has zero replies. Two independent
   research passes even **contradicted each other** on where the rotated token is returned (HTTP header
   `x-apple-cloudkit-session` vs JSON body `ckSession`) — because Apple's documentation is a decade old
   and wrong.

7. **The failure mode is silent.** Tokens rotate; if the app is interrupted between receiving a rotated
   token and persisting it, the stored token is spent and the connection is **bricked** — sync just stops,
   with no error the user understands, unreproducible on demand, and no Apple support channel. Every
   other provider fails *loudly* into a "Reconnect" badge. That is an unacceptable permanent support load
   for a solo maintainer.

## If it is ever revisited

The blocking questions, in order: (a) is a container the user cannot browse or export acceptable under a
"your data stays yours" posture? (b) does a full-page redirect reliably return into an installed iOS PWA
on current iOS, including navigating between routes immediately afterwards (the 649699 repro), surviving
force-quit/relaunch, and still working 24 h later? (c) where does the rotated token actually arrive?
Settle (a) as a product question first — a passing prototype does not make it the right feature. Point
production at the CloudKit `production` environment from day one; there is no fix later.

## Outcome of the "more sync options" effort (#295)

| Provider | Outcome |
|---|---|
| **Dropbox** | ✅ **Shipped** — PR #318, v0.34.0. Answers #295. |
| WebDAV | ❌ Rejected — see `2026-07-24-webdav-sync-design.md` |
| iCloud/CloudKit | ❌ Rejected — this document |
