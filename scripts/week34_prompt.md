# Week34: Function Calling — 全連携ツールをAI会話から自動呼び出し

## 目的
ユーザーが「今日のメールを確認して」「Notionのページを検索して」などと自然言語で話しかけたとき、
AIが自動的に適切な外部ツールAPIを呼び出して結果を返す仕組みを実装する。

## 実装ファイル: `src/services/toolDispatcher.ts` (新規)

OpenAI Function Calling / Anthropic Tool Use を使い、以下のツールを定義・実行する。

### 対応ツール一覧 (全24種)

1. **gmail_list** — Gmailの受信箱を取得 (最新N件)
   - 既存: `src/integrations/gmail.ts` の `listGmailMessages(maxResults, query)`
2. **gmail_search** — Gmailを検索
   - 既存: `src/integrations/gmail.ts` の `listGmailMessages(maxResults, query)`
3. **gmail_send** — メールを送信
   - 既存: `src/integrations/gmail.ts` の `sendGmail({to, subject, body})`
4. **calendar_list** — Googleカレンダーの予定を取得
   - 既存: `src/integrations/google.ts` の `listCalendarEvents(maxResults)`
5. **calendar_create** — カレンダーに予定を追加
   - 既存: `src/integrations/google.ts` の `createCalendarEvent({summary, start, end, description})`
6. **drive_search** — Google Driveのファイルを検索
   - 既存: `src/integrations/drive.ts` の `searchDriveFiles(query, maxResults)`
7. **notion_search** — Notionのページを検索
   - 既存: `src/integrations/notion.ts` の `searchNotionPages(query)`
8. **notion_create** — Notionにページを作成
   - 既存: `src/integrations/notion.ts` の `createNotionPage({title, content, parentPageId})`
9. **github_list_issues** — GitHubのIssue一覧を取得
   - 既存: `src/integrations/github.ts` の `listIssues(owner, repo, state)`
10. **github_create_issue** — GitHubにIssueを作成
    - 既存: `src/integrations/github.ts` の `createIssue(owner, repo, title, body)`
11. **figma_get_file** — FigmaのファイルAを取得
    - 既存: `src/integrations/figma.ts` の `getFigmaFile(fileKey)`
12. **notion_get_page** — NotionのページIDからページ内容を取得
    - 既存: `src/integrations/notion.ts` の `getNotionPage(pageId)`
13. **linear_list_issues** — LinearのIssue一覧を取得
    - 既存: `src/integrations/linear.ts` の `listIssues()`
14. **linear_create_issue** — LinearにIssueを作成
    - 既存: `src/integrations/linear.ts` の `createIssue({title, description, teamId})`
15. **trello_list_cards** — TrelloのカードBを取得
    - 既存: `src/integrations/trello.ts` の `listCards(boardId)`
16. **trello_create_card** — Trelloにカードを作成
    - 既存: `src/integrations/trello.ts` の `createCard({name, listId, description})`
17. **jira_list_issues** — JiraのIssue一覧を取得
    - 既存: `src/integrations/jira.ts` の `listIssues(projectKey, maxResults)`
18. **jira_create_issue** — JiraにIssueを作成
    - 既存: `src/integrations/jira.ts` の `createIssue({projectKey, summary, description, issueType})`
19. **zoom_create_meeting** — Zoomミーティングを作成
    - 既存: `src/integrations/zoom.ts` の `createZoomMeeting({topic, startTime, duration})`
20. **chatwork_send** — Chatworkにメッセージを送信
    - 既存: `src/integrations/chatwork.ts` の `sendMessage(roomId, message)`
21. **backlog_list_issues** — Backlogの課題一覧を取得
    - 既存: `src/integrations/backlog.ts` の `listIssues(projectKey)`
22. **backlog_create_issue** — Backlogに課題を作成
    - 既存: `src/integrations/backlog.ts` の `createIssue({projectKey, summary, description})`
23. **datadog_get_monitors** — Datadogのモニター一覧を取得
    - 既存: `src/integrations/datadog.ts` の `listMonitors()`
24. **pagerduty_list_incidents** — PagerDutyのインシデント一覧を取得
    - 既存: `src/integrations/pagerduty.ts` の `listIncidents(status)`

## 実装方針

### `src/services/toolDispatcher.ts` (新規作成)

```typescript
// ツール定義リスト (OpenAI tools / Anthropic tools 形式)
// ツール実行関数 executeToolCall(toolName, args) -> string
// 利用可能かチェック (APIキーが設定されているか) isToolAvailable(toolName) -> boolean
```

- `isToolAvailable` でAPIキーが設定されていないツールは tools リストから除外する
- ツール実行結果は日本語でフォーマットして返す (例: Gmail一覧 → 「件名・送信者・日時」の箇条書き)
- エラー時は「○○の取得に失敗しました: {理由}」を返す

### `src/llm/router.ts` (修正)

`routeToLLM` 関数にオプション引数 `enableTools?: boolean` を追加。
`enableTools=true` のとき:
- OpenAI: `tools` パラメータに toolDispatcher のツール定義を渡す → `tool_calls` が返ってきたら `executeToolCall` で実行 → 結果を messages に追加して再度LLMを呼ぶ (最大3回ループ)
- Claude (Anthropic): `tools` パラメータに toolDispatcher のツール定義を渡す → `tool_use` ブロックが返ってきたら同様に実行

### `src/handlers/messageHandler.ts` (修正)

`routeToLLM` 呼び出しに `enableTools: true` を追加するだけ。

## 制約・注意事項

- `npm install` は不要。既存パッケージのみ使用。
- `git` コマンドは使用しない。
- 実装後に `npx tsc --noEmit` でエラーがないことを確認すること。
- 既存の integrations/*.ts の関数シグネチャは変更しない。
- ツールが使えない場合でも会話は通常通り続く (tools未設定時と同じ動作)。
- Discord のメッセージ上限2000文字を超えないよう、ツール結果は最大1500文字でtruncateする。

## 完了条件

1. `npx tsc --noEmit` がエラーなしで通る
2. `src/services/toolDispatcher.ts` が存在する
3. `messageHandler.ts` で `enableTools: true` が渡されている
4. 実装した全ツールに対応するOpenAI/Anthropic形式のツール定義が含まれている
