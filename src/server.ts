import http, { IncomingMessage, ServerResponse } from 'http';
import { getDb } from './db/database';
import { createCheckoutSession } from './stripe/stripeManager';
import { isSubscriptionPlan } from './stripe/plans';
import { stripeWebhook } from './webhooks/stripeWebhook';

interface DashboardUserRow {
  id: number;
  discordId: string;
  username: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  conversationCount: number;
  transactionCount: number;
}

interface DashboardStatsRow {
  totalUsers: number;
  activeSubscriptions: number;
  totalCredits: number;
  totalConversations: number;
  totalTransactions: number;
}

interface DashboardUserDetailRow {
  id: number;
  discordId: string;
  username: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: number | null;
  conversationCount: number;
  transactionCount: number;
}

interface UserTransactionRow {
  id: number;
  type: 'add' | 'use' | 'refund';
  amount: number;
  description: string | null;
  createdAt: string;
}

interface UserConversationRow {
  id: number;
  discordChannelId: string;
  role: string;
  content: string;
  createdAt: string;
}

const db = getDb();

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getDashboardStats(): DashboardStatsRow {
  const statement = db.prepare(`
    SELECT
      COUNT(u.id) AS totalUsers,
      COALESCE(SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END), 0) AS activeSubscriptions,
      COALESCE(SUM(u.credits), 0) AS totalCredits,
      COALESCE((SELECT COUNT(*) FROM conversations), 0) AS totalConversations,
      COALESCE((SELECT COUNT(*) FROM transactions), 0) AS totalTransactions
    FROM users u
    LEFT JOIN subscriptions s ON s.userId = u.id
  `);

  return statement.get() as DashboardStatsRow;
}

function getDashboardUsers(): DashboardUserRow[] {
  const statement = db.prepare(`
    SELECT
      u.id,
      u.discordId,
      u.username,
      u.credits,
      u.createdAt,
      u.updatedAt,
      s.plan AS subscriptionPlan,
      s.status AS subscriptionStatus,
      COALESCE(COUNT(DISTINCT c.id), 0) AS conversationCount,
      COALESCE(COUNT(DISTINCT t.id), 0) AS transactionCount
    FROM users u
    LEFT JOIN subscriptions s ON s.userId = u.id
    LEFT JOIN conversations c ON c.userId = u.id
    LEFT JOIN transactions t ON t.userId = u.id
    GROUP BY
      u.id,
      u.discordId,
      u.username,
      u.credits,
      u.createdAt,
      u.updatedAt,
      s.plan,
      s.status
    ORDER BY u.createdAt DESC, u.id DESC
  `);

  return statement.all() as DashboardUserRow[];
}

function getDashboardUserDetail(discordUserId: string): {
  user: DashboardUserDetailRow;
  recentTransactions: UserTransactionRow[];
  recentConversations: UserConversationRow[];
} | null {
  const userStatement = db.prepare(`
    SELECT
      u.id,
      u.discordId,
      u.username,
      u.credits,
      u.createdAt,
      u.updatedAt,
      s.plan AS subscriptionPlan,
      s.status AS subscriptionStatus,
      s.currentPeriodEnd,
      s.cancelAtPeriodEnd,
      COALESCE(COUNT(DISTINCT c.id), 0) AS conversationCount,
      COALESCE(COUNT(DISTINCT t.id), 0) AS transactionCount
    FROM users u
    LEFT JOIN subscriptions s ON s.userId = u.id
    LEFT JOIN conversations c ON c.userId = u.id
    LEFT JOIN transactions t ON t.userId = u.id
    WHERE u.discordId = ?
    GROUP BY
      u.id,
      u.discordId,
      u.username,
      u.credits,
      u.createdAt,
      u.updatedAt,
      s.plan,
      s.status,
      s.currentPeriodEnd,
      s.cancelAtPeriodEnd
  `);

  const transactionStatement = db.prepare(`
    SELECT
      id,
      type,
      amount,
      description,
      createdAt
    FROM transactions
    WHERE userId = ?
    ORDER BY createdAt DESC, id DESC
    LIMIT 10
  `);

  const conversationStatement = db.prepare(`
    SELECT
      id,
      discordChannelId,
      role,
      content,
      createdAt
    FROM conversations
    WHERE userId = ?
    ORDER BY createdAt DESC, id DESC
    LIMIT 10
  `);

  const user = userStatement.get(discordUserId) as DashboardUserDetailRow | undefined;
  if (!user) {
    return null;
  }

  return {
    user,
    recentTransactions: transactionStatement.all(user.id) as UserTransactionRow[],
    recentConversations: conversationStatement.all(user.id) as UserConversationRow[],
  };
}

function getDashboardHtml(): string {
  return String.raw`<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aude AI Dashboard</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe5;
        --panel: rgba(255, 252, 245, 0.92);
        --panel-strong: #fffdf8;
        --border: rgba(59, 43, 19, 0.12);
        --text: #1f1a14;
        --muted: #6d6254;
        --accent: #0f766e;
        --accent-soft: rgba(15, 118, 110, 0.12);
        --shadow: 0 18px 45px rgba(46, 34, 18, 0.08);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Avenir Next", "Hiragino Sans", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 26%),
          radial-gradient(circle at top right, rgba(180, 83, 9, 0.16), transparent 28%),
          linear-gradient(180deg, #f8f3e9 0%, #efe7d6 100%);
      }

      .shell {
        max-width: 1320px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }

      .hero {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: end;
        margin-bottom: 24px;
      }

      .hero h1 {
        margin: 0 0 8px;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 0.94;
        letter-spacing: -0.04em;
      }

      .hero p {
        margin: 0;
        color: var(--muted);
        max-width: 640px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .card,
      .panel {
        background: var(--panel);
        backdrop-filter: blur(14px);
        border: 1px solid var(--border);
        border-radius: 22px;
        box-shadow: var(--shadow);
      }

      .card {
        padding: 18px 20px;
      }

      .card .label {
        display: block;
        margin-bottom: 8px;
        font-size: 0.88rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .card .value {
        font-size: clamp(1.8rem, 3vw, 2.4rem);
        font-weight: 700;
        letter-spacing: -0.04em;
      }

      .content {
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) minmax(320px, 1fr);
        gap: 18px;
      }

      .panel {
        padding: 18px;
      }

      .panel h2,
      .panel h3 {
        margin: 0;
        font-size: 1rem;
        letter-spacing: 0.01em;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
      }

      .toolbar .meta {
        color: var(--muted);
        font-size: 0.92rem;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid var(--border);
        vertical-align: top;
      }

      th {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      tbody tr {
        cursor: pointer;
        transition: background 120ms ease, transform 120ms ease;
      }

      tbody tr:hover,
      tbody tr.is-selected {
        background: var(--accent-soft);
      }

      .pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(31, 26, 20, 0.08);
        font-size: 0.78rem;
        line-height: 1.2;
      }

      .pill.active {
        background: rgba(15, 118, 110, 0.14);
        color: #065f58;
      }

      .detail-stack {
        display: grid;
        gap: 14px;
      }

      .detail-hero {
        padding: 18px;
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(15, 118, 110, 0.16), rgba(180, 83, 9, 0.12));
      }

      .detail-hero h3 {
        margin-bottom: 8px;
        font-size: 1.4rem;
      }

      .detail-hero p {
        margin: 4px 0;
        color: var(--muted);
      }

      .kv {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .kv-item {
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--panel-strong);
      }

      .kv-item strong {
        display: block;
        font-size: 0.82rem;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .list {
        display: grid;
        gap: 10px;
      }

      .list-item {
        padding: 12px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--panel-strong);
      }

      .list-item header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
      }

      .list-item p {
        margin: 0;
        color: var(--muted);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .empty,
      .loading,
      .error {
        padding: 18px;
        border-radius: 16px;
        border: 1px dashed var(--border);
        color: var(--muted);
        background: rgba(255, 255, 255, 0.45);
      }

      @media (max-width: 1080px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .content {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 700px) {
        .shell {
          padding: 22px 14px 32px;
        }

        .hero,
        .toolbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .grid,
        .kv {
          grid-template-columns: 1fr;
        }

        th:nth-child(5),
        td:nth-child(5),
        th:nth-child(6),
        td:nth-child(6) {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div>
          <h1>Aude AI<br />Admin Dashboard</h1>
          <p>Discord botユーザーの利用状況、購読状態、直近アクティビティを1画面で確認できます。</p>
        </div>
        <div class="meta" id="lastUpdated">Loading...</div>
      </section>

      <section class="grid">
        <article class="card">
          <span class="label">Total Users</span>
          <div class="value" id="stat-totalUsers">-</div>
        </article>
        <article class="card">
          <span class="label">Active Subscriptions</span>
          <div class="value" id="stat-activeSubscriptions">-</div>
        </article>
        <article class="card">
          <span class="label">Total Credits</span>
          <div class="value" id="stat-totalCredits">-</div>
        </article>
        <article class="card">
          <span class="label">Conversations</span>
          <div class="value" id="stat-totalConversations">-</div>
        </article>
      </section>

      <section class="content">
        <section class="panel">
          <div class="toolbar">
            <div>
              <h2>Users</h2>
              <div class="meta" id="usersCount">-</div>
            </div>
          </div>
          <div style="overflow:auto;">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Discord ID</th>
                  <th>Plan</th>
                  <th>Credits</th>
                  <th>Conversations</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody id="usersTableBody">
                <tr>
                  <td colspan="6"><div class="loading">Loading users...</div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="panel">
          <div class="toolbar">
            <div>
              <h2>User Detail</h2>
              <div class="meta">テーブルの行を選択すると詳細を表示します。</div>
            </div>
          </div>
          <div id="userDetail" class="detail-stack">
            <div class="empty">ユーザーを選択してください。</div>
          </div>
        </aside>
      </section>
    </main>

    <script>
      const state = {
        users: [],
        selectedDiscordId: null
      };

      const formatNumber = (value) => new Intl.NumberFormat('ja-JP').format(value);
      const formatDate = (value) => value ? new Date(value).toLocaleString('ja-JP') : '-';

      function setLastUpdated() {
        document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleString('ja-JP');
      }

      async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Request failed: ' + response.status);
        }
        return response.json();
      }

      async function loadStats() {
        const stats = await fetchJson('/api/stats');
        document.getElementById('stat-totalUsers').textContent = formatNumber(stats.totalUsers);
        document.getElementById('stat-activeSubscriptions').textContent = formatNumber(stats.activeSubscriptions);
        document.getElementById('stat-totalCredits').textContent = formatNumber(stats.totalCredits);
        document.getElementById('stat-totalConversations').textContent = formatNumber(stats.totalConversations);
      }

      function renderUsers() {
        const body = document.getElementById('usersTableBody');
        document.getElementById('usersCount').textContent = state.users.length + ' users';

        if (state.users.length === 0) {
          body.innerHTML = '<tr><td colspan="6"><div class="empty">ユーザーがまだ存在しません。</div></td></tr>';
          return;
        }

        body.innerHTML = '';

        state.users.forEach((user) => {
          const row = document.createElement('tr');
          row.dataset.discordId = user.discordId;
          if (state.selectedDiscordId === user.discordId) {
            row.classList.add('is-selected');
          }

          const statusClass = user.subscriptionStatus === 'active' ? 'pill active' : 'pill';
          row.innerHTML = [
            '<td><strong>' + escapeHtml(user.username) + '</strong></td>',
            '<td>' + escapeHtml(user.discordId) + '</td>',
            '<td><span class="' + statusClass + '">' + escapeHtml(user.subscriptionPlan || 'free') + '</span></td>',
            '<td>' + formatNumber(user.credits) + '</td>',
            '<td>' + formatNumber(user.conversationCount) + '</td>',
            '<td>' + escapeHtml(formatDate(user.createdAt)) + '</td>'
          ].join('');

          row.addEventListener('click', () => {
            state.selectedDiscordId = user.discordId;
            renderUsers();
            void loadUserDetail(user.discordId);
          });

          body.appendChild(row);
        });
      }

      async function loadUsers() {
        state.users = await fetchJson('/api/users');
        renderUsers();
        if (state.users.length > 0) {
          state.selectedDiscordId = state.users[0].discordId;
          renderUsers();
          await loadUserDetail(state.selectedDiscordId);
        }
      }

      function renderUserDetail(payload) {
        const root = document.getElementById('userDetail');
        const user = payload.user;
        const plan = user.subscriptionPlan || 'free';
        const status = user.subscriptionStatus || 'none';

        root.innerHTML = '';

        const hero = document.createElement('section');
        hero.className = 'detail-hero';
        hero.innerHTML = [
          '<h3>' + escapeHtml(user.username) + '</h3>',
          '<p>Discord ID: ' + escapeHtml(user.discordId) + '</p>',
          '<p>Plan: ' + escapeHtml(plan) + ' / Status: ' + escapeHtml(status) + '</p>'
        ].join('');
        root.appendChild(hero);

        const kv = document.createElement('section');
        kv.className = 'kv';
        kv.innerHTML = [
          createKvItem('Credits', formatNumber(user.credits)),
          createKvItem('Transactions', formatNumber(user.transactionCount)),
          createKvItem('Conversations', formatNumber(user.conversationCount)),
          createKvItem('Period End', formatDate(user.currentPeriodEnd)),
          createKvItem('Cancel At Period End', user.cancelAtPeriodEnd ? 'Yes' : 'No'),
          createKvItem('Created', formatDate(user.createdAt))
        ].join('');
        root.appendChild(kv);

        root.appendChild(createListSection('Recent Transactions', payload.recentTransactions.map((item) => ({
          title: item.type + ' / ' + formatNumber(item.amount),
          meta: formatDate(item.createdAt),
          body: item.description || 'No description'
        })), '取引履歴はまだありません。'));

        root.appendChild(createListSection('Recent Conversations', payload.recentConversations.map((item) => ({
          title: item.role + ' @ ' + item.discordChannelId,
          meta: formatDate(item.createdAt),
          body: item.content
        })), '会話履歴はまだありません。'));
      }

      function createKvItem(label, value) {
        return '<div class="kv-item"><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(value) + '</span></div>';
      }

      function createListSection(title, items, emptyText) {
        const section = document.createElement('section');
        section.className = 'detail-stack';

        const heading = document.createElement('h3');
        heading.textContent = title;
        section.appendChild(heading);

        if (items.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = emptyText;
          section.appendChild(empty);
          return section;
        }

        const list = document.createElement('div');
        list.className = 'list';

        items.forEach((item) => {
          const entry = document.createElement('article');
          entry.className = 'list-item';
          entry.innerHTML = [
            '<header><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.meta) + '</span></header>',
            '<p>' + escapeHtml(item.body) + '</p>'
          ].join('');
          list.appendChild(entry);
        });

        section.appendChild(list);
        return section;
      }

      async function loadUserDetail(discordId) {
        const root = document.getElementById('userDetail');
        root.innerHTML = '<div class="loading">Loading user detail...</div>';

        try {
          const payload = await fetchJson('/api/users/' + encodeURIComponent(discordId));
          renderUserDetail(payload);
        } catch (error) {
          root.innerHTML = '<div class="error">ユーザー詳細の取得に失敗しました。</div>';
        }
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      async function bootstrap() {
        try {
          await Promise.all([loadStats(), loadUsers()]);
          setLastUpdated();
        } catch (error) {
          document.getElementById('usersTableBody').innerHTML =
            '<tr><td colspan="6"><div class="error">ダッシュボードの初期化に失敗しました。</div></td></tr>';
          document.getElementById('userDetail').innerHTML =
            '<div class="error">データ取得に失敗しました。サーバーログを確認してください。</div>';
        }
      }

      void bootstrap();
    </script>
  </body>
</html>`;
}

export function startApiServer(): http.Server {
  const port = Number(process.env.PORT ?? 3001);
  const server = http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (method === 'GET' && url.pathname === '/') {
      sendHtml(res, 200, getDashboardHtml());
      return;
    }

    if (method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'GET' && url.pathname === '/api/stats') {
      try {
        sendJson(res, 200, getDashboardStats());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (method === 'GET' && url.pathname === '/api/users') {
      try {
        sendJson(res, 200, getDashboardUsers());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (method === 'GET' && url.pathname.startsWith('/api/users/')) {
      try {
        const discordUserId = decodeURIComponent(url.pathname.replace('/api/users/', ''));
        if (!discordUserId) {
          sendJson(res, 400, { error: 'discordUserId is required' });
          return;
        }

        const userDetail = getDashboardUserDetail(discordUserId);
        if (!userDetail) {
          sendJson(res, 404, { error: 'User not found' });
          return;
        }

        sendJson(res, 200, userDetail);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, { error: message });
      }
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
