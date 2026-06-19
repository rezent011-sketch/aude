=== Week66-B1: テストファイル作成（前半36ツール） ===

src/integrations/ ディレクトリの前半36ファイルに対してJestテストを作成してください。

## 対象ファイル（アルファベット順前半）
activecampaign, airtable, amplitude, anthropicapi, asana, asanatasks, awss3, backlog, base, box, brevo, calendly, canva, chatwork, circleci, clickup, cloudflare, cloudsign, cloudwatch, coda, code, confluence, copper, cybozu, datadog, discordwebhook, docusign, drive, dropbox, elme, errors, fal, figma, figmafiles, fireflies, freee, freeehr

※ base.ts, errors.ts はモック・ユーティリティファイルのため、テスト不要。飛ばしてOK。

## テスト配置
- `src/tests/integrations/` ディレクトリを作成
- 各ファイルは `{toolname}.test.ts`

## テスト内容
1. 各integrationの主要export関数をモック化してテスト
2. 正常系: モックAPIが成功時のレスポンスを返す場合
3. 異常系: APIキー未設定・空パラメータ時のエラーハンドリング
4. `jest.mock()` で外部API呼び出しをモック化

## 既存パターン
```bash
cat src/tests/memoryService.test.ts  # Jest パターン参考
grep -A5 '^export async function' src/integrations/slack.ts  # 関数シグネチャ参考
```

## 注意
- npm install不要
- TypeScript型エラーなし
- git commit不要