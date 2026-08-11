# Agent instructions

## Homelab deployment

After a change passes local verification, deployment to homelab is required before considering the task complete:

1. Push the completed change to `main`.
2. On `homelab`, pull `main` in `/srv/storage/wowzerbowser/hometube`.
3. Rebuild and restart the HomeTube Compose stack:

   ```bash
   cd /srv/storage/wowzerbowser/hometube
   docker compose --env-file deployment.env up -d --build
   ```

4. Apply and verify database migrations:

   ```bash
   docker compose --env-file deployment.env exec -T web npm run db:migrate
   docker compose --env-file deployment.env exec -T web npm run db:check
   ```

5. Verify the deployed service is healthy:

   ```bash
   curl --fail http://127.0.0.1:3010/api/health
   ```

The HomeTube deployment checkout is `/srv/storage/wowzerbowser/hometube`; do not use the separate `/srv/storage/wowzerbowser/files` checkout for HomeTube deployments.
