#!/usr/bin/env bash
# judge.sh: 對 shots/ 裡十張截圖各跑一次 moondream，記錄答案與耗時到 results.tsv。
# 用法：bash judge.sh，在本檔所在目錄執行（evidence/2026-09-28-local-judge-trial/）。
set -u
cd "$(dirname "$0")"

OUT=results.tsv
: > "$OUT"
{
  echo "# git rev-parse HEAD: $(git -C "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" rev-parse HEAD 2>/dev/null)"
  echo "# ollama --version: $(ollama --version 2>&1)"
  echo -e "file\texpect\tanswer\tseconds"
} >> "$OUT"

PROMPT="Is this web page rendered correctly, or is it broken (unstyled, blank, overlapping, unreadable)? Answer NORMAL or BROKEN, then one sentence why."

for f in shots/normal-1600x1000.png shots/normal-1280x800.png shots/normal-1024x768.png shots/normal-800x1000.png shots/normal-390x844.png shots/broken-a.png shots/broken-b.png shots/broken-c.png shots/broken-d.png shots/broken-e.png; do
  case "$f" in
    shots/normal-*) expect=NORMAL ;;
    *) expect=BROKEN ;;
  esac
  start=$(date +%s.%N)
  answer=$(ollama run moondream "$PROMPT" "$f" 2>&1 | sed -r 's/\x1b\[[0-9;?]*[a-zA-Z]//g')
  end=$(date +%s.%N)
  secs=$(awk "BEGIN{printf \"%.1f\", $end-$start}")
  # 把換行壓成空白，塞進一個 tsv 欄位
  flat=$(echo "$answer" | tr '\n' ' ' | sed 's/\t/ /g' | sed 's/^ *//;s/ *$//')
  printf '%s\t%s\t%s\t%s\n' "$f" "$expect" "$flat" "$secs" >> "$OUT"
done

echo "wrote $OUT"
