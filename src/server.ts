import http, { IncomingMessage, ServerResponse } from 'http';
import { createCheckoutSession } from './stripe/stripeManager';
import { isSubscriptionPlan } from './stripe/plans';
import { stripeWebhook } from './webhooks/stripeWebhook';

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export function startApiServer(): http.Server {
  const port = Number(process.env.PORT ?? 3000);
  const server = http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/stripe/create-session') {
      try {
        const rawBody = await readRawBody(req);
        const payload = JSON.parse(rawBody.toString('utf8')) as {
          plan?: string;
          discordUserId?: string;
          username?: string;
        };

        if (!payload.plan || !isSubscriptionPlan(payload.plan)) {
          sendJson(res, 400, { error: 'Invalid plan' });
          return;
        }

        if (!payload.discordUserId) {
          sendJson(res, 400, { error: 'discordUserId is required' });
          return;
        }

        const result = await createCheckoutSession({
          plan: payload.plan,
          discordUserId: payload.discordUserId,
          username: payload.username,
        });

        sendJson(res, 200, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (method === 'POST' && url.pathname === '/api/stripe/webhook') {
      const rawBody = await readRawBody(req);
      await stripeWebhook(
        {
          headers: req.headers,
          body: rawBody,
        },
        {
          status(code: number) {
            res.statusCode = code;
            return this;
          },
          send(body: string) {
            res.end(body);
          },
          json(body: unknown) {
            sendJson(res, res.statusCode || 200, body);
          },
        }
      );
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  server.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });

  return server;
}
