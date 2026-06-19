=== Week2-3: スケジュール自動化(/schedule) ===

Aude AIプロジェクトにスケジュール自動化機能を追加してください。

## 仕様

### 1. 依存パッケージ追加
```bash
npm install node-cron
```

### 2. スケジュールサービス作成: src/services/scheduleService.ts
※既存のscheduleService.tsがある場合は拡張
- 自然言語→cron変換機能（例: "毎日9時にリマインド" → "0 9 * * *"）
- スケジュールのCRUD: add/list/delete
- スケジュール実行時にDiscordチャンネルにメッセージ送信
- スケジュール永続化: data/schedules.json またはSQLite

### 3. 自然言語cron変換: src/services/cronParser.ts
- 日本語自然言語をcron式に変換
- 対応パターン例:
  - "毎日9時" → "0 9 * * *"
  - "毎週月曜10時" → "0 10 * * 1"
  - "毎月1日8時" → "0 8 1 * *"
  - "平日18時" → "0 18 * * 1-5"

### 4. /scheduleコマンド作成: src/commands/schedule.ts
- サブコマンド: `add`, `list`, `delete`
- 自然言語でスケジュール指定可能
- SlashCommandBuilder使用

### 5. commandHandler.tsへの登録
- import追加・commands配列に追加

## 注意
- npm installは事前実行済み
- TypeScript型エラーなし
- git commitは不要