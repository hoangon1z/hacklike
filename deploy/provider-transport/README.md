# SubVietnam transport

Production: NestJS → Python transport → SubVietnam. Python gets clearance cookies and
the browser User-Agent from FlareSolverr, then sends the documented JSON POST. This
avoids the challenge observed with Node fetch on this EC2. Local development keeps
direct requests unless `SMM_PROVIDER_TRANSPORT_URL` is configured.

The transport has a fixed SubVietnam destination and requires `SMM_TRANSPORT_TOKEN`.
Neither service publishes a host port. The provider key goes to the transport and
SubVietnam, never to FlareSolverr. Logs contain only action names and HTTP status.
Cookies remain in memory, expire after at most 10 minutes, and are invalidated when
a challenge returns. Refreshes are serialized to avoid concurrent browser starts.

There are **no automatic upstream retries**, including add/refill. A timed-out order
may already exist upstream; existing order reconciliation remains authoritative.
Changing Cloudflare behavior can still break this workaround. A failed solver or
challenge is reported as unavailable rather than a healthy connection.

Generate `SMM_TRANSPORT_TOKEN` with `openssl rand -hex 32` and store it only in
`.env.production`. Deploy with the same TLS overlay as the existing website:

```sh
sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml up -d --build
sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec web nginx -t
sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec web nginx -s reload
```

FlareSolverr uses a pinned image, up to 1.5 GiB RAM and one CPU. The Python transport
uses the same tested Python environment, with a 256 MiB memory limit. The API allows
50 seconds per transport request; the health-check transaction allows 60 seconds.

Verification:

```sh
python3 -m unittest discover -s deploy/provider-transport -v
sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec -T api node --test apps/api/scripts/test-provider-transport.cjs
```

References: [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr),
provider contract in `tailieu.txt`.
