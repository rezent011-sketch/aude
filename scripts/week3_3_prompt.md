=== Week3-3: Fly.io本番デプロイ ===

Aude AIプロジェクトをFly.ioに本番デプロイするための設定ファイルを作成してください。

## 仕様

### 1. Dockerfile作成: ~/aude/Dockerfile
- Node.js 20ベースイメージ
- ビルドステップ: npm ci → npm run build
- 実行ステップ: node dist/index.js
- ポート8080公開（Fly.io標準）
- ヘルスチェック設定

### 2. fly.toml作成: ~/aude/fly.toml
- アプリ名: aude-ai
- リージョン: nrt (東京)
- ポート: 8080
- auto_stop_machines: false（Bot常駐のため）
- min_machines_running: 1

### 3. .dockerignore作成: ~/aude/.dockerignore
- node_modules, .git, .env, data/ を除外

### 4. GitHub Actions: .github/workflows/deploy.yml
- mainブランチpush時にFly.ioへ自動デプロイ
- Fly APIトークンはGitHub Secretsに設定（FLY_API_TOKEN）
- ジョブ: checkout → setup-node → npm ci → npm run build → fly deploy

### 5. デプロイドキュメント: ~/aude/docs/DEPLOY.md
- Fly.io CLIインストール手順
- 初回デプロイ手順
- 環境変数設定手順（fly secrets set）
- Discord bot token等の機密情報設定
- トラブルシューティング

## 注意
- .envファイルはデプロイに含めない（Fly secretsで設定）
- TypeScriptのビルド成果物（dist/）を実行する構成
- git commitは不要