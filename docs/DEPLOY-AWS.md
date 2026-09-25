# AWS Self-Hosting (Plan B)

The runbook for running the whole app on AWS with Docker Compose. The default deployment (Plan A: Vercel + Render + Neon + Vercel Blob) keeps working alongside this path; switching between them is a matter of where you point DNS and which environment variables you set. Everything here is opt-in — with `STORAGE_PROVIDER` left at `local` or `vercel`, the code paths described in [TECHNICAL.md](TECHNICAL.md#6-deployment) apply.

---

## Two paths at a glance

| Path | Pieces | Approx. monthly cost | Choose it when |
|---|---|---|---|
| **Lightsail VM + Compose** (primary) | One VM running web + worker + Postgres + storage | $12–20 | You want the cheapest bill and one box to watch |
| **App Runner + RDS + S3** (managed) | Two App Runner services, RDS Postgres, S3 | ~$30 | You want AWS to keep the servers patched and running |

Both paths use the same two container images from the root `Dockerfile` (targets `web` and `worker`). The compose stack can run entirely on your laptop first — mock language model, console email, MinIO instead of S3 — so you validate everything before spending anything.

## Try it locally (zero AWS spend)

```sh
cp .env.aws.example .env.aws
docker compose --env-file .env.aws up -d --build
curl -s localhost:3000/api/health   # {"status":"ok","service":"ten-minutes-review-web",...}
curl -s localhost:3001/health       # worker health
```

Open http://localhost:3000, sign up, create a classroom, and upload an image. The MinIO console at http://localhost:9001 (login `tmr-minio` / `tmr-minio-secret`) shows the object under `tmr-uploads/uploads/…`. The worker runs migrations on boot, picks up the extraction job within seconds, and composes quizzes on its 15-minute scheduler.

---

## 1. Lightsail VM + Compose (primary path)

**Create the VM.** Lightsail → Create instance → OS only → Ubuntu 22.04+ → the 2 vCPU / 4 GB bundle (2 GB works for the app alone; 4 GB leaves headroom for Postgres plus a second small project later). In the Networking tab, open ports 22, 80, and 443. Attach a static IP.

**Set up Docker and the repo.**

```sh
ssh ubuntu@<vm-ip>
curl -fsSL https://get.docker.com | sh
git clone <your-repo-url> ten-minute-review && cd ten-minute-review
cp .env.aws.example .env.aws
```

**Edit `.env.aws`.** At minimum:

```sh
openssl rand -base64 32   # paste as AUTH_SECRET
```

- `APP_URL=http://<vm-ip>` (or your domain once HTTPS is up)
- `DATABASE_URL` stays `postgres://tmr:tmr@postgres:5432/…` only if you also set `POSTGRES_PASSWORD=tmr` — for a public VM, change both to a strong password.

**Start it.**

```sh
docker compose --env-file .env.aws up -d --build
curl -s localhost:3000/api/health && curl -s localhost:3001/health
```

Updates are the same loop: `git pull && docker compose --env-file .env.aws up -d --build`. Migrations run automatically when the worker boots.

## 2. Switching MinIO → real S3

MinIO on the VM is fine to start with; S3 is the durable choice once real student data flows. Create the bucket:

```sh
aws s3api create-bucket --bucket <bucket> --region <region>
# Outside us-east-1 also add:
#   --create-bucket-configuration LocationConstraint=<region>
```

Create an IAM user with programmatic access and this policy — it reaches only the upload prefix in this one bucket:

```json
{
  "Version": "2012-10-25",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::<bucket>/uploads/*"
    }
  ]
}
```

Then in `.env.aws`: clear `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`, and set `S3_BUCKET`, `S3_REGION`, and the IAM key pair. Restart with the same `up -d` command. New uploads land in S3; objects already written to MinIO keep serving because the keys live in the database either way — copy them across with `mc mirror` if you want them in S3.

The app signs S3 requests with the static key pair (`aws4fetch` signs with the credentials you hand it). The scoped policy above is what keeps a leaked key low-impact.

## 3. HTTPS and backups

**HTTPS.** Simplest: a Caddy sidecar. Add this service to `docker-compose.yml`:

```yaml
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddydata:/data
    depends_on: [web]
```

with a three-line `Caddyfile` (`yourdomain.com { reverse_proxy web:3000 }`) and `APP_URL=https://yourdomain.com`. Caddy issues and renews the certificate on its own. Add `caddydata:` to the top-level `volumes`.

**Backups.** Postgres lives in the `pgdata` volume; enable automatic Lightsail snapshots on the VM, and add a nightly dump for off-box copies:

```sh
# crontab -e on the VM — dumps land in S3 via any sync tool you like
15 3 * * * cd ~/ten-minute-review && docker compose --env-file .env.aws exec -T postgres pg_dump -U tmr ten_minute_review | gzip > ~/backups/db-$(date +\%F).sql.gz
```

## 4. Moving from Plan A

The database transfers as-is:

```sh
# from Neon
pg_dump "postgres://…@…neon.tech/…" -Fc -f plan-a.dump
# into the compose Postgres
docker compose --env-file .env.aws exec -T postgres pg_restore -U tmr -d ten_minute_review --clean --if-exists < plan-a.dump
```

The `uploads.storage_key` column holds relative keys (`uploads/<classId>/…`), so the schema and rows need zero changes for S3. Existing images still sit in Vercel Blob; copy them once if you want history preserved:

```ts
// scripts-level sketch — run with tsx, needs BLOB_READ_WRITE_TOKEN in env
import { list } from "@vercel/blob";
import { AwsClient } from "aws4fetch";
const s3 = new AwsClient({ accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!, service: "s3", region: "us-east-1" });
let cursor: string | undefined;
do {
  const page = await list({ cursor, token: process.env.BLOB_READ_WRITE_TOKEN });
  for (const blob of page.blobs) {
    const key = blob.pathname.replace(/^\//, "");
    if (!key.startsWith("uploads/")) continue;
    const bytes = new Uint8Array(await (await fetch(blob.url)).arrayBuffer());
    await s3.fetch(`https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`, { method: "PUT", body: bytes });
  }
  cursor = page.cursor;
} while (cursor);
```

DeepSeek, Resend/Brevo, and Stripe credentials carry over unchanged. When both plans run in parallel, point only one of them at a given database.

## 5. Managed alternative: App Runner + RDS + S3

Same images, managed hosting:

1. **Push images to ECR** (build for the VM's architecture — Apple Silicon laptops add `--platform linux/amd64`):

```sh
aws ecr create-repository --repository-name tmr-web
aws ecr create-repository --repository-name tmr-worker
docker buildx build --platform linux/amd64 --target web   -t <acct>.dkr.ecr.<region>.amazonaws.com/tmr-web:latest   --push .
docker buildx build --platform linux/amd64 --target worker -t <acct>.dkr.ecr.<region>.amazonaws.com/tmr-worker:latest --push .
```

2. **RDS Postgres**: `db.t4g.micro`, single-AZ, same region as the bucket. Set the security group so both App Runner services can reach it.
3. **App Runner services** — create one per image, each with the full environment-variable set (the `.env.aws` values, with `DATABASE_URL` pointing at RDS and `S3_*` at the real bucket):
   - `tmr-web`: port 3000, health check `/api/health`, public endpoint on.
   - `tmr-worker`: port 3000, health check `/health`, minimum instances 1 so the scheduler and job poller stay alive.

App Runner rebuilds and redeploys when you push a new image tag.

## 6. Cost snapshot

| Item | Lightsail path | App Runner path |
|---|---|---|
| Compute | $12 (2 vCPU/4 GB VM) | ~$14 × 2 services |
| Postgres | on the VM | ~$15 (RDS t4g.micro) |
| Storage | MinIO on VM / S3 pennies | S3 pennies |
| Scheduling | built into the worker | built into the worker |
| **Total** | **~$12–20** | **~$30** |

New AWS accounts start with free credits, which usually covers the first months. Set a billing alarm (AWS Budgets) at a threshold you pick so surprises announce themselves.
