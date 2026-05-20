// src/services/websiteBuilder.ts — AI Website Builder + Netlify Deploy
import Anthropic from '@anthropic-ai/sdk';

export type PageType = 'video-bg' | 'animation' | 'gradient' | 'saas' | 'minimal';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(
  businessName: string,
  description: string,
  pageType: PageType,
  primaryColor: string,
  videoUrl?: string
): string {
  const common = `
ビジネス名: ${businessName}
説明: ${description}
アクセントカラー: ${primaryColor}
要件:
- 完全なHTML1ファイル（DOCTYPE〜/html）
- レスポンシブ（meta viewport必須）
- Google Fonts: Noto Sans JP を使用
- フッターに「Powered by Aude AI」を追加
- 完全なHTMLコードのみ返してください。マークダウンや説明文は一切不要です。
  `.trim();

  switch (pageType) {
    case 'video-bg':
      return `以下の仕様で最高品質のランディングページHTMLを生成してください。

${common}
デザイン: 動画背景LP
- video要素（autoplay loop muted playsinline）でフルスクリーン背景動画
- 動画URL: ${videoUrl ?? ''}
- 動画の上にdark overlay（rgba(0,0,0,0.55)）
- GSAPアニメーション（CDN: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js）
- セクション: Hero（フルスクリーン動画） / Features（3つ） / CTA
- 品質: Netflix/Apple風の映画的なデザイン`;

    case 'animation':
      return `以下の仕様で最高品質のランディングページHTMLを生成してください。

${common}
デザイン: アニメーションLP
- particles.js でインタラクティブなパーティクル背景（CDN: https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js）
- GSAPのScrollTriggerでスクロールアニメーション
- セクション: Hero / Features（3つ） / Pricing（3プラン） / CTA
- 品質: Linear.app / Stripe.com のような世界クラスのデザイン
- ダークテーマ推奨`;

    case 'gradient':
      return `以下の仕様で最高品質のランディングページHTMLを生成してください。

${common}
デザイン: グラデーションLP
- CSS @keyframesで動くアニメーショングラデーション背景
- glassmorphismカードデザイン（backdrop-filter: blur）
- Pure CSS/JSのみ（外部JSライブラリ不要）
- セクション: Hero / Features / Testimonials / CTA
- 品質: Figma/Notion風のモダンデザイン`;

    case 'saas':
      return `以下の仕様で最高品質のランディングページHTMLを生成してください。

${common}
デザイン: SaaS LP（プレミアムダーク）
- Linear.app/Vercel風のプレミアムダークデザイン
- グリッドレイアウト
- ホバーアニメーション付きフィーチャーカード
- 料金表セクション（Free/Starter/Pro）
- セクション: Hero / Features / Pricing / FAQ / CTA
- 品質: Y Combinator採択スタートアップのLPレベル`;

    case 'minimal':
    default:
      return `以下の仕様で最高品質のランディングページHTMLを生成してください。

${common}
デザイン: ミニマルLP
- 白背景、タイポグラフィ中心
- Apple.com風のシンプルで洗練されたデザイン
- フェードインアニメーション（Intersection Observer）
- セクション: Hero / Features（3つ） / CTA
- 品質: Apple.com レベルの洗練されたデザイン`;
  }
}

export async function generateWebsiteHTML(
  businessName: string,
  description: string,
  pageType: PageType,
  primaryColor = '#6C63FF',
  videoUrl?: string
): Promise<string> {
  const prompt = buildPrompt(businessName, description, pageType, primaryColor, videoUrl);

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    system: 'あなたは世界最高レベルのランディングページを生成するフロントエンドエキスパートです。完全なHTMLコードのみを返し、説明文やマークダウンは一切含めないでください。',
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
  // ```html ... ``` を除去
  return raw
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

export async function deployToNetlify(
  html: string,
  siteName: string
): Promise<{ url: string; siteId: string }> {
  const token = process.env.NETLIFY_TOKEN;
  if (!token) throw new Error('NETLIFY_TOKEN が設定されていません。');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('index.html', html);
  const zipBuffer: Buffer = await zip.generateAsync({ type: 'nodebuffer' });

  // サイト名をURLセーフに変換
  const safeName = siteName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  const uniqueName = `${safeName}-${Date.now()}`;

  // サイト作成
  const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: uniqueName }),
  });
  if (!siteRes.ok) {
    const err = await siteRes.text();
    throw new Error(`Netlifyサイト作成失敗: ${err}`);
  }
  const site = await siteRes.json() as { id: string; subdomain: string };

  // ZIPデプロイ
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
    },
    body: zipBuffer,
  });
  if (!deployRes.ok) {
    const err = await deployRes.text();
    throw new Error(`Netlifyデプロイ失敗: ${err}`);
  }

  return {
    url: `https://${site.subdomain}.netlify.app`,
    siteId: site.id,
  };
}
