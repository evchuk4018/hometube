#!/bin/sh
# Verify a homelab release, including the worker that the web health check omits.
set -eu

release=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
revision=${HOMETUBE_REVISION:?Set HOMETUBE_REVISION to the full pushed commit}
case "$revision" in
  *[!0-9a-f]*|'') echo "Invalid release revision: expected a full commit hash." >&2; exit 64 ;;
esac
[ "${#revision}" -eq 40 ] || { echo "Expected a full 40-character commit hash." >&2; exit 64; }
export HOMETUBE_REVISION
export DEPLOYMENT_ENV_FILE=${DEPLOYMENT_ENV_FILE:-/srv/storage/wowzerbowser/hometube/deployment.env}

compose() {
  /srv/storage/wowzerbowser/docker/compose.sh \
    --project-name hometube --file "$release/docker-compose.yml" "$@"
}

for supervisor in wowzerbowser-download-vpn.service wowzerbowser-tailscale-exit.service; do
  active=$(systemctl --user show --property=ActiveState --value "$supervisor")
  enabled=$(systemctl --user show --property=UnitFileState --value "$supervisor")
  if [ "$active" != inactive ] || [ "$enabled" != disabled ]; then
    echo "Direct-network deployment requires the VPN supervisor to stay stopped and disabled: $supervisor" >&2
    exit 1
  fi
done

# The preserved gateway must also remain off across Docker daemon restarts.
if gateway=$(docker inspect --format '{{.State.Status}} {{.HostConfig.RestartPolicy.Name}}' download-vpn 2>/dev/null); then
  case "$gateway" in
    'exited no'|'created no') ;;
    *) echo "Download VPN gateway must be stopped with restart policy no; found $gateway." >&2; exit 1 ;;
  esac
fi

for service in web worker; do
  container=$(compose ps --all -q "$service")
  if [ -z "$container" ] || [ "$(printf '%s\n' "$container" | wc -l)" -ne 1 ]; then
    echo "Expected exactly one HomeTube $service container." >&2
    exit 1
  fi
  state=$(docker inspect --format '{{.State.Status}}' "$container")
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container")
  actual_revision=$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$container")
  if [ "$state" != running ] || [ "$health" != healthy ] || [ "$actual_revision" != "$revision" ]; then
    echo "HomeTube $service failed release checks: state=$state health=$health revision=$actual_revision" >&2
    exit 1
  fi
  printf 'HomeTube %s: healthy at %s\n' "$service" "$actual_revision"
done

worker=$(compose ps -q worker)
network=$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$worker")
if [ "$network" != hometube_default ]; then
  echo "HomeTube worker must use hometube_default; found $network." >&2
  exit 1
fi
docker exec "$worker" npm run db:check
web=$(compose ps -q web)
docker exec "$web" node -e "fetch('http://127.0.0.1:3000/hometube/api/health/').then(async r => { if (!r.ok) throw new Error('Web health returned ' + r.status); console.log(await r.text()); }).catch(e => { console.error(e); process.exitCode = 1; })"
printf 'HomeTube release verification passed.\n'
