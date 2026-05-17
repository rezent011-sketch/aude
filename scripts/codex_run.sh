#!/bin/bash
# Codexをラップして完了・失敗時にTelegramに通知するスクリプト
# 使い方: bash codex_run.sh "タスク名" "Codexへの指示"

TASK_NAME="$1"
PROMPT="$2"
BOT_TOKEN="8634804911:AAFTUZiIX3T0ZLO89oPkBEQdgVftmR7_HGc"
CHAT_ID="8394209518"
LOG_FILE="/tmp/codex_$(date +%Y%m%d_%H%M%S).log"
LOCK_FILE="/tmp/aude_codex.lock"

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    --data-urlencode "text=$1" \
    -d "parse_mode=HTML" > /dev/null
}

# 重複起動防止
if [ -f "$LOCK_FILE" ]; then
  EXISTING_PID=$(cat "$LOCK_FILE")
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    send_telegram "⚠️ Aude AI: 既に実行中です（PID: ${EXISTING_PID}）\n新しいタスク「${TASK_NAME}」はスキップしました"
    exit 1
  fi
fi

echo $$ > "$LOCK_FILE"

cd ~/aude
set -a; source .env; set +a

send_telegram "🚀 Aude AI 開発開始
タスク: ${TASK_NAME}
時刻: $(date '+%Y-%m-%d %H:%M')"

# Codex実行（full-autoモード）
echo "$PROMPT" | codex exec --dangerously-bypass-approvals-and-sandbox > "$LOG_FILE" 2>&1
EXIT_CODE=$?

# commit & push
git add -A 2>/dev/null
git diff --cached --quiet || git commit -m "feat: ${TASK_NAME}" 2>/dev/null
git push origin main 2>/dev/null

rm -f "$LOCK_FILE"

if [ $EXIT_CODE -eq 0 ]; then
  send_telegram "✅ Aude AI 完了
タスク: ${TASK_NAME}
時刻: $(date '+%Y-%m-%d %H:%M')"
else
  TAIL=$(tail -20 "$LOG_FILE" | tr '\n' ' ')
  send_telegram "❌ Aude AI エラー
タスク: ${TASK_NAME}
終了コード: ${EXIT_CODE}
時刻: $(date '+%Y-%m-%d %H:%M')
ログ末尾: ${TAIL}"
fi
