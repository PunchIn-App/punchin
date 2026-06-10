# Security Policy

## Supported Versions

Only the latest release of PunchIn is actively supported with security updates.

| Version | Supported |
| ------- | --------- |
| 0.29.x  | Yes       |
| < 0.29  | No        |

## Scope

PunchIn is a client-only PWA: all user data lives in the browser's IndexedDB and
there is no application backend. In scope are the application itself and the
Cloudflare Worker that handles OAuth (`worker/oauth.js`). Out of scope is the
user's own time-tracking data stored locally, which is plaintext by design and
not encrypted at rest. The exceptions are the cloud-sync **access token** and,
since v0.28.0, the OAuth **refresh token** (Google/OneDrive) — both encrypted at
rest with a non-extractable WebCrypto key as defense in depth (access token since
v0.17.0). Note that storing a refresh token raises the value of an active
same-origin XSS from a single ~1-hour access token to long-lived background
access (Google: until revoked; OneDrive: ~90 days, rotating). This is the same
inherent limit of a no-backend PWA the access-token encryption already faced —
the Worker's Content-Security-Policy remains the primary XSS control — but it is
the conscious tradeoff for seamless background sync.

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, report them privately by either:

- Emailing **[cve@trackmytime.today](mailto:cve@trackmytime.today)**, or
- Using GitHub's built-in security advisory feature: **[Report a vulnerability](https://github.com/PunchIn-App/punchin/security/advisories/new)**

If a CVE has already been assigned, please email the sub-addressed form
`cve+<number>@trackmytime.today` instead — for example, `cve+542161425@trackmytime.today`
for CVE-542161425 — so your report is automatically grouped by its CVE ID.

### What to include

Please include as much of the following as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce or proof-of-concept code
- The affected version(s)
- Any suggested fix or mitigation if you have one

### What to expect

- **Acknowledgement**: We aim to acknowledge your report within 48 hours
- **Status update**: We aim to provide an assessment and estimated timeline within 7 days
- **Resolution**: We aim to patch critical vulnerabilities within 14 days

If a vulnerability is accepted, we will coordinate a fix and disclosure timeline with you. If it is declined, we will explain why.

We appreciate responsible disclosure and will credit reporters in the release notes unless you prefer to remain anonymous.
