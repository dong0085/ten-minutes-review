#!/bin/sh
# Starts a freshly built image with no secrets and checks it can serve (web) or load
# its code and render an email (worker). Usage: smoke-test.sh <web|worker> <image>
set -eu

target="$1"
image="$2"

docker image ls "$image" --format "image size: {{.Size}}"

if [ "$target" = "web" ]; then
  docker run -d --name smoke-web -p 127.0.0.1:3000:3000 -e APP_ENV=production "$image" > /dev/null
  trap 'docker rm -f smoke-web > /dev/null' EXIT
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  for path in /api/health / /signin /classrooms; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000$path")
    echo "$path -> $code"
    if [ "$code" != "200" ]; then
      docker logs smoke-web
      exit 1
    fi
  done
  curl -fsS http://127.0.0.1:3000/classrooms | grep -q '/_spa/assets/'
  echo "SPA shell served"
else
  docker run --rm --entrypoint test "$image" -d ../../packages/db/drizzle
  docker run --rm --entrypoint ./node_modules/.bin/tsx "$image" --eval '
    import("./src/runner.ts")
      .then(() => import("@tmr/email"))
      .then((email) => email.renderVerificationEmail("https://example.com/verify", "en"))
      .then((rendered) => console.log("worker loads; email renders:", rendered.subject))
  '
fi
