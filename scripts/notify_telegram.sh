#!/bin/bash
# Telegramに通知を送るシンプルなスクリプト
BOT_TOKEN="8634804911:AAFTUZiIX3T0ZLO89oPkBEQdgVftmR7_HGc"
CHAT_ID="8394209518"
MESSAGE="$1"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=${MESSAGE}" \
  -d "parse_mode=HTML"
