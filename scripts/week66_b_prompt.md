=== Week66-B: 75ツールのテストファイル作成 ===

Aude AIプロジェクトのsrc/integrations/ディレクトリにある全integrationファイルに対して、Jestテストファイルを作成してください。

## 仕様

1. **テスト配置**: `src/tests/integrations/` ディレクトリを作成し、各integrationファイルに対応するテストファイルを作成
2. **テスト内容**: 各integrationの主要関数について以下をテスト:
   - 正常系: API呼び出しが成功した場合のレスポンス形式確認
   - 異常系: APIキー未設定・空パラメータ・APIエラー時のエラーハンドリング
   - モック: 外部API呼び出しは全てモック化（実際のAPIを叩かない）
3. **パターン**: 既存の `src/tests/memoryService.test.ts` のJestパターンに従う
4. **対象ファイル**: src/integrations/ の全112ファイル（errors.ts, base.ts, ai.ts以外の109ファイル）

## 既存パターンの確認

```bash
# 既存テストの確認
cat src/tests/memoryService.test.ts

# integration関数のシグネチャ確認
grep -A5 '^export async function' src/integrations/slack.ts | head -10
```

## 注意

- npm installは不要（jest設定済み・パッケージインストール済み）
- git commitは不要（ラッパースクリプトが対応）
- TypeScriptの型エラーを出さないこと（@ts-nocheckは使わない）
- ファイルは src/tests/integrations/ ディレクトリに配置
- 各テストファイル名は {toolname}.test.ts とする

## 期待されるファイル数

109個のテストファイル（errors.ts, base.ts, ai.tsを除く全integration）