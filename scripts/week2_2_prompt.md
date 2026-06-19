=== Week2-2: ファイル生成(PDF/Excel/PPT) ===

Aude AIプロジェクトにファイル生成機能を追加してください。

## 仕様

### 1. 依存パッケージ追加
```bash
npm install pdfkit exceljs pptxgenjs
```
※既にインストール済みの場合は不要

### 2. ファイル生成サービス作成: src/services/fileGenerator.ts
- `generatePDF(title: string, content: string, outputPath: string): Promise<string>`
- `generateExcel(data: any[], sheetName: string, outputPath: string): Promise<string>`
- `generatePPTX(slides: any[], outputPath: string): Promise<string>`
- 生成したファイルをDiscordに添付して送信する機能

### 3. /reportコマンド作成: src/commands/report.ts
- サブコマンド: `pdf`, `excel`, `pptx`
- ユーザーがテキスト内容を入力 → ファイル生成 → Discordに添付送信
- SlashCommandBuilder使用・EmbedBuilderでレスポンス

### 4. commandHandler.tsへの登録
- `import { reportCommand } from '../commands/report'`
- commands配列に追加

## 既存パターンの確認
```bash
cat src/commands/create.ts | head -30  # 既存コマンドパターン
cat src/services/fileExports.ts         # 既存ファイルエクスポート
```

## 注意
- npm installは事前に実行済みの前提で書かない（Codex sandbox内で実行不可のため）
- TypeScript型エラーなし
- git commitは不要