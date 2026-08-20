# Deploying OptiWMS on AWS

The repository already publishes six container images to GHCR on every push to
`main`, and `infra/deploy/docker-compose.team.yml` runs the whole system from
those images behind Caddy with automatic HTTPS. Deployment is therefore a
**pull**, never a build: the server never compiles anything.

This document covers what has to exist on AWS, what it costs, and how to wire
continuous deployment.

## What actually runs

Eight containers on one host:

| Container | Port | Notes |
| --- | --- | --- |
| `proxy` (Caddy) | 80, 443 | TLS, basic auth, routes `/api/*` and `/agent/*` |
| `frontend` | 3000 | Next.js standalone |
| `backend` | 8080 | Spring Boot; runs Flyway migrations at startup |
| `db` | 5432 | PostgreSQL 16 |
| `forecast` | 8091 | Serves the locked v8 model bundle |
| `orchestrator` | 8092 | Forecast run orchestration |
| `slotting` | 8093 | OR-Tools MILP |
| `assistant` | 8094 | Chroma + MiniLM; ingests SOPs at startup |

Traffic path: browser → Caddy (443) → frontend, with `/api/*` to the backend and
`/agent/*` to the assistant. Only Caddy is exposed; nothing else needs a public
port.

## Sizing, honestly

This is not a free-tier workload. Rough steady-state memory:

| | RAM |
| --- | --- |
| backend (JVM) | ~1.2 GB |
| assistant (Chroma + MiniLM embeddings) | ~1.2 GB |
| forecast (pandas, scikit-learn, LightGBM) | ~0.8 GB |
| slotting (OR-Tools) | ~0.4 GB |
| db, frontend, orchestrator, proxy | ~1.0 GB combined |
| **total** | **~4.6 GB + headroom** |

A `t3.micro` (1 GB, free tier) cannot run this. A `t3.medium` (4 GB) is too
tight once the assistant loads its embedding model.

**Recommended: `t3.large`** — 2 vCPU, 8 GB, ~$0.083/hour on-demand in
`us-east-1`, plus ~$3/month for a 30 GB gp3 root volume.

| Usage pattern | Approximate monthly cost |
| --- | --- |
| Running 24/7 | ~$63 |
| Started only for demos, ~20 h/month | ~$5 |
| Stopped (EBS only) | ~$3 |

**Stopping the instance between demos is the single biggest saving.** Data
survives in the EBS volume and the Docker named volumes. If you do this, either
attach an Elastic IP (free while attached to a running instance) or expect the
public IP to change on each restart.

Images are built for `linux/amd64` only, so an ARM instance (`t4g.*`) will not
run them without adding a multi-arch build to `publish-images.yml`.

## One-time AWS setup

1. **Create the account** and enable MFA on the root user. Do routine work as
   an IAM user, not root.
2. **Set a billing alarm** before launching anything — Billing → Budgets → a
   monthly budget with an alert at, say, $20. This is the guard rail that stops
   a forgotten instance becoming a surprise.
3. **Launch EC2**: Ubuntu 24.04 LTS, `t3.large`, 30 GB gp3, a new key pair
   (download the `.pem` and keep it safe — it is also the deploy key).
4. **Security group**: inbound 80 and 443 from anywhere, 22 from your IP only.
   Nothing else. The application ports stay closed; Caddy is the only entry.
5. **Elastic IP**: allocate and associate one, so the address survives restarts.
6. **DNS**: point an A record at that IP. Caddy needs a real hostname to issue
   a certificate — HTTPS will not work against a bare IP. A cheap domain or a
   free subdomain provider both work.

## Prepare the server

```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

sudo apt-get update && sudo apt-get install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker

sudo mkdir -p /opt/optiwms && sudo chown ubuntu:ubuntu /opt/optiwms
```

Create `/opt/optiwms/.env` once. It holds every secret and is never in git:

```bash
cat > /opt/optiwms/.env <<'EOF'
GHCR_OWNER=Oxshadha
OPTIWMS_TAG=edge
TEAM_HOST=optiwms.example.com
TEAM_USER=team
TEAM_PASSWORD_HASH=REPLACE
POSTGRES_DB=optiwms
POSTGRES_USER=optiwms
POSTGRES_PASSWORD=REPLACE
JWT_SECRET=REPLACE
GOOGLE_API_KEY=REPLACE
GROQ_API_KEY=
AI_AGENT_RATE_LIMIT_PER_MINUTE=30
EOF
chmod 600 /opt/optiwms/.env
```

Generate the two values that are not free-form:

```bash
# JWT_SECRET - at least 32 random bytes
openssl rand -base64 48

# TEAM_PASSWORD_HASH - Caddy's basic auth hash, not the plaintext password
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your-password'
```

## First deploy

```bash
cd /opt/optiwms/infra/deploy
ln -sf /opt/optiwms/.env .env

docker compose -f docker-compose.team.yml pull
docker compose -f docker-compose.team.yml up -d

# Seed the warehouse population once the backend is healthy. Flyway has already
# created the schema by this point; this loads the v8 project data.
docker compose -f docker-compose.team.yml --profile provision run --rm forecast-bootstrap
```

Then open `https://your-host/`. Caddy issues the certificate on first request,
so allow a few seconds.

## Continuous deployment

`.github/workflows/deploy.yml` runs after the image publish succeeds on `main`,
copies the compose files, pulls the new tag and restarts. It can also be run
manually with any published tag, which is how you roll back.

### GitHub secrets

Settings → Secrets and variables → Actions. Create an environment named
`production` and add these to it:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | the Elastic IP or hostname to SSH to |
| `DEPLOY_HOST_NAME` | the public hostname used for the post-deploy health check |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | the **entire** contents of your `.pem`, including the BEGIN/END lines |
| `GHCR_TOKEN` | a PAT with `read:packages`, for pulling images on the server |

Nothing else belongs in Actions. Database passwords, the JWT secret and the
Gemini key stay in `/opt/optiwms/.env` on the server, where a workflow log
cannot print them.

Adding a required reviewer to the `production` environment means no deploy
reaches the server without someone approving it — worth it if the URL is going
in a submission.

### Rolling back

Actions → Deploy to AWS → Run workflow → enter the commit SHA of a known-good
build. Every published image is tagged with its commit SHA, so any past state is
one manual run away.

## Operating

```bash
cd /opt/optiwms/infra/deploy

docker compose -f docker-compose.team.yml ps
docker compose -f docker-compose.team.yml logs -f assistant
docker compose -f docker-compose.team.yml restart backend
```

Back up the database before anything destructive:

```bash
docker compose -f docker-compose.team.yml exec -T db \
  pg_dump -U optiwms optiwms | gzip > ~/optiwms-$(date +%F).sql.gz
```

## Known constraints

- **The assistant needs a Gemini key with quota.** Without `GOOGLE_API_KEY` it
  starts and reports healthy, but every question fails. `GROQ_API_KEY` is an
  optional fallback for quota errors.
- **Basic auth protects the whole site.** Caddy challenges every request,
  including `/api/*`. That is deliberate for a private demo; remove the
  `basic_auth` block in the `Caddyfile` if the site should be public.
- **One host, no redundancy.** A restart is downtime, and the database lives on
  the same instance. Appropriate for a demo, not for production traffic.
- **Snapshot the EBS volume** before a risky change. It is the only backup of
  the Docker volumes unless you copy dumps off the box.
