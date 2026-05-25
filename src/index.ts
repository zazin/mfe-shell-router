type Fetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

interface Env {
  ACCOUNT_APP: Fetcher;
  ORDER_APP: Fetcher;
}

const securityHeaders: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function withHeaders(response: Response, extra: Record<string, string> = {}) {
  const nextHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    nextHeaders.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    nextHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

function renderShell() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MFE Shell Router</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, system-ui, sans-serif;
        background: radial-gradient(circle at top, rgba(34,211,238,.18), transparent 35%), linear-gradient(180deg, #020617 0%, #0f172a 100%);
        color: #e2e8f0;
      }
      .wrap { max-width: 1120px; margin: 0 auto; padding: 48px 24px 64px; }
      .hero, .card { border: 1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.82); border-radius: 28px; }
      .hero { padding: 32px; box-shadow: 0 20px 80px rgba(8,47,73,.35); }
      .grid { display: grid; gap: 20px; margin-top: 24px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .card { padding: 24px; }
      .pill { display: inline-flex; padding: 8px 14px; border-radius: 999px; background: rgba(34,211,238,.12); color: #a5f3fc; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; }
      a { color: inherit; text-decoration: none; }
      .action { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(103,232,249,.24); border-radius: 999px; padding: 10px 16px; color: #cffafe; }
      ul { padding-left: 18px; color: #94a3b8; line-height: 1.7; }
      code { background: rgba(15,118,110,.2); padding: 2px 8px; border-radius: 999px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <span class="pill">Microfrontend edge router</span>
        <h1 style="font-size: clamp(2.2rem, 5vw, 4rem); margin: 16px 0 12px;">mfe.zazin.workers.dev</h1>
        <p style="max-width: 720px; color: #cbd5e1; line-height: 1.8;">
          Cloudflare Worker shell routing two standalone Next.js microfrontends under one workers.dev domain. Each downstream app serves hardcoded data and emits request logs.
        </p>
      </section>

      <div class="grid">
        <a class="card" href="/account">
          <span class="pill">Account app</span>
          <h2>Account Console</h2>
          <p style="color:#cbd5e1; line-height:1.7;">Profile, billing and security dashboard rendered by the account Worker.</p>
          <span class="action">Open /account →</span>
        </a>

        <a class="card" href="/order">
          <span class="pill">Order app</span>
          <h2>Order Command Center</h2>
          <p style="color:#cbd5e1; line-height:1.7;">Hardcoded fulfillment and shipment dashboard rendered by the order Worker.</p>
          <span class="action">Open /order →</span>
        </a>
      </div>

      <section class="card" style="margin-top: 24px;">
        <h2>Routing model</h2>
        <ul>
          <li><code>/</code> → shell landing page from the router Worker</li>
          <li><code>/account/*</code> → service-bound to the account Next.js Worker</li>
          <li><code>/order/*</code> → service-bound to the order Next.js Worker</li>
          <li>Latency is measured after deployment with <code>curl -w</code> on each endpoint</li>
        </ul>
      </section>
    </div>
  </body>
</html>`;
}

async function proxyRequest(request: Request, upstream: Fetcher, targetHost: string, appName: string) {
  const startedAt = Date.now();
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, targetHost);

  console.info(JSON.stringify({
    level: "info",
    app: "mfe-shell-router",
    event: "proxy.start",
    targetApp: appName,
    sourcePath: sourceUrl.pathname,
    targetUrl: targetUrl.toString(),
    method: request.method,
    timestamp: new Date().toISOString(),
  }));

  const proxiedHeaders = new Headers(request.headers);
  proxiedHeaders.delete("host");

  const proxiedRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: proxiedHeaders,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  const upstreamResponse = await upstream.fetch(proxiedRequest);
  const durationMs = Date.now() - startedAt;

  console.info(JSON.stringify({
    level: "info",
    app: "mfe-shell-router",
    event: "proxy.finish",
    targetApp: appName,
    sourcePath: sourceUrl.pathname,
    status: upstreamResponse.status,
    durationMs,
    timestamp: new Date().toISOString(),
  }));

  return withHeaders(upstreamResponse, {
    "x-mfe-shell": "mfe",
    "x-mfe-target": appName,
    "x-proxy-duration-ms": String(durationMs),
  });
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      console.info(JSON.stringify({
        level: "info",
        app: "mfe-shell-router",
        event: "shell.render",
        pathname: url.pathname,
        timestamp: new Date().toISOString(),
      }));

      return withHeaders(new Response(renderShell(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }), {
        "x-mfe-shell": "mfe",
      });
    }

    if (url.pathname.startsWith("/account")) {
      return proxyRequest(request, env.ACCOUNT_APP, "https://account.internal", "mfe-account");
    }

    if (url.pathname.startsWith("/order")) {
      return proxyRequest(request, env.ORDER_APP, "https://order.internal", "mfe-order");
    }

    return withHeaders(new Response(JSON.stringify({
      error: "Not Found",
      validRoutes: ["/", "/account", "/order"],
    }), {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    }));
  },
};

export default handler;
