=== Week3-2: 外部ツール連携フレームワーク(Notion/Google/GitHub) ===

Aude AIプロジェクトに統合的な外部ツール連携フレームワークを追加してください。

## 仕様

### 1. 連携フレームワーク: src/integrations/index.ts
- 全integrationを統一的に管理するレジストリ
- `getIntegration(name)`: 名前からintegration取得
- `listAvailableIntegrations()`: 利用可能な連携一覧
- `checkIntegrationStatus(name)`: APIキー設定状況確認

### 2. /connectコマンド: src/commands/connect.ts
- サブコマンド: `list`, `status`, `setup`
- list: 利用可能な連携一覧表示
- status: 各連携のAPIキー設定状況表示
- setup: 指定した連携のAPIキー設定ガイド表示

### 3. Notion連携強化
- 既存のsrc/integrations/notion.tsを確認・拡張
- 検索・ページ作成・データベースクエリ機能

### 4. Google連携強化
- 既存のsrc/integrations/google.ts、src/integrations/sheets.tsを確認・拡張
- カレンダー予定取得・作成
- スプレッドシート読み書き

### 5. GitHub連携強化
- 既存のsrc/integrations/github.tsを確認・拡張
- Issue作成・一覧取得・PR作成

### 6. commandHandler.tsへの登録
- connectCommand をインポート・配列に追加

## 注意
- 既存のintegrationファイルを上書きしない（拡張のみ）
- TypeScript型エラーなし
- git commitは不要