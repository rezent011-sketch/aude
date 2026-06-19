=== Week66-B3: テストファイル作成（後半37ツール） ===

src/integrations/ ディレクトリの後半37ファイルに対してJestテストを作成してください。

## 対象ファイル（アルファベット順後半）
pagerduty, paypay, pipedrive, postmark, rakumo, receptionist, retool, salesforce, sansan, segment, sendgrid, sentry, sheets, shopify, slack, smarthr, square, statuspage, stores, stripeapi, stripebilling, surveymonkey, talentio, teams, tiktokads, trello, twilio, typeform, utage, vercel, vonage, wantedly, webflow, yayoi, zapier, zendesk, zoom

## テスト配置
- `src/tests/integrations/{toolname}.test.ts`

## テスト内容
- Week66-B1と同じパターン
- jest.mock() で外部APIをモック化
- 正常系・異常系のテスト

## 既存パターン
```bash
cat src/tests/memoryService.test.ts
grep -A5 '^export async function' src/integrations/slack.ts
```

## 注意
- npm install不要
- TypeScript型エラーなし
- git commit不要