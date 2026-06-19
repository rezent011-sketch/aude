=== Week3-1: クレジット管理 + Stripe課金 ===

Aude AIプロジェクトにクレジット管理とStripe課金機能を追加してください。

## 仕様

### 1. 依存パッケージ追加
```bash
npm install better-sqlite3 stripe
```

### 2. データベース設定: src/db/database.ts
- better-sqlite3でローカルDB作成 (data/aude.db)
- credits テーブル: user_id, balance, updated_at
- transactions テーブル: id, user_id, amount, type(credit/debit), description, created_at

### 3. クレジット管理サービス: src/services/creditsService.ts
- getBalance(userId): 残高取得
- addCredits(userId, amount, description): クレジット追加
- useCredits(userId, amount, description): クレジット消費（不足時はエラー）
- getTransactionHistory(userId): 取引履歴

### 4. /creditsコマンド: src/commands/credits.ts
- サブコマンド: `balance`, `history`, `buy`
- buy: Stripe Checkout セッション作成 → ユーザーに決済URL送信

### 5. Stripe Webhook受信: src/server.ts に追記
- POST /webhooks/stripe エンドポイント
- checkout.session.completed → クレジット追加
- Stripe署名検証
- ポート3001でWebhook受信（メインサーバーとは別）

### 6. commandHandler.tsへの登録
- creditsCommand をインポート・配列に追加

## 既存パターンの確認
```bash
cat src/commands/stripeapi.ts  # 既存Stripe連携
cat src/server.ts | head -20   # サーバー構造
```

## 注意
- npm installは事前実行済み
- better-sqlite3は既存プロジェクトで使われている可能性あり（確認すること）
- TypeScript型エラーなし
- git commitは不要