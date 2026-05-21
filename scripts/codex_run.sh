#!/bin/bash
# codex_run.sh — wrapper to run Codex non-interactively with Telegram notifications
# Usage: bash codex_run.sh "タスク名" "Codexへの指示"
#
# Key design decisions (verified 2026-05-17):
# - Correct flag is --dangerously-bypass-approvals-and-sandbox
#   (NOT --approval-policy full-auto, NOT --full-auto, NOT --approval-policy never)
# - Prompt must be passed via stdin (echo "$PROMPT" | codex exec ...), NOT as positional arg
#   (positional arg causes "Reading additional input from stdin..." hang)
# - Git add/commit/push happen AFTER Codex exits (Codex sandbox blocks .git/ writes)
# - Telegram uses --data-urlencode to handle special chars in message text
# - set -a; source .env exports all vars to Codex subprocess
# - PROJECT_DIR defaults to ~/aude for Aude project; override with env var if needed

TASK_NAME="$1"
PROMPT_FILE="$2"   # ← ファイルパスを受け取る（シェル展開を避けるため変数展開しない）
PROJECT_DIR="${AUDE_PROJECT_DIR:-/Users/apple/aude}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"      # set in .env
CHAT_ID="${TELEGRAM_CHAT_ID}"          # set in .env
LOG_FILE="/tmp/codex_$(date +%Y%m%d_%H%M%S).log"
LOCK_FILE="/tmp/aude_codex.lock"

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    --data-urlencode "text=$1" \
    -d "parse_mode=HTML" > /dev/null
}

# Duplicate-run guard
if [ -f "$LOCK_FILE" ]; then
  EXISTING_PID=$(cat "$LOCK_FILE")
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    send_telegram "⚠️ 既に実行中です（PID: ${EXISTING_PID}）
新しいタスク「${TASK_NAME}」はスキップしました"
    exit 1
  fi
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"

cd "$PROJECT_DIR" || { send_telegram "❌ プロジェクトディレクトリが見つかりません: ${PROJECT_DIR}"; exit 1; }
set -a; source .env; set +a

send_telegram "🚀 開発開始
タスク: ${TASK_NAME}
時刻: $(date '+%Y-%m-%d %H:%M')"

# Codex writes code only — do NOT include git commands in the prompt
# IMPORTANT: ファイルをそのままstdinに渡す（シェル変数展開を避ける）
if [ ! -f "$PROMPT_FILE" ]; then
  send_telegram "❌ プロンプトファイルが見つかりません: ${PROMPT_FILE}"
  rm -f "$LOCK_FILE"
  exit 1
fi
codex exec --dangerously-bypass-approvals-and-sandbox < "$PROMPT_FILE" > "$LOG_FILE" 2>&1
EXIT_CODE=$?

# Git operations outside Codex sandbox
git add -A 2>/dev/null
git diff --cached --quiet || git commit -m "feat: ${TASK_NAME}" 2>/dev/null
git push origin main 2>/dev/null

rm -f "$LOCK_FILE"

if [ $EXIT_CODE -eq 0 ]; then
  send_telegram "✅ 完了
タスク: ${TASK_NAME}
時刻: $(date '+%Y-%m-%d %H:%M')"
else
  TAIL=$(tail -20 "$LOG_FILE" | tr '\n' ' ')
  send_telegram "❌ エラー
タスク: ${TASK_NAME}
終了コード: ${EXIT_CODE}
時刻: $(date '+%Y-%m-%d %H:%M')
ログ末尾: ${TAIL}"
fi
