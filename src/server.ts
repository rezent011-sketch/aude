import crypto from 'crypto';
import http, { IncomingMessage, ServerResponse } from 'http';
import { getDb } from './db/database';
import { createCheckoutSession } from './stripe/stripeManager';
import { isSubscriptionPlan } from './stripe/plans';
import { stripeWebhook } from './webhooks/stripeWebhook';
import GuildRepository, { GuildSettings } from './db/guildRepository';
import {
  getAnalyticsSummary,
  getDailyStats,
  getTopUsers,
  getModelUsageStats,
} from './services/analyticsService';
import { parseLstepWebhook, forwardToDiscord } from './integrations/lstep';
import { parseElmeWebhook, forwardElmeToDiscord } from './integrations/elme';
import { parseUtageWebhook, forwardUtageToDiscord } from './integrations/utage';
import { parseLmessageWebhook, forwardLmessageToDiscord } from './integrations/lmessage';
import { handleLineWebhook, LineWebhookBody } from './handlers/lineHandler';
import { getDiscordClient } from './services/discordClient';
import vaultService from './services/vaultService';

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
const MANAGE_GUILD_PERMISSION = 0x20n;
const SESSION_COOKIE_NAME = 'aude_session';

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface SessionRecord {
  user: DiscordUser;
  guilds: DiscordGuild[];
  token: string;
  expiresAt: number;
}

const discordSessions = new Map<string, SessionRecord>();

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

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }

  return header.split(';').reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rest] = item.trim().split('=');
    if (!rawKey || rest.length === 0) {
      return acc;
    }

    acc[rawKey] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getDiscordRedirectUri(): string {
  return process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:3001/auth/discord/callback';
}

function hasDiscordOauthConfig(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID?.trim() && process.env.DISCORD_CLIENT_SECRET?.trim());
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of discordSessions.entries()) {
    if (session.expiresAt <= now) {
      discordSessions.delete(sessionId);
    }
  }
}

function getSession(req: IncomingMessage): { sessionId: string; session: SessionRecord } | null {
  cleanupExpiredSessions();

  const sessionId = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return null;
  }

  const session = discordSessions.get(sessionId);
  if (!session) {
    return null;
  }

  return { sessionId, session };
}

function clearSession(res: ServerResponse, sessionId?: string): void {
  if (sessionId) {
    discordSessions.delete(sessionId);
  }
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function setSessionCookie(res: ServerResponse, sessionId: string): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );
}

function getDiscordAvatarUrl(user: DiscordUser): string {
  if (!user.avatar) {
    const fallbackIndex = Number(user.id) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
  }

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function canManageGuild(guild: DiscordGuild): boolean {
  try {
    return (BigInt(guild.permissions) & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
  } catch {
    return false;
  }
}

function getGuildPresenceMap(): Map<string, GuildSettings> {
  return new Map(GuildRepository.listAll().map((guild) => [guild.guild_id, guild]));
}

function getOauthSetupHtml(details?: string): string {
  const message = details ? `<p class="details">${escapeHtml(details)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aude AI | Discord OAuth Setup</title>
    <style>
      :root {
        --bg: #0d1117;
        --panel: rgba(22, 27, 34, 0.92);
        --border: rgba(255, 255, 255, 0.1);
        --text: #f0f6fc;
        --muted: #8b949e;
        --accent: #5865f2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(88, 101, 242, 0.24), transparent 40%),
          linear-gradient(180deg, #0d1117 0%, #0a0f1a 100%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(720px, 100%);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      }
      h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3rem); }
      p { margin: 0 0 16px; color: var(--muted); line-height: 1.7; }
      .details {
        color: #ffd8a8;
        background: rgba(255, 184, 108, 0.1);
        border: 1px solid rgba(255, 184, 108, 0.2);
        border-radius: 14px;
        padding: 14px 16px;
      }
      pre {
        margin: 20px 0;
        padding: 18px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: rgba(1, 4, 9, 0.72);
        overflow: auto;
        color: #c9d1d9;
      }
      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        background: var(--accent);
        color: white;
        text-decoration: none;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Discord OAuth の設定が必要です</h1>
      <p>公開ダッシュボードを使うには、Discord アプリの OAuth2 設定を <code>.env</code> に追加してください。</p>
      ${message}
      <pre># Discord OAuth2
# DISCORD_CLIENT_SECRET=your_discord_client_secret
# DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback</pre>
      <a href="/">トップへ戻る</a>
    </main>
  </body>
</html>`;
}

async function exchangeDiscordCode(code: string): Promise<DiscordTokenResponse> {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be configured.');
  }

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getDiscordRedirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord token exchange failed with status ${response.status}.`);
  }

  return (await response.json()) as DiscordTokenResponse;
}

async function fetchDiscordResource<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://discord.com/api${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Discord API request failed for ${path} with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function getLandingPageHtml(): string {
  const pricingPlans = [
    { name: 'Free', price: '¥0 / 月', credits: '100クレジット', detail: '基本機能' },
    { name: 'Starter', price: '¥980 / 月', credits: '1,000クレジット', detail: '全機能' },
    { name: 'Pro', price: '¥2,980 / 月', credits: '3,000クレジット', detail: '優先サポート' },
    { name: 'Team', price: '¥9,800 / 月', credits: '10,000クレジット', detail: '管理機能' },
  ];

  const featureCards = [
    { emoji: '🤖', title: 'AIアシスタント', body: 'タスク・調査・コード生成' },
    { emoji: '🌐', title: 'Webブラウジング', body: 'URLを読んでAI要約' },
    { emoji: '💻', title: 'コード実行', body: 'Python/JS/Bashをその場で実行' },
    { emoji: '🔗', title: '外部連携', body: 'GitHub/Notion/Jira/Slack等24種' },
    { emoji: '🧠', title: 'チームメモリ', body: 'サーバー共有の長期記憶' },
    { emoji: '⚡', title: 'バックグラウンド', body: '長時間タスクを非同期実行' },
  ];

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aude AI | Discord にいる AI 社員</title>
    <style>
      :root {
        --bg: #0d1117;
        --bg-alt: #111827;
        --panel: rgba(22, 27, 34, 0.78);
        --panel-strong: rgba(30, 41, 59, 0.92);
        --border: rgba(255, 255, 255, 0.08);
        --text: #f0f6fc;
        --muted: #9aa4b2;
        --accent: #5865f2;
        --accent-2: #7289da;
        --success: #3fb950;
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(88, 101, 242, 0.28), transparent 34%),
          radial-gradient(circle at 80% 0%, rgba(114, 137, 218, 0.18), transparent 28%),
          linear-gradient(180deg, #0d1117 0%, #0b1220 52%, #0d1117 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      a { color: inherit; }
      .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px 0;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .brand img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
      }
      .nav-links {
        display: flex;
        gap: 14px;
        align-items: center;
      }
      .nav-links a {
        color: var(--muted);
        text-decoration: none;
      }
      .hero {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 28px;
        padding: 48px 0 72px;
        align-items: center;
      }
      .hero-card,
      .panel,
      .price-card {
        background: var(--panel);
        border: 1px solid var(--border);
        backdrop-filter: blur(18px);
        box-shadow: 0 24px 90px rgba(0, 0, 0, 0.32);
      }
      .hero-copy h1 {
        margin: 0;
        font-size: clamp(3.2rem, 9vw, 6.6rem);
        line-height: 0.92;
        letter-spacing: -0.05em;
      }
      .hero-copy p {
        margin: 18px 0 0;
        color: var(--muted);
        font-size: clamp(1rem, 2vw, 1.3rem);
        line-height: 1.8;
      }
      .hero-actions {
        display: flex;
        gap: 14px;
        margin-top: 32px;
        flex-wrap: wrap;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 52px;
        padding: 0 22px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .button:hover { transform: translateY(-1px); }
      .button.primary {
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: white;
        box-shadow: 0 18px 36px rgba(88, 101, 242, 0.28);
      }
      .button.secondary {
        border: 1px solid var(--border);
        color: var(--text);
        background: rgba(255, 255, 255, 0.03);
      }
      .hero-card {
        border-radius: 28px;
        padding: 28px;
      }
      .hero-stat {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .hero-stat:last-child { border-bottom: 0; }
      .hero-stat strong { font-size: 1.6rem; }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        margin-bottom: 18px;
        color: #dbe4ff;
        background: rgba(88, 101, 242, 0.16);
        border: 1px solid rgba(88, 101, 242, 0.32);
        font-size: 0.9rem;
        font-weight: 700;
      }
      section { padding: 18px 0 36px; }
      .section-head {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: end;
        margin-bottom: 24px;
      }
      .section-head h2 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
      }
      .section-head p {
        margin: 0;
        color: var(--muted);
        max-width: 620px;
        line-height: 1.7;
      }
      .feature-grid,
      .pricing-grid {
        display: grid;
        gap: 18px;
      }
      .feature-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .pricing-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .panel,
      .price-card {
        border-radius: 24px;
        padding: 24px;
      }
      .feature-icon {
        font-size: 1.8rem;
        margin-bottom: 18px;
      }
      .panel h3,
      .price-card h3 {
        margin: 0 0 10px;
        font-size: 1.2rem;
      }
      .panel p,
      .price-card p,
      .price-card li {
        color: var(--muted);
        line-height: 1.7;
      }
      .price {
        display: block;
        margin: 12px 0 18px;
        font-size: 2rem;
        font-weight: 800;
        color: var(--text);
      }
      .price-card ul {
        list-style: none;
        padding: 0;
        margin: 0 0 24px;
      }
      .price-card li {
        padding: 10px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }
      .price-card li:first-child { border-top: 0; }
      footer {
        padding: 36px 0 48px;
        color: var(--muted);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      footer .footer-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      footer a {
        text-decoration: none;
        color: var(--muted);
      }
      @media (max-width: 1024px) {
        .hero,
        .feature-grid,
        .pricing-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 768px) {
        .nav,
        .section-head,
        footer .footer-row {
          flex-direction: column;
          align-items: flex-start;
        }
        .hero,
        .feature-grid,
        .pricing-grid {
          grid-template-columns: 1fr;
        }
        .hero {
          padding-top: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="nav">
        <div class="brand"><img src="https://cdn.discordapp.com/avatars/1505367333282119731/b5d0b21b40f7bd29ee0c008b8f6be16b.png" alt="Aude AI" />AUDE AI</div>
        <nav class="nav-links">
          <a href="#features">機能</a>
          <a href="#pricing">料金</a>
          <a href="/dashboard">ダッシュボード</a>
        </nav>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">Discord-native AI Workspace</div>
          <h1>Aude AI</h1>
          <p>Discord にいる AI 社員。会話の中で調査し、コードを書き、外部ツールをまたいで長時間タスクまで進めます。</p>
          <div class="hero-actions">
            <a class="button primary" href="/auth/discord">Add to Discord</a>
            <a class="button secondary" href="#features">Learn more</a>
          </div>
        </div>
        <aside class="hero-card">
          <div class="hero-stat"><span>Assistants</span><strong>24+</strong></div>
          <div class="hero-stat"><span>Background Jobs</span><strong>∞</strong></div>
          <div class="hero-stat"><span>Team Memory</span><strong>Shared</strong></div>
          <div class="hero-stat"><span>Discord-ready</span><strong style="color: var(--success);">Online</strong></div>
        </aside>
      </section>

      <section id="features">
        <div class="section-head">
          <div>
            <h2>Features</h2>
          </div>
          <p>個人のAIチャットではなく、サーバーに常駐する作業エージェントとして設計しています。</p>
        </div>
        <div class="feature-grid">
          ${featureCards.map((feature) => `
            <article class="panel">
              <div class="feature-icon">${feature.emoji}</div>
              <h3>${feature.title}</h3>
              <p>${feature.body}</p>
            </article>
          `).join('')}
        </div>
      </section>

      <section id="pricing">
        <div class="section-head">
          <div>
            <h2>Pricing</h2>
          </div>
          <p>まずは無料で始めて、利用量に応じて拡張できます。すべてのプランは Discord OAuth から即時開始です。</p>
        </div>
        <div class="pricing-grid">
          ${pricingPlans.map((plan) => `
            <article class="price-card">
              <h3>${plan.name}</h3>
              <span class="price">${plan.price}</span>
              <ul>
                <li>${plan.credits}</li>
                <li>${plan.detail}</li>
              </ul>
              <a class="button primary" href="/auth/discord">Discord で始める</a>
            </article>
          `).join('')}
        </div>
      </section>

      <footer>
        <div class="footer-row">
          <div>© 2026 Aude AI</div>
          <div>
            <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
            <span> | </span>
            <a href="/terms">利用規約</a>
            <span> | </span>
            <a href="/privacy">プライバシーポリシー</a>
          </div>
        </div>
      </footer>
    </div>
  </body>
</html>`;
}

function getUserDashboardHtml(session: SessionRecord): string {
  const avatarUrl = getDiscordAvatarUrl(session.user);
  const safeUsername = escapeHtml(session.user.username);
  const guildSummary = session.guilds.length.toLocaleString('ja-JP');

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aude AI | Dashboard</title>
    <style>
      :root {
        --bg: #0d1117;
        --bg-alt: #111827;
        --panel: rgba(22, 27, 34, 0.86);
        --panel-soft: rgba(17, 24, 39, 0.76);
        --border: rgba(255, 255, 255, 0.08);
        --text: #f0f6fc;
        --muted: #97a3b6;
        --accent: #5865f2;
        --accent-2: #7289da;
        --ok: #3fb950;
        --warn: #f59e0b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(88, 101, 242, 0.18), transparent 32%),
          linear-gradient(180deg, #0d1117 0%, #0b1220 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .layout {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 260px 1fr;
      }
      aside {
        padding: 28px 20px;
        border-right: 1px solid var(--border);
        background: rgba(11, 18, 32, 0.72);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.25rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin-bottom: 28px;
      }
      .brand img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
      }
      .nav {
        display: grid;
        gap: 10px;
      }
      .nav a {
        color: var(--muted);
        text-decoration: none;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid transparent;
      }
      .nav a.active {
        color: var(--text);
        border-color: rgba(88, 101, 242, 0.3);
        background: rgba(88, 101, 242, 0.12);
      }
      main {
        padding: 28px;
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }
      .topbar h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 3rem);
      }
      .topbar p {
        margin: 8px 0 0;
        color: var(--muted);
      }
      .user-chip {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--panel);
        border: 1px solid var(--border);
      }
      .user-chip img {
        width: 42px;
        height: 42px;
        border-radius: 50%;
      }
      .logout {
        color: var(--muted);
        text-decoration: none;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 18px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 20px 80px rgba(0, 0, 0, 0.28);
      }
      .card h2,
      .card h3 {
        margin: 0 0 12px;
      }
      .muted {
        color: var(--muted);
      }
      .welcome {
        display: grid;
        gap: 18px;
      }
      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        flex-wrap: wrap;
      }
      .hero-meta {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: white;
      }
      .guild-list {
        display: grid;
        gap: 12px;
        margin-top: 18px;
      }
      .guild-item {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 16px;
        border-radius: 18px;
        background: var(--panel-soft);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .guild-item strong { display: block; margin-bottom: 6px; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.88rem;
        padding: 7px 10px;
        border-radius: 999px;
      }
      .status.online {
        color: var(--ok);
        background: rgba(63, 185, 80, 0.14);
      }
      .status.pending {
        color: var(--warn);
        background: rgba(245, 158, 11, 0.14);
      }
      .empty, .error {
        border-radius: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.03);
        color: var(--muted);
      }
      .error {
        color: #ffb4b4;
        background: rgba(248, 113, 113, 0.08);
      }
      .kv {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .kv-item {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .kv-item strong {
        display: block;
        color: var(--muted);
        margin-bottom: 8px;
        font-size: 0.86rem;
      }
      @media (max-width: 980px) {
        .layout,
        .grid {
          grid-template-columns: 1fr;
        }
        aside {
          border-right: 0;
          border-bottom: 1px solid var(--border);
        }
      }
      @media (max-width: 640px) {
        main {
          padding: 20px;
        }
        .topbar,
        .hero {
          flex-direction: column;
          align-items: flex-start;
        }
        .kv {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <aside>
        <div class="brand"><img src="https://cdn.discordapp.com/avatars/1505367333282119731/b5d0b21b40f7bd29ee0c008b8f6be16b.png" alt="Aude AI" />AUDE AI</div>
        <nav class="nav">
          <a class="active" href="/dashboard">ホーム</a>
          <a href="/integrations">連携設定</a>
          <a href="/admin">クレジット</a>
          <a href="/guilds">サーバー設定</a>
        </nav>
      </aside>
      <main>
        <header class="topbar">
          <div>
            <h1>Aude AI Dashboard</h1>
            <p>Discord アカウントと参加サーバーの接続状態をここから管理できます。</p>
          </div>
          <div class="user-chip">
            <img src="${escapeHtml(avatarUrl)}" alt="avatar" />
            <div>
              <div>${safeUsername}</div>
              <a class="logout" href="/auth/logout">ログアウト</a>
            </div>
          </div>
        </header>

        <section class="grid">
          <article class="card welcome">
            <div class="hero">
              <div>
                <h2>Welcome, <span id="welcomeUsername">${safeUsername}</span></h2>
                <p class="muted">ログイン済みの Discord プロフィールとサーバー権限をもとに、Aude の接続先を一覧表示します。</p>
              </div>
              <a
                class="button"
                href="https://discord.com/oauth2/authorize?client_id=1505367333282119731&permissions=8&scope=bot%20applications.commands"
                target="_blank"
                rel="noreferrer"
              >Discordサーバーに追加</a>
            </div>
            <div class="hero-meta">
              <div class="pill">ユーザーID: <span id="userId">${escapeHtml(session.user.id)}</span></div>
              <div class="pill">接続サーバー数: <span id="guildCount">${guildSummary}</span></div>
            </div>
            <div class="kv">
              <div class="kv-item"><strong>Discord Username</strong><span id="usernameValue">${safeUsername}</span></div>
              <div class="kv-item"><strong>Discriminator</strong><span id="discriminatorValue">${escapeHtml(session.user.discriminator)}</span></div>
            </div>
          </article>

          <article class="card">
            <h3>接続状況</h3>
            <p class="muted">Aude AI が導入済みのサーバーと、まだ追加可能なサーバーを区別して表示します。</p>
            <div id="dashboardStatus" class="muted">ロード中...</div>
          </article>
        </section>

        <section class="card" style="margin-top: 18px;">
          <h3>Connected Guilds</h3>
          <p class="muted">MANAGE_GUILD 権限を持つサーバーは、導入後すぐに設定管理へ進めます。</p>
          <div id="guildList" class="guild-list">
            <div class="empty">サーバー情報を読み込み中です。</div>
          </div>
        </section>
      </main>
    </div>

    <script>
      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function renderGuilds(guilds) {
        const root = document.getElementById('guildList');
        const status = document.getElementById('dashboardStatus');

        document.getElementById('guildCount').textContent = new Intl.NumberFormat('ja-JP').format(guilds.length);

        const connected = guilds.filter((guild) => guild.hasAude);
        status.textContent = connected.length + ' server(s) already connected to Aude AI';

        if (guilds.length === 0) {
          root.innerHTML = '<div class="empty">表示可能な Discord サーバーがありません。</div>';
          return;
        }

        root.innerHTML = guilds.map((guild) => {
          const badgeClass = guild.hasAude ? 'status online' : 'status pending';
          const badgeText = guild.hasAude ? 'Aude AI 導入済み' : 'Aude AI 未導入';
          const manageText = guild.canManage ? '管理可能' : '権限不足';
          const guildName = escapeHtml(guild.name);
          const detail = guild.hasAude
            ? 'Aude はこのサーバーに参加しています。'
            : '追加ボタンから Bot を導入できます。';

          return [
            '<article class="guild-item">',
            '<div>',
            '<strong>' + guildName + '</strong>',
            '<div class="muted">' + escapeHtml(detail) + '</div>',
            '</div>',
            '<div>',
            '<div class="' + badgeClass + '">' + badgeText + '</div>',
            '<div class="muted" style="margin-top:8px;">' + manageText + '</div>',
            '</div>',
            '</article>'
          ].join('');
        }).join('');
      }

      async function bootstrap() {
        try {
          const res = await fetch('/api/me', { credentials: 'same-origin' });
          if (!res.ok) {
            window.location.href = '/auth/discord';
            return;
          }

          const payload = await res.json();
          const user = payload.user;
          document.getElementById('welcomeUsername').textContent = user.username;
          document.getElementById('usernameValue').textContent = user.username;
          document.getElementById('discriminatorValue').textContent = user.discriminator;
          document.getElementById('userId').textContent = user.id;
          renderGuilds(payload.guilds);
        } catch (error) {
          document.getElementById('dashboardStatus').outerHTML =
            '<div class="error">ダッシュボードの読み込みに失敗しました。</div>';
          document.getElementById('guildList').innerHTML =
            '<div class="error">Discord の接続情報を取得できませんでした。</div>';
        }
      }

      void bootstrap();
    </script>
  </body>
</html>`;
}

function getSimpleInfoPageHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | Aude AI</title>
    <style>
      :root {
        --bg: #0d1117;
        --panel: rgba(22, 27, 34, 0.9);
        --border: rgba(255, 255, 255, 0.08);
        --text: #f0f6fc;
        --muted: #97a3b6;
        --accent: #5865f2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(88, 101, 242, 0.18), transparent 34%),
          linear-gradient(180deg, #0d1117 0%, #0b1220 100%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(760px, 100%);
        padding: 32px;
        border-radius: 24px;
        border: 1px solid var(--border);
        background: var(--panel);
      }
      h1 { margin-top: 0; }
      p { color: var(--muted); line-height: 1.8; }
      a {
        color: white;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        background: var(--accent);
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      <a href="/">トップへ戻る</a>
    </main>
  </body>
</html>`;
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

function getIntegrationsDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aude — Integrations</title>
  <style>
    :root {
      --bg: #0d0f14;
      --panel: #13151c;
      --panel-hover: #1a1d27;
      --border: rgba(255,255,255,0.07);
      --border-strong: rgba(255,255,255,0.14);
      --text: #e8eaf0;
      --muted: #7a7e99;
      --accent: #7c6dfa;
      --accent-dim: rgba(124,109,250,0.15);
      --green: #22c55e;
      --green-dim: rgba(34,197,94,0.12);
      --red: #ef4444;
      --red-dim: rgba(239,68,68,0.12);
      --japan: #f59e0b;
      --japan-dim: rgba(245,158,11,0.12);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }

    /* ── Header / Nav ── */
    .header { border-bottom: 1px solid var(--border); padding: 0 32px; }
    .header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 56px; }
    .logo { font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text); text-decoration: none; }
    .logo span { color: var(--accent); }
    .nav { display: flex; gap: 4px; }
    .nav a { color: var(--muted); text-decoration: none; font-size: 0.85rem; padding: 6px 12px; border-radius: 8px; transition: all 0.15s; }
    .nav a:hover { color: var(--text); background: rgba(255,255,255,0.05); }
    .nav a.active { color: var(--text); background: rgba(255,255,255,0.08); font-weight: 500; }

    /* ── Main Layout ── */
    .shell { max-width: 1200px; margin: 0 auto; padding: 40px 32px; }
    .page-header { margin-bottom: 32px; }
    .page-title { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 6px; }
    .page-sub { color: var(--muted); font-size: 0.9rem; }

    /* ── Stats Bar ── */
    .stats-bar { display: flex; gap: 24px; margin-bottom: 32px; padding: 20px 24px; background: var(--panel); border: 1px solid var(--border); border-radius: 16px; }
    .stat { display: flex; flex-direction: column; gap: 2px; }
    .stat-num { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .stat-num.green { color: var(--green); }
    .stat-num.muted { color: var(--muted); }
    .stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .stat-divider { width: 1px; background: var(--border); margin: 0 8px; }

    /* ── Controls ── */
    .controls { display: flex; gap: 12px; margin-bottom: 28px; align-items: center; flex-wrap: wrap; }
    .search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 360px; }
    .search-wrap input {
      width: 100%; padding: 9px 12px 9px 38px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
      color: var(--text); font-size: 0.875rem; outline: none;
      transition: border-color 0.15s;
    }
    .search-wrap input:focus { border-color: var(--accent); }
    .search-wrap input::placeholder { color: var(--muted); }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.9rem; pointer-events: none; }
    .filter-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter-btn {
      padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border);
      background: transparent; color: var(--muted); font-size: 0.8rem; cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .filter-btn:hover { color: var(--text); border-color: var(--border-strong); }
    .filter-btn.active { background: var(--accent-dim); color: var(--accent); border-color: rgba(124,109,250,0.3); font-weight: 500; }
    .filter-btn.japan.active { background: var(--japan-dim); color: var(--japan); border-color: rgba(245,158,11,0.3); }

    /* ── Section ── */
    .section { margin-bottom: 40px; }
    .section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .section-label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    .section-count { font-size: 0.75rem; color: var(--muted); background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 999px; }
    .section-jp-badge { font-size: 0.7rem; background: var(--japan-dim); color: var(--japan); padding: 2px 8px; border-radius: 999px; font-weight: 600; }

    /* ── Grid ── */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }

    /* ── Card ── */
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      transition: all 0.15s;
      cursor: default;
      position: relative;
      overflow: hidden;
    }
    .card:hover { background: var(--panel-hover); border-color: var(--border-strong); }
    .card.connected { border-color: rgba(34,197,94,0.2); }
    .card.connected:hover { border-color: rgba(34,197,94,0.35); }
    .card-logo {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .card-logo img { width: 22px; height: 22px; object-fit: contain; }
    .card-logo .emoji { font-size: 1.2rem; line-height: 1; }
    .card-body { flex: 1; min-width: 0; }
    .card-name { font-size: 0.88rem; font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-desc { font-size: 0.75rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; }
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600;
    }
    .badge::before { content: ''; display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
    .badge-ok  { background: var(--green-dim); color: var(--green); }
    .badge-ng  { background: rgba(255,255,255,0.05); color: var(--muted); }
    .badge-jp  { background: var(--japan-dim); color: var(--japan); }
    .card-env { font-size: 0.68rem; color: rgba(255,255,255,0.25); margin-top: 4px; font-family: 'SF Mono', monospace; }

    /* ── Empty ── */
    .no-results { padding: 60px 0; text-align: center; color: var(--muted); font-size: 0.9rem; display: none; }
    .no-results.show { display: block; }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .shell { padding: 24px 16px; }
      .header { padding: 0 16px; }
      .stats-bar { flex-wrap: wrap; gap: 16px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">Aude <span>AI</span></a>
      <nav class="nav">
        <a href="/">Users</a>
        <a href="/guilds">Servers</a>
        <a href="/integrations" class="active">Integrations</a>
        <a href="/analytics">Analytics</a>
      </nav>
    </div>
  </header>

  <div class="shell">
    <div class="page-header">
      <h1 class="page-title">Integrations</h1>
      <p class="page-sub">100+ 外部ツール連携 — APIキーを .env に設定するだけで使えます</p>
    </div>

    <div class="stats-bar" id="stats-bar">
      <div class="stat">
        <div class="stat-num" id="stat-total">—</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat-num green" id="stat-connected">—</div>
        <div class="stat-label">Connected</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat-num muted" id="stat-pending">—</div>
        <div class="stat-label">Not Connected</div>
      </div>
    </div>

    <div class="controls">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" id="search" placeholder="ツールを検索..." oninput="filterAll()" />
      </div>
      <div class="filter-btns" id="filter-btns">
        <button class="filter-btn active" onclick="setFilter('all', this)">すべて</button>
        <button class="filter-btn" onclick="setFilter('connected', this)">✅ 設定済み</button>
        <button class="filter-btn" onclick="setFilter('pending', this)">⬜ 未設定</button>
        <button class="filter-btn japan" onclick="setFilter('japan', this)">🇯🇵 日本特化</button>
      </div>
    </div>

    <div id="sections-root"></div>
    <div class="no-results" id="no-results">該当するツールが見つかりませんでした</div>
  </div>

<script>
var SI = 'https://cdn.simpleicons.org';
var IC = 'https://api.iconify.design';

var CATS = [
  { id: 'ai', label: 'AI Models', emoji: '🤖', jp: false, tools: [
    { key:'openai',       name:'OpenAI',           desc:'GPT-4o / gpt-5.4',                 logo: IC+'/simple-icons:openai.svg?color=ffffff',         env:'OPENAI_API_KEY' },
    { key:'anthropic',    name:'Anthropic',         desc:'Claude 3.5 Sonnet',                logo: SI+'/anthropic/ffffff',                              env:'ANTHROPIC_API_KEY' },
    { key:'gemini',       name:'Google Gemini',     desc:'Gemini 1.5 Pro',                   logo: SI+'/googlegemini/ffffff',                           env:'GEMINI_API_KEY' },
    { key:'fal',          name:'fal.ai',            desc:'FLUX / Kling 動画生成',            logo: IC+'/simple-icons:falDotAi.svg?color=ffffff',        env:'FAL_KEY' },
  ]},
  { id: 'communication', label: 'Communication', emoji: '💬', jp: false, tools: [
    { key:'slack',        name:'Slack',             desc:'チームチャット・通知',              logo: SI+'/slack/ffffff',                                  env:'SLACK_BOT_TOKEN' },
    { key:'teams',        name:'Microsoft Teams',   desc:'Teams通知・メッセージ',            logo: SI+'/microsoftteams/ffffff',                         env:'TEAMS_WEBHOOK_URL' },
    { key:'zoom',         name:'Zoom',              desc:'ビデオ会議',                        logo: SI+'/zoom/ffffff',                                   env:'ZOOM_CLIENT_ID' },
    { key:'line',         name:'LINE',              desc:'LINEメッセージ送受信',              logo: SI+'/line/ffffff',                                   env:'LINE_CHANNEL_ACCESS_TOKEN' },
    { key:'twilio',       name:'Twilio',            desc:'SMS・電話',                         logo: SI+'/twilio/ffffff',                                 env:'TWILIO_ACCOUNT_SID' },
    { key:'vonage',       name:'Vonage',            desc:'SMS・音声通話',                     logo: SI+'/vonage/ffffff',                                 env:'VONAGE_API_KEY' },
    { key:'fireflies',    name:'Fireflies.ai',      desc:'会議録音・文字起こし',              logo: SI+'/fireflyiii/ffffff',                             env:'FIREFLIES_API_KEY' },
    { key:'loom',         name:'Loom',              desc:'動画録画・共有',                    logo: SI+'/loom/ffffff',                                   env:'LOOM_API_KEY' },
    { key:'discordwebhook',name:'Discord Webhook',  desc:'Discordへのメッセージ送信',        logo: SI+'/discord/ffffff',                                env:'DISCORD_WEBHOOK_URL' },
  ]},
  { id: 'productivity', label: 'Productivity', emoji: '📋', jp: false, tools: [
    { key:'notion',       name:'Notion',            desc:'ノート・Wiki・DB',                  logo: SI+'/notion/ffffff',                                 env:'NOTION_API_KEY' },
    { key:'google',       name:'Google Workspace',  desc:'Gmail / Calendar / Drive',         logo: SI+'/google/ffffff',                                 env:'GOOGLE_CLIENT_ID' },
    { key:'airtable',     name:'Airtable',          desc:'スプレッドシートDB',                logo: SI+'/airtable/ffffff',                               env:'AIRTABLE_API_KEY' },
    { key:'coda',         name:'Coda',              desc:'ドキュメント・DB',                  logo: IC+'/simple-icons:coda.svg?color=ffffff',            env:'CODA_API_TOKEN' },
    { key:'confluence',   name:'Confluence',        desc:'ドキュメント管理',                  logo: SI+'/confluence/ffffff',                             env:'CONFLUENCE_API_TOKEN' },
    { key:'monday',       name:'Monday.com',        desc:'プロジェクト管理',                  logo: SI+'/mondaydotcom/ffffff',                           env:'MONDAY_API_KEY' },
    { key:'clickup',      name:'ClickUp',           desc:'タスク管理',                        logo: SI+'/clickup/ffffff',                                env:'CLICKUP_API_KEY' },
    { key:'asana',        name:'Asana',             desc:'タスク管理',                        logo: SI+'/asana/ffffff',                                  env:'ASANA_ACCESS_TOKEN' },
    { key:'trello',       name:'Trello',            desc:'かんばんボード',                    logo: SI+'/trello/ffffff',                                 env:'TRELLO_API_KEY' },
    { key:'jira',         name:'Jira',              desc:'課題管理',                          logo: SI+'/jira/ffffff',                                   env:'JIRA_API_TOKEN' },
    { key:'linear',       name:'Linear',            desc:'エンジニア向けタスク管理',          logo: SI+'/linear/ffffff',                                 env:'LINEAR_API_KEY' },
    { key:'miro',         name:'Miro',              desc:'オンラインホワイトボード',           logo: SI+'/miro/ffffff',                                   env:'MIRO_ACCESS_TOKEN' },
    { key:'typeform',     name:'Typeform',          desc:'フォーム作成',                      logo: SI+'/typeform/ffffff',                               env:'TYPEFORM_API_KEY' },
    { key:'surveymonkey', name:'SurveyMonkey',      desc:'アンケート',                        logo: SI+'/surveymonkey/ffffff',                           env:'SURVEYMONKEY_ACCESS_TOKEN' },
    { key:'dropbox',      name:'Dropbox',           desc:'クラウドストレージ',                logo: SI+'/dropbox/ffffff',                                env:'DROPBOX_ACCESS_TOKEN' },
    { key:'box',          name:'Box',               desc:'エンタープライズストレージ',        logo: SI+'/box/ffffff',                                    env:'BOX_CLIENT_ID' },
    { key:'onedrive',     name:'OneDrive',          desc:'クラウドストレージ',                logo: IC+'/simple-icons:microsoftonedrive.svg?color=ffffff', env:'ONEDRIVE_CLIENT_ID' },
    { key:'outlook',      name:'Outlook',           desc:'メール・カレンダー',                logo: IC+'/simple-icons:microsoftoutlook.svg?color=ffffff', env:'OUTLOOK_CLIENT_ID' },
    { key:'calendly',     name:'Calendly',          desc:'予約管理',                          logo: IC+'/simple-icons:calendly.svg?color=ffffff',        env:'CALENDLY_API_KEY' },
    { key:'retool',       name:'Retool',            desc:'内部ツール構築',                    logo: IC+'/simple-icons:retool.svg?color=ffffff',           env:'RETOOL_API_KEY' },
  ]},
  { id: 'development', label: 'Development', emoji: '⚙️', jp: false, tools: [
    { key:'github',       name:'GitHub',            desc:'コードリポジトリ',                  logo: SI+'/github/ffffff',                                 env:'GITHUB_TOKEN' },
    { key:'gitlab',       name:'GitLab',            desc:'DevOpsプラットフォーム',            logo: SI+'/gitlab/ffffff',                                 env:'GITLAB_ACCESS_TOKEN' },
    { key:'vercel',       name:'Vercel',            desc:'フロントエンドデプロイ',            logo: SI+'/vercel/ffffff',                                 env:'VERCEL_TOKEN' },
    { key:'heroku',       name:'Heroku',            desc:'アプリデプロイ',                    logo: SI+'/heroku/ffffff',                                 env:'HEROKU_API_KEY' },
    { key:'cloudflare',   name:'Cloudflare',        desc:'CDN・DNS・セキュリティ',            logo: SI+'/cloudflare/ffffff',                             env:'CLOUDFLARE_API_TOKEN' },
    { key:'awss3',        name:'AWS S3',            desc:'クラウドストレージ',                logo: IC+'/simple-icons:amazons3.svg?color=ffffff',        env:'AWS_ACCESS_KEY_ID' },
    { key:'circleci',     name:'CircleCI',          desc:'CI/CD',                             logo: SI+'/circleci/ffffff',                               env:'CIRCLECI_TOKEN' },
    { key:'launchdarkly', name:'LaunchDarkly',      desc:'フィーチャーフラグ',                logo: IC+'/simple-icons:launchdarkly.svg?color=ffffff',    env:'LAUNCHDARKLY_SDK_KEY' },
    { key:'sentry',       name:'Sentry',            desc:'エラー監視',                        logo: SI+'/sentry/ffffff',                                 env:'SENTRY_DSN' },
    { key:'datadog',      name:'Datadog',           desc:'インフラ監視',                      logo: SI+'/datadog/ffffff',                                env:'DATADOG_API_KEY' },
    { key:'pagerduty',    name:'PagerDuty',         desc:'インシデント管理',                  logo: SI+'/pagerduty/ffffff',                              env:'PAGERDUTY_API_KEY' },
    { key:'statuspage',   name:'Statuspage',        desc:'障害ページ管理',                    logo: IC+'/simple-icons:atlassian.svg?color=ffffff',       env:'STATUSPAGE_API_KEY' },
    { key:'webflow',      name:'Webflow',           desc:'ノーコードWeb制作',                 logo: SI+'/webflow/ffffff',                                env:'WEBFLOW_API_TOKEN' },
    { key:'cloudwatch',   name:'AWS CloudWatch',    desc:'ログ・モニタリング',                logo: IC+'/simple-icons:amazonaws.svg?color=ffffff',       env:'AWS_ACCESS_KEY_ID' },
  ]},
  { id: 'crm', label: 'CRM & Sales', emoji: '🤝', jp: false, tools: [
    { key:'hubspot',      name:'HubSpot',           desc:'CRM・マーケティング',               logo: SI+'/hubspot/ffffff',                                env:'HUBSPOT_ACCESS_TOKEN' },
    { key:'salesforce',   name:'Salesforce',        desc:'エンタープライズCRM',               logo: SI+'/salesforce/ffffff',                             env:'SALESFORCE_CLIENT_ID' },
    { key:'pipedrive',    name:'Pipedrive',         desc:'営業CRM',                           logo: SI+'/pipedrive/ffffff',                              env:'PIPEDRIVE_API_KEY' },
    { key:'intercom',     name:'Intercom',          desc:'カスタマーサポート',                logo: SI+'/intercom/ffffff',                               env:'INTERCOM_ACCESS_TOKEN' },
    { key:'freshdesk',    name:'Freshdesk',         desc:'ヘルプデスク',                      logo: SI+'/freshdesk/ffffff',                              env:'FRESHDESK_API_KEY' },
    { key:'zendesk',      name:'Zendesk',           desc:'カスタマーサポート',                logo: SI+'/zendesk/ffffff',                                env:'ZENDESK_API_TOKEN' },
    { key:'copper',       name:'Copper',            desc:'Google連携CRM',                     logo: IC+'/material-symbols:diamond.svg?color=ffffff',     env:'COPPER_API_KEY' },
    { key:'sansan',       name:'Sansan',            desc:'名刺管理（日本）',                  logo: IC+'/material-symbols:badge.svg?color=ffffff',       env:'SANSAN_API_KEY' },
  ]},
  { id: 'marketing', label: 'Marketing', emoji: '📢', jp: false, tools: [
    { key:'mailchimp',    name:'Mailchimp',         desc:'メールマーケティング',              logo: SI+'/mailchimp/ffffff',                              env:'MAILCHIMP_API_KEY' },
    { key:'sendgrid',     name:'SendGrid',          desc:'メール配信',                        logo: SI+'/sendgrid/ffffff',                               env:'SENDGRID_API_KEY' },
    { key:'brevo',        name:'Brevo',             desc:'メール・SMS・CRM',                  logo: IC+'/simple-icons:brevo.svg?color=ffffff',           env:'BREVO_API_KEY' },
    { key:'postmark',     name:'Postmark',          desc:'トランザクションメール',            logo: IC+'/simple-icons:postmark.svg?color=ffffff',        env:'POSTMARK_SERVER_TOKEN' },
    { key:'activecampaign',name:'ActiveCampaign',   desc:'マーケティングオートメーション',    logo: IC+'/material-symbols:campaign.svg?color=ffffff',    env:'ACTIVECAMPAIGN_API_KEY' },
    { key:'segment',      name:'Segment',           desc:'顧客データ基盤',                    logo: SI+'/segment/ffffff',                                env:'SEGMENT_WRITE_KEY' },
    { key:'mixpanel',     name:'Mixpanel',          desc:'プロダクトアナリティクス',          logo: SI+'/mixpanel/ffffff',                               env:'MIXPANEL_TOKEN' },
    { key:'amplitude',    name:'Amplitude',         desc:'プロダクトアナリティクス',          logo: SI+'/amplitude/ffffff',                              env:'AMPLITUDE_API_KEY' },
    { key:'googleanalytics',name:'Google Analytics',desc:'Webアナリティクス',                logo: SI+'/googleanalytics/ffffff',                        env:'GOOGLE_ANALYTICS_MEASUREMENT_ID' },
    { key:'metaads',      name:'Meta Ads',          desc:'Facebook/Instagram広告',           logo: SI+'/meta/ffffff',                                   env:'META_ADS_ACCESS_TOKEN' },
    { key:'tiktokads',    name:'TikTok Ads',        desc:'TikTok広告',                        logo: SI+'/tiktok/ffffff',                                 env:'TIKTOK_ADS_ACCESS_TOKEN' },
  ]},
  { id: 'ecommerce', label: 'E-Commerce & Billing', emoji: '🛒', jp: false, tools: [
    { key:'stripe',       name:'Stripe',            desc:'決済処理',                          logo: SI+'/stripe/ffffff',                                 env:'STRIPE_SECRET_KEY' },
    { key:'shopify',      name:'Shopify',           desc:'ECサイト構築・管理',               logo: SI+'/shopify/ffffff',                                env:'SHOPIFY_ACCESS_TOKEN' },
    { key:'square',       name:'Square',            desc:'POS・決済',                         logo: SI+'/square/ffffff',                                 env:'SQUARE_ACCESS_TOKEN' },
    { key:'paypay',       name:'PayPay',            desc:'QRコード決済（日本）',              logo: IC+'/material-symbols:payments.svg?color=ffffff',    env:'PAYPAY_API_KEY' },
    { key:'stores',       name:'STORES',            desc:'ネットショップ（日本）',            logo: IC+'/material-symbols:storefront.svg?color=ffffff',  env:'STORES_ACCESS_TOKEN' },
  ]},
  { id: 'design', label: 'Design & Media', emoji: '🎨', jp: false, tools: [
    { key:'figma',        name:'Figma',             desc:'UIデザイン',                        logo: SI+'/figma/ffffff',                                  env:'FIGMA_ACCESS_TOKEN' },
    { key:'canva',        name:'Canva',             desc:'グラフィックデザイン',              logo: SI+'/canva/ffffff',                                  env:'CANVA_CLIENT_ID' },
  ]},
  { id: 'automation', label: 'Automation', emoji: '⚡', jp: false, tools: [
    { key:'zapier',       name:'Zapier',            desc:'ワークフロー自動化',                logo: SI+'/zapier/ffffff',                                 env:'ZAPIER_API_KEY' },
    { key:'make',         name:'Make',              desc:'ワークフロー自動化',                logo: SI+'/make/ffffff',                                   env:'MAKE_API_KEY' },
    { key:'n8n',          name:'n8n',               desc:'セルフホスト自動化',                logo: SI+'/n8n/ffffff',                                    env:'N8N_API_KEY' },
  ]},
  { id: 'japan', label: '日本特化ツール', emoji: '🇯🇵', jp: true, tools: [
    { key:'backlog',      name:'Backlog',           desc:'プロジェクト管理',                  logo: IC+'/material-symbols:assignment.svg?color=ffffff',  env:'BACKLOG_API_KEY' },
    { key:'chatwork',     name:'Chatwork',          desc:'ビジネスチャット',                  logo: IC+'/material-symbols:chat.svg?color=ffffff',        env:'CHATWORK_API_KEY' },
    { key:'kintone',      name:'kintone',           desc:'業務アプリ（Cybozu）',              logo: IC+'/material-symbols:apps.svg?color=ffffff',        env:'KINTONE_API_TOKEN' },
    { key:'cybozu',       name:'Cybozu Garoon',     desc:'グループウェア',                    logo: IC+'/material-symbols:groups.svg?color=ffffff',      env:'CYBOZU_DOMAIN' },
    { key:'freee',        name:'Freee 会計',        desc:'クラウド会計',                      logo: IC+'/material-symbols:account-balance.svg?color=ffffff', env:'FREEE_CLIENT_ID' },
    { key:'freeehr',      name:'Freee HR',          desc:'給与・人事',                        logo: IC+'/material-symbols:person.svg?color=ffffff',      env:'FREEE_CLIENT_ID' },
    { key:'freeesign',    name:'Freee Sign',        desc:'電子署名',                          logo: IC+'/material-symbols:draw.svg?color=ffffff',        env:'FREEE_SIGN_API_KEY' },
    { key:'moneyforward', name:'Money Forward',     desc:'クラウド会計',                      logo: IC+'/material-symbols:currency-yen.svg?color=ffffff', env:'MONEYFORWARD_ACCESS_TOKEN' },
    { key:'mfpayroll',    name:'MF給与',            desc:'給与計算',                          logo: IC+'/material-symbols:payments.svg?color=ffffff',    env:'MONEYFORWARD_ACCESS_TOKEN' },
    { key:'yayoi',        name:'弥生会計',          desc:'会計ソフト',                        logo: IC+'/material-symbols:calculate.svg?color=ffffff',   env:'YAYOI_CLIENT_ID' },
    { key:'smarthr',      name:'SmartHR',           desc:'人事・労務',                        logo: IC+'/material-symbols:people.svg?color=ffffff',      env:'SMARTHR_ACCESS_TOKEN' },
    { key:'jobcan',       name:'Jobcan',            desc:'勤怠管理',                          logo: IC+'/material-symbols:schedule.svg?color=ffffff',    env:'JOBCAN_API_KEY' },
    { key:'talentio',     name:'Talentio',          desc:'採用管理',                          logo: IC+'/material-symbols:work.svg?color=ffffff',        env:'TALENTIO_API_KEY' },
    { key:'wantedly',     name:'Wantedly',          desc:'採用プラットフォーム',              logo: IC+'/material-symbols:star.svg?color=ffffff',        env:'WANTEDLY_CLIENT_ID' },
    { key:'rakumo',       name:'Rakumo',            desc:'Google Workspace連携',              logo: IC+'/material-symbols:cloud.svg?color=ffffff',       env:'RAKUMO_CLIENT_ID' },
    { key:'receptionist', name:'RECEPTIONIST',      desc:'受付システム',                      logo: IC+'/material-symbols:door-front.svg?color=ffffff',  env:'RECEPTIONIST_API_KEY' },
    { key:'gmoagree',     name:'GMO電子契約',       desc:'電子契約',                          logo: IC+'/material-symbols:description.svg?color=ffffff', env:'GMOAGREE_API_KEY' },
    { key:'cloudsign',    name:'CloudSign',         desc:'電子署名',                          logo: IC+'/material-symbols:verified.svg?color=ffffff',    env:'CLOUDSIGN_API_KEY' },
    { key:'docusign',     name:'DocuSign',          desc:'電子署名（グローバル）',            logo: SI+'/docusign/ffffff',                               env:'DOCUSIGN_ACCESS_TOKEN' },
    { key:'lineworks',    name:'LINE WORKS',        desc:'ビジネスチャット',                  logo: SI+'/line/ffffff',                                   env:'LINEWORKS_CLIENT_ID' },
    { key:'lstep',        name:'Lステップ',         desc:'LINE自動化（Webhook受信）',         logo: SI+'/line/ffffff',                                   env:'LSTEP_WEBHOOK_SECRET' },
    { key:'elme',         name:'エルメ',            desc:'LINE自動化（Webhook受信）',         logo: SI+'/line/ffffff',                                   env:'ELME_WEBHOOK_SECRET' },
    { key:'utage',        name:'Utage',             desc:'マーケティング一括管理',            logo: IC+'/material-symbols:rocket-launch.svg?color=ffffff', env:'UTAGE_WEBHOOK_SECRET' },
    { key:'lmessage',     name:'Lメッセージ',       desc:'LINE配信（Webhook受信）',           logo: SI+'/line/ffffff',                                   env:'LMESSAGE_WEBHOOK_SECRET' },
    { key:'sansan',       name:'Sansan',            desc:'名刺管理',                          logo: IC+'/material-symbols:badge.svg?color=ffffff',       env:'SANSAN_API_KEY' },
    { key:'kingofthyme',  name:'King of Time',      desc:'勤怠管理',                          logo: IC+'/material-symbols:timer.svg?color=ffffff',       env:'KING_OF_TIME_CLIENT_ID' },
  ]},
];

var STATUS = {};
var activeFilter = 'all';

function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  filterAll();
}

function filterAll() {
  var q = document.getElementById('search').value.toLowerCase();
  var anyVisible = false;
  CATS.forEach(function(cat) {
    var section = document.getElementById('sec-' + cat.id);
    if (!section) return;
    var cards = section.querySelectorAll('.card');
    var visCount = 0;
    cards.forEach(function(card) {
      var key = card.dataset.key;
      var nameText = card.dataset.name.toLowerCase();
      var descText = card.dataset.desc.toLowerCase();
      var matchSearch = !q || nameText.includes(q) || descText.includes(q) || key.includes(q);
      var connected = STATUS[key];
      var matchFilter = activeFilter === 'all'
        || (activeFilter === 'connected' && connected)
        || (activeFilter === 'pending' && !connected)
        || (activeFilter === 'japan' && cat.jp);
      if (matchSearch && matchFilter) {
        card.style.display = '';
        visCount++;
        anyVisible = true;
      } else {
        card.style.display = 'none';
      }
    });
    var secEl = document.getElementById('section-' + cat.id);
    if (secEl) secEl.style.display = visCount > 0 ? '' : 'none';
    var countEl = document.getElementById('count-' + cat.id);
    if (countEl) countEl.textContent = visCount;
  });
  document.getElementById('no-results').classList.toggle('show', !anyVisible);
}

function renderSections(status) {
  STATUS = status;
  var root = document.getElementById('sections-root');
  var html = '';
  var totalConnected = 0;
  var totalAll = 0;

  CATS.forEach(function(cat) {
    var connCount = cat.tools.filter(function(t) { return status[t.key]; }).length;
    var totalCount = cat.tools.length;
    totalConnected += connCount;
    totalAll += totalCount;

    html += '<div class="section" id="section-' + cat.id + '">';
    html += '<div class="section-head">';
    html += '<span style="font-size:1rem">' + cat.emoji + '</span>';
    html += '<span class="section-label">' + cat.label + '</span>';
    html += '<span class="section-count" id="count-' + cat.id + '">' + totalCount + '</span>';
    if (cat.jp) html += '<span class="section-jp-badge">🇯🇵 Japan</span>';
    html += '</div><div class="grid" id="sec-' + cat.id + '">';

    cat.tools.forEach(function(tool) {
      var ok = status[tool.key];
      html += '<div class="card' + (ok ? ' connected' : '') + '" data-key="' + tool.key + '" data-name="' + tool.name + '" data-desc="' + tool.desc + '">';
      html += '<div class="card-logo"><img src="' + tool.logo + '" alt="' + tool.name + '" onerror="this.style.display=&quot;none&quot;" /></div>';
      html += '<div class="card-body">';
      html += '<div class="card-name">' + tool.name + '</div>';
      html += '<div class="card-desc">' + tool.desc + '</div>';
      html += '<span class="badge ' + (ok ? 'badge-ok' : 'badge-ng') + '">' + (ok ? '接続済み' : '未設定') + '</span>';
      html += '<div class="card-env">' + tool.env + '</div>';
      html += '</div></div>';
    });

    html += '</div></div>';
  });

  root.innerHTML = html;

  // Update stats
  document.getElementById('stat-total').textContent = totalAll;
  document.getElementById('stat-connected').textContent = totalConnected;
  document.getElementById('stat-pending').textContent = totalAll - totalConnected;
}

async function bootstrap() {
  try {
    var res = await fetch('/api/integrations/status');
    var status = await res.json();
    renderSections(status);
  } catch(e) {
    document.getElementById('sections-root').innerHTML = '<p style="color:var(--muted);padding:40px">読み込みに失敗しました。</p>';
  }
}

bootstrap();
</script>
</body>
</html>`;
}

function getGuildsDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aude — Servers</title>
    <style>
      :root {
        --bg: #0f1117; --panel: #16181f; --panel-strong: #1e2029;
        --border: rgba(255,255,255,0.08); --text: #e8eaf0; --muted: #8b8fa8;
        --accent: #7c6dfa;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; min-height: 100vh; }
      .shell { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
      h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 4px; }
      .nav { display: flex; gap: 16px; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
      .nav a { color: var(--muted); text-decoration: none; font-size: 0.9rem; }
      .nav a:hover { color: var(--text); }
      .nav a.active { color: var(--accent); font-weight: 600; }
      .subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 32px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
      th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; }
      tr:hover td { background: var(--panel); }
      .tag {
        display: inline-block; padding: 2px 8px; border-radius: 999px;
        font-size: 0.75rem; font-weight: 600;
        background: rgba(124,109,250,0.15); color: var(--accent);
      }
      .empty { padding: 40px; text-align: center; color: var(--muted); }
      .loading { padding: 40px; text-align: center; color: var(--muted); }
      .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
    </style>
  </head>
  <body>
    <div class="shell">
      <h1>Aude AI</h1>
      <nav class="nav">
        <a href="/">Users</a>
        <a href="/guilds" class="active">Servers</a>
        <a href="/integrations">Integrations</a>
      </nav>
      <p class="subtitle">Aude が参加しているサーバーとその設定です。</p>
      <div class="panel">
        <div id="content"><div class="loading">Loading...</div></div>
      </div>
    </div>
    <script>
      const formatDate = v => v ? new Date(v).toLocaleString('ja-JP') : '-';

      async function bootstrap() {
        const res = await fetch('/api/guilds');
        const guilds = await res.json();
        const el = document.getElementById('content');
        if (!guilds.length) {
          el.innerHTML = '<div class="empty">まだサーバーデータがありません。<br>Aude を Discord サーバーに招待して /config view を実行すると記録されます。</div>';
          return;
        }
        el.innerHTML = \`<table>
          <thead><tr>
            <th>Server</th><th>ID</th><th>Default Model</th>
            <th>Prefix</th><th>Max Credits</th><th>Updated</th>
          </tr></thead>
          <tbody>
            \${guilds.map(g => \`<tr>
              <td>\${g.guild_name || '-'}</td>
              <td style="color:var(--muted);font-size:0.8rem">\${g.guild_id}</td>
              <td><span class="tag">\${g.default_model}</span></td>
              <td><code>\${g.prefix}</code></td>
              <td>\${g.max_credits_per_user}</td>
              <td>\${formatDate(g.updated_at)}</td>
            </tr>\`).join('')}
          </tbody>
        </table>\`;
      }
      bootstrap().catch(console.error);
    </script>
  </body>
</html>`;
}


function getAnalyticsDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aude — Analytics</title>
    <style>
      :root {
        --bg: #0f1117; --panel: #16181f; --border: rgba(255,255,255,0.08);
        --text: #e8eaf0; --muted: #8b8fa8; --accent: #7c6dfa;
        --green: #22c55e; --red: #ef4444; --yellow: #f59e0b;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; min-height: 100vh; }
      .shell { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
      h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 4px; }
      .nav { display: flex; gap: 16px; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
      .nav a { color: var(--muted); text-decoration: none; font-size: 0.9rem; }
      .nav a:hover { color: var(--text); }
      .nav a.active { color: var(--accent); font-weight: 600; }
      .period-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
      .period-btn {
        padding: 6px 16px; border-radius: 999px; border: 1px solid var(--border);
        background: transparent; color: var(--muted); cursor: pointer; font-size: 0.85rem;
      }
      .period-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
      .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
      .stat-label { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
      .stat-value { font-size: 2rem; font-weight: 700; }
      .stat-sub { font-size: 0.8rem; color: var(--muted); margin-top: 4px; }
      .growth-pos { color: var(--green); }
      .growth-neg { color: var(--red); }
      .section { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
      .section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
      th { color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
      .bar-wrap { background: rgba(255,255,255,0.05); border-radius: 4px; height: 8px; overflow: hidden; }
      .bar { height: 8px; border-radius: 4px; background: var(--accent); }
      .loading { color: var(--muted); padding: 32px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="shell">
      <h1>Aude AI</h1>
      <nav class="nav">
        <a href="/">Users</a>
        <a href="/guilds">Servers</a>
        <a href="/integrations">Integrations</a>
        <a href="/analytics" class="active">Analytics</a>
      </nav>

      <div class="period-tabs">
        <button class="period-btn active" onclick="loadData(7)">7日</button>
        <button class="period-btn" onclick="loadData(30)">30日</button>
        <button class="period-btn" onclick="loadData(90)">90日</button>
      </div>

      <div id="stats-grid" class="stats-grid"><div class="loading">Loading...</div></div>

      <div class="section">
        <h2>📈 日別メッセージ数</h2>
        <div id="daily-table"><div class="loading">Loading...</div></div>
      </div>

      <div class="section">
        <h2>🤖 モデル使用状況</h2>
        <div id="model-table"><div class="loading">Loading...</div></div>
      </div>

      <div class="section">
        <h2>🏆 アクティブユーザー</h2>
        <div id="users-table"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <script>
      const fmt = (n) => Number(n).toLocaleString('ja-JP');

      function setActivePeriod(days) {
        document.querySelectorAll('.period-btn').forEach(btn => {
          btn.classList.toggle('active', btn.textContent.replace('日','') == String(days));
        });
      }

      async function loadData(days) {
        setActivePeriod(days);
        const res = await fetch('/api/analytics?days=' + days);
        const d = await res.json();
        renderSummary(d.summary);
        renderDaily(d.daily);
        renderModels(d.modelUsage);
        renderUsers(d.topUsers);
      }

      function renderSummary(s) {
        const g = s.growth_rate;
        const gc = g >= 0 ? 'growth-pos' : 'growth-neg';
        const gs = (g >= 0 ? '+' : '') + g + '%';
        document.getElementById('stats-grid').innerHTML = \`
          <div class="stat-card"><div class="stat-label">総メッセージ</div><div class="stat-value">\${fmt(s.total_messages)}</div><div class="stat-sub">1日平均 \${fmt(s.avg_messages_per_day)}</div></div>
          <div class="stat-card"><div class="stat-label">ユニークユーザー</div><div class="stat-value">\${fmt(s.total_unique_users)}</div><div class="stat-sub">成長率 <span class="\${gc}">\${gs}</span></div></div>
          <div class="stat-card"><div class="stat-label">消費クレジット</div><div class="stat-value">\${fmt(s.total_credits_consumed)}</div><div class="stat-sub">ユーザー平均 \${fmt(s.avg_messages_per_user)} msgs</div></div>
          <div class="stat-card"><div class="stat-label">最もアクティブな日</div><div class="stat-value" style="font-size:1.2rem">\${s.most_active_day ?? '-'}</div><div class="stat-sub">集計期間 \${s.period_days}日</div></div>
        \`;
      }

      function renderDaily(daily) {
        if (!daily.length) { document.getElementById('daily-table').innerHTML = '<div class="loading">データなし</div>'; return; }
        const max = Math.max(...daily.map(d => d.messages));
        document.getElementById('daily-table').innerHTML = '<table><thead><tr><th>日付</th><th>メッセージ</th><th>ユーザー</th><th>クレジット消費</th><th>割合</th></tr></thead><tbody>'
          + daily.map(d => \`<tr>
              <td>\${d.date}</td>
              <td>\${fmt(d.messages)}</td>
              <td>\${fmt(d.unique_users)}</td>
              <td>\${fmt(d.credits_consumed)}</td>
              <td><div class="bar-wrap"><div class="bar" style="width:\${max > 0 ? Math.round(d.messages/max*100) : 0}%"></div></div></td>
            </tr>\`).join('') + '</tbody></table>';
      }

      function renderModels(models) {
        document.getElementById('model-table').innerHTML = '<table><thead><tr><th>モデル</th><th>消費クレジット</th><th>シェア</th></tr></thead><tbody>'
          + models.map(m => \`<tr>
              <td>\${m.model}</td>
              <td>\${fmt(m.total_credits)}</td>
              <td><div class="bar-wrap"><div class="bar" style="width:\${m.percentage}%"></div></div> \${m.percentage}%</td>
            </tr>\`).join('') + '</tbody></table>';
      }

      function renderUsers(users) {
        if (!users.length) { document.getElementById('users-table').innerHTML = '<div class="loading">データなし</div>'; return; }
        document.getElementById('users-table').innerHTML = '<table><thead><tr><th>順位</th><th>ユーザー</th><th>メッセージ</th><th>クレジット消費</th><th>プラン</th></tr></thead><tbody>'
          + users.map((u, i) => \`<tr>
              <td>\${i+1}</td>
              <td>\${u.username}</td>
              <td>\${fmt(u.message_count)}</td>
              <td>\${fmt(u.credits_consumed)}</td>
              <td>\${u.subscription_plan ?? 'free'}</td>
            </tr>\`).join('') + '</tbody></table>';
      }

      loadData(7);
    </script>
  </body>
</html>`;
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
      sendHtml(res, 200, getLandingPageHtml());
      return;
    }

    if (method === 'GET' && url.pathname === '/admin') {
      sendHtml(res, 200, getDashboardHtml());
      return;
    }

    if (method === 'GET' && url.pathname === '/dashboard') {
      const auth = getSession(req);
      if (!auth) {
        redirect(res, '/auth/discord');
        return;
      }

      sendHtml(res, 200, getUserDashboardHtml(auth.session));
      return;
    }

    if (method === 'GET' && url.pathname === '/terms') {
      sendHtml(
        res,
        200,
        getSimpleInfoPageHtml(
          '利用規約',
          'Aude AI の提供条件、禁止事項、料金条件は正式版の公開に合わせて更新されます。現時点では Discord サーバー運用者が導入責任を持つ前提です。'
        )
      );
      return;
    }

    if (method === 'GET' && url.pathname === '/privacy') {
      sendHtml(
        res,
        200,
        getSimpleInfoPageHtml(
          'プライバシーポリシー',
          'Aude AI は認証とサービス提供に必要な Discord アカウント情報およびサーバー情報を利用します。保存対象と保持期間は今後の正式ポリシーで明文化されます。'
        )
      );
      return;
    }

    if (method === 'GET' && url.pathname === '/auth/discord') {
      const clientId = process.env.DISCORD_CLIENT_ID?.trim();
      if (!clientId || !hasDiscordOauthConfig()) {
        sendHtml(res, 500, getOauthSetupHtml('DISCORD_CLIENT_ID または DISCORD_CLIENT_SECRET が設定されていません。'));
        return;
      }

      const redirectUri = encodeURIComponent(getDiscordRedirectUri());
      redirect(
        res,
        `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`
      );
      return;
    }

    if (method === 'GET' && url.pathname === '/auth/discord/callback') {
      if (!hasDiscordOauthConfig()) {
        sendHtml(res, 500, getOauthSetupHtml('DISCORD_CLIENT_SECRET が未設定のため OAuth コールバックを完了できません。'));
        return;
      }

      const code = url.searchParams.get('code');
      if (!code) {
        sendHtml(res, 400, getOauthSetupHtml('Discord から認可コードが返されませんでした。'));
        return;
      }

      try {
        const tokenResponse = await exchangeDiscordCode(code);
        const user = await fetchDiscordResource<DiscordUser>('/users/@me', tokenResponse.access_token);
        const guilds = await fetchDiscordResource<DiscordGuild[]>('/users/@me/guilds', tokenResponse.access_token);
        const sessionId = crypto.randomUUID();

        discordSessions.set(sessionId, {
          user,
          guilds,
          token: tokenResponse.access_token,
          expiresAt: Date.now() + 86_400_000,
        });

        setSessionCookie(res, sessionId);
        redirect(res, '/dashboard');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown OAuth error';
        sendHtml(res, 500, getOauthSetupHtml(message));
      }
      return;
    }

    if (method === 'GET' && url.pathname === '/auth/logout') {
      const auth = getSession(req);
      clearSession(res, auth?.sessionId);
      redirect(res, '/');
      return;
    }

    // Google OAuth2 callback — exchange code for refresh token
    if (method === 'GET' && url.pathname === '/auth/google/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        sendHtml(res, 400, '<h1>Error: no code parameter</h1>');
        return;
      }
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
        const redirectUri = 'http://localhost:3001/auth/google/callback';
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
        });
        const tokenData = await tokenRes.json() as { refresh_token?: string; access_token?: string; error?: string };
        if (tokenData.error || !tokenData.refresh_token) {
          sendHtml(res, 400, `<h1>Error</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
          return;
        }
        // Save refresh token to .env file (append/update)
        const envPath = require('path').join(process.cwd(), '.env');
        let envContent = require('fs').readFileSync(envPath, 'utf8');
        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${tokenData.refresh_token}`);
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${tokenData.refresh_token}\n`;
        }
        require('fs').writeFileSync(envPath, envContent);
        process.env.GOOGLE_REFRESH_TOKEN = tokenData.refresh_token;
        sendHtml(res, 200, `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{background:#0f1117;color:#e8eaf0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head><body><div style="text-align:center"><div style="font-size:3rem">✅</div><h1>Google Workspace 連携完了！</h1><p style="color:#8b8fa8">Refresh Tokenを保存しました。<br>このタブを閉じてください。</p></div></body></html>`);
      } catch (e: any) {
        sendHtml(res, 500, `<h1>Error</h1><pre>${e.message}</pre>`);
      }
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

    if (method === 'GET' && url.pathname === '/api/me') {
      const auth = getSession(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Not authenticated' });
        return;
      }

      const guildPresence = getGuildPresenceMap();
      const guilds = auth.session.guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.owner,
        permissions: guild.permissions,
        canManage: canManageGuild(guild),
        hasAude: guildPresence.has(guild.id),
      }));

      sendJson(res, 200, {
        user: {
          id: auth.session.user.id,
          username: auth.session.user.username,
          avatar: auth.session.user.avatar,
          discriminator: auth.session.user.discriminator,
        },
        guilds,
      });
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

    if (method === 'GET' && url.pathname === '/api/guilds') {
      try {
        const guilds = GuildRepository.listAll();
        sendJson(res, 200, guilds);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (method === 'GET' && url.pathname === '/api/integrations/status') {
      try {
        const e = process.env;
        const status: Record<string, boolean> = {
          // AI Models
          openai:           Boolean(e.OPENAI_API_KEY?.trim()),
          anthropic:        Boolean(e.ANTHROPIC_API_KEY?.trim()),
          gemini:           Boolean(e.GEMINI_API_KEY?.trim()),
          fal:              Boolean(e.FAL_KEY?.trim()),
          // Communication
          slack:            Boolean(e.SLACK_BOT_TOKEN?.trim()),
          teams:            Boolean(e.TEAMS_WEBHOOK_URL?.trim()),
          zoom:             Boolean(e.ZOOM_CLIENT_ID?.trim()),
          line:             Boolean(e.LINE_CHANNEL_ACCESS_TOKEN?.trim()),
          twilio:           Boolean(e.TWILIO_ACCOUNT_SID?.trim()),
          vonage:           Boolean(e.VONAGE_API_KEY?.trim()),
          fireflies:        Boolean(e.FIREFLIES_API_KEY?.trim()),
          lineworks:        Boolean(e.LINEWORKS_CLIENT_ID?.trim()),
          loom:             Boolean(e.LOOM_API_KEY?.trim()),
          // Productivity
          notion:           Boolean(e.NOTION_API_KEY?.trim()),
          google:           Boolean(e.GOOGLE_CLIENT_ID?.trim()),
          airtable:         Boolean(e.AIRTABLE_API_KEY?.trim()),
          coda:             Boolean(e.CODA_API_TOKEN?.trim()),
          confluence:       Boolean(e.CONFLUENCE_API_TOKEN?.trim()),
          monday:           Boolean(e.MONDAY_API_KEY?.trim()),
          clickup:          Boolean(e.CLICKUP_API_KEY?.trim()),
          asana:            Boolean(e.ASANA_ACCESS_TOKEN?.trim()),
          trello:           Boolean(e.TRELLO_API_KEY?.trim()),
          jira:             Boolean(e.JIRA_API_TOKEN?.trim()),
          linear:           Boolean(e.LINEAR_API_KEY?.trim()),
          surveymonkey:     Boolean(e.SURVEYMONKEY_ACCESS_TOKEN?.trim()),
          typeform:         Boolean(e.TYPEFORM_API_KEY?.trim()),
          miro:             Boolean(e.MIRO_ACCESS_TOKEN?.trim()),
          dropbox:          Boolean(e.DROPBOX_ACCESS_TOKEN?.trim()),
          onedrive:         Boolean(e.ONEDRIVE_CLIENT_ID?.trim()),
          box:              Boolean(e.BOX_CLIENT_ID?.trim()),
          outlook:          Boolean(e.OUTLOOK_CLIENT_ID?.trim()),
          calendly:         Boolean(e.CALENDLY_API_KEY?.trim()),
          retool:           Boolean(e.RETOOL_API_KEY?.trim()),
          // Development
          github:           Boolean(e.GITHUB_TOKEN?.trim()),
          gitlab:           Boolean(e.GITLAB_ACCESS_TOKEN?.trim()),
          vercel:           Boolean(e.VERCEL_TOKEN?.trim()),
          heroku:           Boolean(e.HEROKU_API_KEY?.trim()),
          cloudflare:       Boolean(e.CLOUDFLARE_API_TOKEN?.trim()),
          awss3:            Boolean(e.AWS_ACCESS_KEY_ID?.trim()),
          cloudwatch:       Boolean(e.AWS_ACCESS_KEY_ID?.trim()),
          circleci:         Boolean(e.CIRCLECI_TOKEN?.trim()),
          githubactions:    Boolean(e.GITHUB_TOKEN?.trim()),
          launchdarkly:     Boolean(e.LAUNCHDARKLY_SDK_KEY?.trim()),
          sentry:           Boolean(e.SENTRY_DSN?.trim()),
          datadog:          Boolean(e.DATADOG_API_KEY?.trim()),
          pagerduty:        Boolean(e.PAGERDUTY_API_KEY?.trim()),
          statuspage:       Boolean(e.STATUSPAGE_API_KEY?.trim()),
          // CRM & Sales
          hubspot:          Boolean(e.HUBSPOT_ACCESS_TOKEN?.trim()),
          salesforce:       Boolean(e.SALESFORCE_CLIENT_ID?.trim()),
          pipedrive:        Boolean(e.PIPEDRIVE_API_KEY?.trim()),
          copper:           Boolean(e.COPPER_API_KEY?.trim()),
          intercom:         Boolean(e.INTERCOM_ACCESS_TOKEN?.trim()),
          freshdesk:        Boolean(e.FRESHDESK_API_KEY?.trim()),
          zendesk:          Boolean(e.ZENDESK_API_TOKEN?.trim()),
          sansan:           Boolean(e.SANSAN_API_KEY?.trim()),
          // Marketing
          mailchimp:        Boolean(e.MAILCHIMP_API_KEY?.trim()),
          sendgrid:         Boolean(e.SENDGRID_API_KEY?.trim()),
          postmark:         Boolean(e.POSTMARK_SERVER_TOKEN?.trim()),
          brevo:            Boolean(e.BREVO_API_KEY?.trim()),
          activecampaign:   Boolean(e.ACTIVECAMPAIGN_API_KEY?.trim()),
          segment:          Boolean(e.SEGMENT_WRITE_KEY?.trim()),
          mixpanel:         Boolean(e.MIXPANEL_TOKEN?.trim()),
          amplitude:        Boolean(e.AMPLITUDE_API_KEY?.trim()),
          googleanalytics:  Boolean(e.GOOGLE_ANALYTICS_MEASUREMENT_ID?.trim()),
          metaads:          Boolean(e.META_ADS_ACCESS_TOKEN?.trim()),
          tiktokads:        Boolean(e.TIKTOK_ADS_ACCESS_TOKEN?.trim()),
          // E-Commerce
          stripe:           Boolean(e.STRIPE_SECRET_KEY?.trim()),
          shopify:          Boolean(e.SHOPIFY_ACCESS_TOKEN?.trim()),
          square:           Boolean(e.SQUARE_ACCESS_TOKEN?.trim()),
          paypay:           Boolean(e.PAYPAY_API_KEY?.trim()),
          stores:           Boolean(e.STORES_ACCESS_TOKEN?.trim()),
          // Design & Media
          figma:            Boolean(e.FIGMA_ACCESS_TOKEN?.trim()),
          canva:            Boolean(e.CANVA_CLIENT_ID?.trim()),
          webflow:          Boolean(e.WEBFLOW_API_TOKEN?.trim()),
          figmafiles:       Boolean(e.FIGMA_ACCESS_TOKEN?.trim()),
          // Automation
          zapier:           Boolean(e.ZAPIER_API_KEY?.trim()),
          make:             Boolean(e.MAKE_API_KEY?.trim()),
          n8n:              Boolean(e.N8N_API_KEY?.trim()),
          // Japan Tools
          backlog:          Boolean(e.BACKLOG_API_KEY?.trim()),
          chatwork:         Boolean(e.CHATWORK_API_KEY?.trim()),
          kintone:          Boolean(e.KINTONE_API_TOKEN?.trim()),
          cybozu:           Boolean(e.CYBOZU_DOMAIN?.trim()),
          freee:            Boolean(e.FREEE_CLIENT_ID?.trim()),
          freeehr:          Boolean(e.FREEE_CLIENT_ID?.trim()),
          freeesign:        Boolean(e.FREEE_SIGN_API_KEY?.trim()),
          moneyforward:     Boolean(e.MONEYFORWARD_ACCESS_TOKEN?.trim()),
          mfpayroll:        Boolean(e.MONEYFORWARD_ACCESS_TOKEN?.trim()),
          yayoi:            Boolean(e.YAYOI_CLIENT_ID?.trim()),
          smarthr:          Boolean(e.SMARTHR_ACCESS_TOKEN?.trim()),
          jobcan:           Boolean(e.JOBCAN_API_KEY?.trim()),
          talentio:         Boolean(e.TALENTIO_API_KEY?.trim()),
          wantedly:         Boolean(e.WANTEDLY_CLIENT_ID?.trim()),
          rakumo:           Boolean(e.RAKUMO_CLIENT_ID?.trim()),
          receptionist:     Boolean(e.RECEPTIONIST_API_KEY?.trim()),
          gmoagree:         Boolean(e.GMOAGREE_API_KEY?.trim()),
          cloudsign:        Boolean(e.CLOUDSIGN_API_KEY?.trim()),
          docusign:         Boolean(e.DOCUSIGN_ACCESS_TOKEN?.trim()),
          lstep:            Boolean(e.LSTEP_WEBHOOK_SECRET?.trim()),
          elme:             Boolean(e.ELME_WEBHOOK_SECRET?.trim()),
          utage:            Boolean(e.UTAGE_WEBHOOK_SECRET?.trim()),
          lmessage:         Boolean(e.LMESSAGE_WEBHOOK_SECRET?.trim()),
          // Other
          asanatasks:       Boolean(e.ASANA_ACCESS_TOKEN?.trim()),
          hubspotcrm:       Boolean(e.HUBSPOT_ACCESS_TOKEN?.trim()),
          discordwebhook:   Boolean(e.DISCORD_WEBHOOK_URL?.trim()),
          drive:            Boolean(e.GOOGLE_CLIENT_ID?.trim()),
          sheets:           Boolean(e.GOOGLE_CLIENT_ID?.trim()),
          gmail:            Boolean(e.GOOGLE_CLIENT_ID?.trim()),
          kingofthyme:      Boolean(e.KING_OF_TIME_CLIENT_ID?.trim()),
          openaiapi:        Boolean(e.OPENAI_API_KEY?.trim()),
          anthropicapi:     Boolean(e.ANTHROPIC_API_KEY?.trim()),
        };
        sendJson(res, 200, status);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (method === 'GET' && url.pathname === '/integrations') {
      sendHtml(res, 200, getIntegrationsDashboardHtml());
      return;
    }

    if (method === 'GET' && url.pathname === '/guilds') {
      sendHtml(res, 200, getGuildsDashboardHtml());
      return;
    }

    if (method === 'GET' && url.pathname === '/analytics') {
      sendHtml(res, 200, getAnalyticsDashboardHtml());
      return;
    }

    if (method === 'GET' && url.pathname === '/api/analytics') {
      try {
        const days = Number(url.searchParams.get('days') ?? '30');
        const summary = getAnalyticsSummary(days);
        const daily = getDailyStats(Math.min(days, 30));
        const topUsers = getTopUsers(days, 10);
        const modelUsage = getModelUsageStats(days);
        sendJson(res, 200, { summary, daily, topUsers, modelUsage });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    // Lステップ Webhook受信
    if (method === 'POST' && url.pathname === '/webhook/lstep') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as unknown;
          const event = parseLstepWebhook(parsed);
          const client = getDiscordClient();
          // guild単位でlstep_discord_channel_idを取得（システム全体共通キーで保存）
          const channelId = process.env.LSTEP_DISCORD_CHANNEL_ID;
          if (client && channelId) {
            await forwardToDiscord(client, channelId, event);
          }
        } catch (err) {
          console.error('[Lstep Webhook] error:', err);
        }
        sendJson(res, 200, { ok: true });
      });
      return;
    }

    // エルメ Webhook受信
    if (method === 'POST' && url.pathname === '/webhook/elme') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as unknown;
          const event = parseElmeWebhook(parsed);
          const client = getDiscordClient();
          const channelId = process.env.ELME_DISCORD_CHANNEL_ID;
          if (client && channelId) {
            await forwardElmeToDiscord(client, channelId, event);
          }
        } catch (err) {
          console.error('[Elme Webhook] error:', err);
        }
        sendJson(res, 200, { ok: true });
      });
      return;
    }

    // Utage Webhook受信
    if (method === 'POST' && url.pathname === '/webhook/utage') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as unknown;
          const event = parseUtageWebhook(parsed);
          const client = getDiscordClient();
          const channelId = process.env.UTAGE_DISCORD_CHANNEL_ID;
          if (client && channelId) {
            await forwardUtageToDiscord(client, channelId, event);
          }
        } catch (err) {
          console.error('[Utage Webhook] error:', err);
        }
        sendJson(res, 200, { ok: true });
      });
      return;
    }

    // Lメッセージ Webhook受信
    if (method === 'POST' && url.pathname === '/webhook/lmessage') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as unknown;
          const event = parseLmessageWebhook(parsed);
          const client = getDiscordClient();
          const channelId = process.env.LMESSAGE_DISCORD_CHANNEL_ID;
          if (client && channelId) {
            await forwardLmessageToDiscord(client, channelId, event);
          }
        } catch (err) {
          console.error('[Lmessage Webhook] error:', err);
        }
        sendJson(res, 200, { ok: true });
      });
      return;
    }

    // LINE Messaging API Webhook受信
    if (method === 'POST' && url.pathname === '/webhook/line') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          // LINE署名検証（X-Line-Signatureヘッダー）
          // 本番ではHMAC-SHA256検証推奨。今は簡易実装でスキップ
          const parsed = JSON.parse(body) as LineWebhookBody;
          await handleLineWebhook(parsed);
        } catch (err) {
          console.error('[LINE Webhook] error:', err);
        }
        // LINEは常に200を返す必要がある
        sendJson(res, 200, { ok: true });
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  server.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });

  return server;
}
