# BrisaBase Security Baseline

This document defines technical controls expected from each deployment profile. It is an engineering baseline, not a legal compliance certification.

## Controls already enforced by the runtime

- organization/project/environment scoping and Row-Level Security;
- signed JWTs with issuer/audience/expiry validation and secret rotation support;
- refresh-session persistence and revocation;
- memory-hard password hashing for real HTTP authentication with legacy-hash compatibility;
- MFA/TOTP, passkeys/WebAuthn and Enterprise SSO capabilities;
- Redis-backed authentication throttling in real admin/application auth routes;
- strict CORS allowlists in production;
- CSP, HSTS on secure production requests, frame denial, MIME sniffing protection, referrer and permissions policies;
- encrypted application secrets with key rotation support;
- isolated Functions execution plane in bundled Hobby/Self-Hosted deployments;
- backup encryption, recovery certification and optional PITR;
- production configuration validation and immutable release identifiers;
- non-privileged application database role in the bundled production topology;
- audit logs, IP allowlists, custom roles and SIEM-oriented Enterprise controls.

## Automated supply-chain controls

The repository security workflow adds controls that are independent from runtime authorization:

- CodeQL analysis for JavaScript/TypeScript with `security-extended` queries;
- dependency review on pull requests, blocking newly introduced high-severity vulnerable dependencies;
- production dependency audit using the lockfile (`npm audit --omit=dev --audit-level=high`);
- CycloneDX SBOM generation and retention as a CI artifact;
- weekly Dependabot checks for npm packages and GitHub Actions;
- core GitHub Actions run with read-only repository permissions and without persisted checkout credentials;
- contract tests ensure production BrisaBase and Functions images continue to execute as the unprivileged `node` user.

These automated checks improve evidence and prevention, but they do not replace threat modeling, penetration testing, patch management or an external compliance audit.

## Hobby

Hobby is safe for local learning because host services bind to loopback. It is not an internet production profile.

Required:
- keep `NODE_ENV=development`;
- keep the stack on `127.0.0.1`;
- do not reuse Hobby credentials anywhere else;
- do not publish PostgreSQL, Redis, MinIO or Mailpit ports through router/NAT rules.

## Self-Hosted

Self-Hosted is a production profile for one server.

Required:
- HTTPS at the edge;
- strong unique PostgreSQL, Redis, JWT, encryption, bootstrap, backup and executor secrets;
- authenticated Redis;
- application-specific PostgreSQL user;
- immutable dependency images/digests;
- secure cookies;
- production CORS allowlist;
- encrypted backups;
- private Functions plane;
- observability enabled;
- restore certification before destructive restore is enabled.

Do not describe the bundled Compose as HA. A single host remains a single failure domain.

## Enterprise

Enterprise externalizes stateful infrastructure so organizations can apply their own availability, networking and compliance controls.

Required:
- external PostgreSQL with TLS and dedicated application/migration roles;
- external authenticated Redis with TLS;
- external S3-compatible object storage over HTTPS;
- immutable BrisaBase image;
- corporate ingress/WAF or the optional hardened edge profile;
- centralized monitoring/alerting for production services;
- controlled secret rotation and backup/recovery runbooks;
- `BRISABASE_DEPLOYMENT_MODE=managed` and `BRISABASE_PRODUCTION_TIER=ha`.

Managed/HA Functions are intentionally not supplied as a single bundled executor. Keep `FUNCTIONS_ENABLED=false` until the organization deploys a separate HTTPS Functions service with its own immutable images, horizontal scaling/private networking controls and a unique executor token. When enabled, the runtime requires the executor to use a different HTTPS origin from the BrisaBase callback origin.

Recommended for regulated environments:
- external secret manager instead of long-lived `.env` files;
- mTLS/private networking between application and managed infrastructure where available;
- SIEM export and immutable audit retention;
- SSO + MFA enforcement for administrative users;
- scheduled vulnerability scanning of images and dependencies;
- SBOM retention for every release;
- regular recovery drills and documented RTO/RPO;
- independent penetration testing before compliance claims.

## Rate limiting

Real BrisaBase authentication routes use the shared Redis runtime for counters. This matters for horizontally scaled deployments: limits must be shared across replicas rather than stored in a process-local map.

Any new internet-facing authentication or sensitive-action route must use a distributed limiter or an equivalent shared enforcement point. Process-local limiters are acceptable only for tests/legacy compatibility and must not be introduced into production auth routes.

## Security claims

Do not publish benchmark, compliance, penetration-test or availability claims unless the corresponding evidence exists and is reproducible. The Compliance Center and automated security gates produce technical evidence; they are not substitutes for SOC 2, ISO 27001, GDPR/LGPD legal analysis or an independent audit.
