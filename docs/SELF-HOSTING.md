# Self-hosting with Docker

The whole app runs on any Linux server with Docker: a VPS, a free cloud VM, or a machine at home. The live deployment is still Vercel + Render (see [TECHNICAL.md](TECHNICAL.md#6-deployment)); this is the portable path, and moving to it is a matter of DNS and environment variables.

## What runs where

`deploy/compose.yaml` defines the stack. The server holds only that folder, never the source.

| Service | Image | Job |
|---|---|---|
| `caddy` | `caddy:2` | HTTPS on ports 80/443, certificate issued and renewed on its own |
| `web` | `ghcr.io/dong0085/ten-minutes-review-web` | Next.js API, server-rendered pages, and the SPA |
| `worker` | `ghcr.io/dong0085/ten-minutes-review-worker` | Job loop, 15-minute scheduler, migrations on boot |
| `postgres` + `backup` | `postgres:16` | Optional (`db` profile): the database on this host, dumped nightly to `deploy/backups/` |
| `minio` | `minio/minio` | Optional (`storage` profile): S3-compatible storage for note images on this host |

The default keeps data outside the box: Postgres on Neon, images in an S3-compatible bucket such as Cloudflare R2 or Backblaze B2. A server then holds nothing that can't be rebuilt in minutes. Turning on the `db` and `storage` profiles puts everything on one machine instead, and makes its disk the thing to protect.

## Images

`.github/workflows/images.yml` builds both images for `amd64` and `arm64` and smoke-tests each one: the web image must serve `/api/health`, the landing page, sign-in, and the SPA shell; the worker must load its code and render an email. A run on `main` publishes them as `latest` and `sha-<7-char commit>`. For now it runs only by hand (Actions → Images → Run workflow); the comment at the top of the workflow shows the triggers to add back for building on every pull request and push to `main`.

GHCR creates each package as private on its first publish. Make both public once (GitHub → your profile → Packages → the package → Package settings → Change visibility), since the repository is public anyway. Otherwise log the server in with a token that has `read:packages`: `docker login ghcr.io -u dong0085`.

## Server requirements

- Linux on x86_64 or ARM64, with 1 GB of RAM at minimum and 2 GB to be comfortable (add `db` and `storage`: 2 GB minimum)
- Ports 80 and 443 open, and an A record (plus AAAA for IPv6) for the domain pointing at the server
- Docker Engine with the Compose plugin

## First-time setup

On the server:

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo -u deploy mkdir -p /home/deploy/tmr
```

From a checkout of this repository:

```sh
scp deploy/compose.yaml deploy/Caddyfile deploy/backup.sh deploy/.env.example deploy@<server>:tmr/
```

Back on the server, as `deploy`:

```sh
cd ~/tmr
cp .env.example .env
chmod 600 .env
# fill in .env: DOMAIN, APP_URL, secrets, storage, sender addresses
docker compose pull
docker compose up -d
docker compose ps
curl -s https://<domain>/api/health
```

`.env` is the only file with secrets. Compose reads it for its own settings (`DOMAIN`, `TAG`, `COMPOSE_PROFILES`) and hands it to both app containers; `WEB_EMAIL_FROM` and `WORKER_EMAIL_FROM` give each its own sender address.

## Updates

**Automatic.** Once the push trigger is back on and `main` publishes new images, the workflow's `deploy` job logs in over SSH and runs `docker compose pull && docker compose up -d`. It stays off until the repository has:

| Kind | Name | Value |
|---|---|---|
| Variable | `DEPLOY_HOST` | Server address |
| Variable | `DEPLOY_USER` | `deploy` (the default) |
| Variable | `DEPLOY_DIR` | `tmr` (the default, relative to the user's home) |
| Variable | `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 <server>`, so the runner pins the host key |
| Secret | `DEPLOY_SSH_KEY` | Private half of a key made for this, e.g. `ssh-keygen -t ed25519 -f tmr-deploy -N ""`; append the `.pub` to `~deploy/.ssh/authorized_keys` |

**By hand.** `cd ~/tmr && docker compose pull && docker compose up -d`.

**Roll back.** Set `TAG=sha-<commit>` in `.env` and run `docker compose up -d`. Remove the line to follow `latest` again.

**Logs.** `docker compose logs -f web worker`.

## Everything on one host

Add to `.env`:

```sh
COMPOSE_PROFILES=db,storage
POSTGRES_PASSWORD=<long random string>
DATABASE_URL=postgres://tmr:<same password>@postgres:5432/ten_minutes_review
S3_ENDPOINT=http://minio:9000
S3_FORCE_PATH_STYLE=true
S3_REGION=us-east-1
S3_BUCKET=tmr-uploads
```

With MinIO, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` become its root login, so pick long random values. Either profile works on its own.

**Backups.** The `backup` service writes one `pg_dump` per night at 03:15 UTC and keeps 14. They sit on the same disk, so copy them elsewhere, for example a nightly `rclone copy ~/tmr/backups remote:tmr-backups` from the host's crontab. Restore with `docker compose exec -T postgres pg_restore -U tmr -d ten_minutes_review --clean --if-exists < backups/db-<date>.dump`.

**From Neon.** `pg_dump "<neon url>" -Fc -f neon.dump`, then the `pg_restore` above with `neon.dump`.

## Moving from Vercel + Render

1. Set up image storage: a hosted bucket (R2, B2) with a key that can read and write `uploads/*`, or MinIO on the server with `--profile storage`.
2. Copy existing note images from Vercel Blob. Keys stay the same, so no rows change. From `apps/web`: `node scripts/copy-blobs-to-s3.mjs --dry-run`, then without `--dry-run` (usage in the script's header).
3. Bring the server up under a temporary domain, or with `DOMAIN` set but DNS not yet moved, and check `docker compose ps` shows everything healthy.
4. Outside the send window (10:00–12:30 UTC): point DNS at the server, re-run the blob copy to catch late uploads, then suspend the Render worker. Jobs are claimed with `FOR UPDATE SKIP LOCKED` and email sends are deduplicated, so a short overlap of two workers is safe.
5. Update the Stripe webhook endpoint if the host changes, and the Google OAuth redirect URI if the domain changes.
6. After one morning send from the new worker, retire Render and Vercel and update [TECHNICAL.md](TECHNICAL.md#6-deployment).

## Try it on a laptop

```sh
cp deploy/.env.example deploy/.env
# DOMAIN=localhost, APP_URL=https://localhost, AUTH_SECRET=<anything>,
# LLM_PROVIDER=mock, EMAIL_PROVIDER=console, plus the "Everything on one host" block
cd deploy && docker compose build && docker compose up -d
```

Caddy serves `localhost` with its own local certificate, so the browser shows a warning once.

## Choosing a host

Any Linux VPS with 1–2 GB of RAM runs the default stack. Location matters more than brand: the web app makes several database queries per page, so the server belongs near the database. With Neon in `us-east-2` (Ohio), that means US East or Central, where a query takes a few milliseconds instead of the ~100 ms a European server would add. Moving Postgres onto the host with `--profile db` removes this constraint.

| Host | US East/Central locations |
|---|---|
| DigitalOcean | New York, Toronto |
| Vultr | New Jersey, Chicago, Atlanta |
| Linode (Akamai) | Newark, Chicago, Atlanta |
| OVHcloud | Virginia |
| Netcup | Virginia |
| Hetzner | Ashburn (the cheapest shared plans are often sold out) |
| Oracle Cloud Always Free | Ashburn, Chicago; free ARM (Ampere A1) up to 2 OCPU / 12 GB, see the caveats below |

**Oracle Always Free caveats.** Oracle halved the free Ampere A1 allowance to 2 OCPUs and 12 GB on 2026-06-15 without notice, so the terms can change again. Always Free instances count as idle, and may be reclaimed, when CPU, network, and memory all stay under 20% at the 95th percentile for 7 days, which is exactly what this app looks like most of the week. Upgrading the account to Pay As You Go keeps usage within the free limits at no charge and is widely reported to exempt instances from reclamation; confirm in Oracle's current terms. Pick a home region near Neon's `us-east-2` (Ashburn or Chicago), since it can't be changed later, and expect "out of capacity" errors when creating A1 instances in busy regions.
