#!/bin/bash
# Codexをラップして完了・失敗時にTelegramに通知するスクリプト
# 使い方: ./codex_run.sh "タスク名" "Codexへの指示"

TASK_NAME="$1"
PROMPT="$2"
BOT_TOKEN="8634804911:AAFTUZiIX3T0ZLO89oPkBEQdgVftmR7_HGc"
CHAT_ID="8394209518"
LOG_FILE="/tmp/codex_$(date +%Y%m%d_%H%M%S).log"
SCRIPT_DIR="$(dirname "$0")"

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    -d "text=$1" \
    -d "parse_mode=HTML" > /dev/null
}

cd ~/aude
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)

send_telegram "🚀 Aude AI 開発開始
タスク: ${TASK_NAME}
時刻: $(date '+%Y-%m-%d %H:%M')"

# Codex実行
codex exec --model gpt-5.4 --full-auto "$PROMPT" > "$LOG_FILE" 2>&1
EXIT_CODE=$?

# 実装済みファイルをcommit&push
git add -A 2>/dev/null
git diff --cached --quiet || git commit -m "feat: ${TASK_NAME}" 2>/dev/null
git push origin main 2>/dev/null

if [ $EXIT_CODE -eq 0 ]; then
  TOKENS=$(grep "tokens used" "$LOG_FILE" | tail -1 | awk '{print $3}')
  send_telegram "✅ Aude AI 完了
タスク: ${TASK_NAME}
使用トークン: ${TOKENS}
時刻: $(date '+%Y-%m-%d %H:%M')"
else
  send_telegram "❌ Aude AI エラー
タスク: ${TASK_NAME}
終了コード: ${EXIT_CODE}
時刻: $(date '+%Y-%m-%d %H:%M')
ログ: ${LOG_FILE}"
fi
