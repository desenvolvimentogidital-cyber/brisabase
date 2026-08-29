# BrisaBase Deployment Profiles

BrisaBase uses one application codebase and one public API surface across deployment sizes. Profiles change topology and operational guarantees; they do not change project schemas or SDK contracts.

## 1. Hobby / Local

Audience: beginners, students, prototypes and personal projects.

Topology:
- BrisaBase API/console in Docker;
- PostgreSQL, Redis, MinIO and Mailpit bundled locally;
- Functions Executor isolated in its own container;
- all host ports bound to `127.0.0.1` by the base local Compose;
- development-only local credentials are never accepted by the production validator.

Start:

```bash
npm run deployment -- init hobby
npm run deployment -- up hobby
```

The generated `.env.hobby` is intentionally local-only. Do not expose the Hobby stack directly to the internet.

## 2. Self-Hosted

Audience: professional developers, startups and teams running BrisaBase on one VPS or dedicated server.

Topology:
- bundled PostgreSQL, Redis and MinIO;
- Caddy TLS edge;
- isolated Functions execution plane;
- persistent Docker volumes;
- production secrets and immutable dependency images;
- production contract explicitly limited to `single-host`.

Start:

```bash
npm run deployment -- init self-hosted
# Review and replace every placeholder in .env.production
npm run deployment -- doctor self-hosted
npm run deployment -- up self-hosted
```

`BRISABASE_PRODUCTION_TIER=ha` is deliberately rejected for this profile. High availability requires external infrastructure and the Enterprise profile.

## 3. Enterprise / External Infrastructure

Audience: large companies and regulated environments that already operate managed databases, caches, object storage, ingress/WAF and centralized observability.

Topology:
- BrisaBase application container;
- isolated Functions Executor container;
- external PostgreSQL over TLS;
- external authenticated Redis over TLS;
- external S3-compatible storage over HTTPS;
- optional bundled Caddy edge (`--profile edge`) or an existing corporate load balancer/WAF;
- `managed` deployment mode and `ha` production tier;
- no bundled PostgreSQL, Redis or MinIO service in `docker-compose.enterprise.yml`.

Start:

```bash
npm run deployment -- init enterprise
# Configure real external endpoints and secrets in .env.enterprise
npm run deployment -- doctor enterprise
npm run deployment -- up enterprise
```

Optional bundled edge:

```bash
docker compose --env-file .env.enterprise -f docker-compose.enterprise.yml --profile edge up -d
```

## Migration path

A team can grow without changing application code:

```text
Hobby / localhost
      ↓
Self-Hosted / one VPS
      ↓
Enterprise / external PostgreSQL + Redis + S3 + ingress
```

Keep the same project IDs, migrations, REST/GraphQL contracts and SDK. Move infrastructure components through supported configuration and controlled backup/restore procedures rather than copying live database files.

## Profile rules

| Control | Hobby | Self-Hosted | Enterprise |
| --- | --- | --- | --- |
| Internet-facing production | No | Yes | Yes |
| Bundled PostgreSQL | Yes | Yes | No |
| Bundled Redis | Yes | Yes | No |
| Bundled MinIO | Yes | Yes | No |
| TLS required | No (loopback) | Yes | Yes |
| Distributed Redis coordination | Local Redis | Bundled Redis | External Redis |
| HA claim | No | No | Yes, infrastructure-dependent |
| Corporate WAF/LB | Optional/not needed | Optional | Recommended |
| External observability | Optional | Optional | Recommended |

## Important distinction: plan vs deployment profile

Commercial tiers (Free/Pro/Team/Enterprise) are billing/entitlement concepts. Deployment profiles (Hobby/Self-Hosted/Enterprise) describe infrastructure topology. Do not infer a commercial entitlement only from the Compose file a customer runs.
