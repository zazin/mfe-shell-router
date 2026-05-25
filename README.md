# mfe-shell-router

Cloudflare Worker shell that exposes the primary domain and proxies requests to the standalone Next.js microfrontends.

## Production routes

- `https://mfe.zazin.workers.dev/`
- `https://mfe.zazin.workers.dev/account`
- `https://mfe.zazin.workers.dev/order`

## Commands

```bash
npm install
npm run check
npm run deploy
```

## Notes

- `/account/*` proxies to `https://mfe-account.zazin.workers.dev`
- `/order/*` proxies to `https://mfe-order.zazin.workers.dev`
- The Worker logs proxy start/finish events and response duration in milliseconds.
