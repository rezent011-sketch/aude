=== Week66-B2: テストファイル作成（中半36ツール） ===

src/integrations/ ディレクトリの中半36ファイルに対してJestテストを作成してください。

## 対象ファイル（アルファベット順中半）
freeesign, freshdesk, github, githubactions, gitlab, gmail, gmoagree, google, googleanalytics, heroku, http, hubspot, hubspotcrm, intercom, jira, jobcan, kingofthyme, kintone, launchdarkly, line, lineworks, lmessage, loom, lstep, mailchimp, make, metaads, mfpayroll, miro, mixpanel, monday, moneyforward, n8n, notion, onedrive, openaiapi, outlook

※ http.ts はユーティリティのためテスト不要。飛ばしてOK。

## テスト配置
- `src/tests/integrations/{toolname}.test.ts`

## テスト内容
- Week66-B1と同じパターン
- jest.mock() で外部APIをモック化
- 正常系・異常系のテスト

## 既存パターン
```bash
cat src/tests/memoryService.test.ts
grep -A5 '^export async function' src/integrations/notion.ts
```

## 注意
- npm install不要
- TypeScript型エラーなし
- git commit不要