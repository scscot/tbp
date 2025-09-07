#!/usr/bin/env bash
# Run lead_processing_script.py across Base URL ranges.
# Default plan (50-window, 50-step): 151–200, 201–250, 251–300, 301–350, 351–400, 401–450, 451–462

set -Eeuo pipefail

# ---- Defaults (override via flags) ----
START=151           # first xx
END_LIMIT=462       # clamp for yy
WINDOW=50           # yy = min(xx + WINDOW - 1, END_LIMIT)
STEP=50             # increment xx by this amount each run
SLEEP_SECS=10       # pause between runs (0 disables)
MODEL="gemini-2.5-pro"
TEMPLATE="leads_prompt_template.txt"
BASE_URLS_FILE="base_urls.txt"
SCRIPT="lead_processing_script.py"
CONTINUE_ON_ERROR=1 # set to 0 to stop on first failure

usage() {
  cat <<EOF
Usage: $0 [--start=N] [--end-limit=M] [--window=W] [--step=S] [--sleep=SECONDS] \\
          [--model=NAME] [--template=FILE] [--base-urls-file=FILE] [--stop-on-error]

Defaults:
  --start=${START}  --end-limit=${END_LIMIT}
  --window=${WINDOW}  --step=${STEP}  --sleep=${SLEEP_SECS}
  --model=${MODEL}  --template=${TEMPLATE}  --base-urls-file=${BASE_URLS_FILE}

Notes:
- Run from ~/tbp/scripts with your venv active.
- Requires GOOGLE_CLOUD_PROJECT set (location is hard-coded to "global" in your Python script).
EOF
}

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# ---- Parse flags ----
for arg in "$@"; do
  case "$arg" in
    --start=*)          START="${arg#*=}";;
    --end-limit=*)      END_LIMIT="${arg#*=}";;
    --window=*)         WINDOW="${arg#*=}";;
    --step=*)           STEP="${arg#*=}";;
    --sleep=*)          SLEEP_SECS="${arg#*=}";;
    --model=*)          MODEL="${arg#*=}";;
    --template=*)       TEMPLATE="${arg#*=}";;
    --base-urls-file=*) BASE_URLS_FILE="${arg#*=}";;
    --stop-on-error)    CONTINUE_ON_ERROR=0;;
    -h|--help)          usage; exit 0;;
    *) echo "Unknown option: $arg"; usage; exit 2;;
  esac
done

# ---- Sanity checks ----
if [[ -z "${GOOGLE_CLOUD_PROJECT:-}" ]]; then
  echo "GOOGLE_CLOUD_PROJECT is not set. Add to ~/.zshrc, e.g.:"
  echo "  echo 'export GOOGLE_CLOUD_PROJECT=teambuilder-plus-fe74d' >> ~/.zshrc && source ~/.zshrc"
  exit 1
fi

[[ -f "$SCRIPT" ]] || { echo "Missing $SCRIPT"; exit 1; }
[[ -f "$TEMPLATE" ]] || { echo "Missing $TEMPLATE (must contain {{BASE_URLS}})"; exit 1; }
[[ -f "$BASE_URLS_FILE" ]] || { echo "Missing $BASE_URLS_FILE"; exit 1; }

# Quick interpreter deps check
if ! python - <<'PY' >/dev/null 2>&1
import pandas, requests
from google import genai
print("ok")
PY
then
  echo "Missing Python deps in this interpreter. In your venv run:"
  echo "  pip install -U google-genai pandas requests"
  exit 1
fi

# ---- Logging ----
LOG_DIR="${HOME}/tbp/tmp"
mkdir -p "$LOG_DIR"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/range_run_${RUN_ID}.log"

log "Run started. Logging to: $LOG_FILE" | tee -a "$LOG_FILE"
log "Plan: start=${START}, end-limit=${END_LIMIT}, window=${WINDOW}, step=${STEP}, sleep=${SLEEP_SECS}s, model=${MODEL}" | tee -a "$LOG_FILE"

# Print planned windows
plan=""
xx_print=$START
while (( xx_print <= END_LIMIT )); do
  yy_print=$(( xx_print + WINDOW - 1 ))
  (( yy_print > END_LIMIT )) && yy_print=$END_LIMIT
  plan+="${xx_print}-${yy_print} "
  (( yy_print >= END_LIMIT )) && break
  xx_print=$(( xx_print + STEP ))
done
log "Windows: ${plan}" | tee -a "$LOG_FILE"

# ---- Main loop ----
xx=$START
while (( xx <= END_LIMIT )); do
  yy=$(( xx + WINDOW - 1 ))
  (( yy > END_LIMIT )) && yy=$END_LIMIT

  CMD=( python "$SCRIPT"
        --template="$TEMPLATE"
        --url-range="${xx}-${yy}"
        --model="$MODEL"
        --base-urls-file="$BASE_URLS_FILE"
      )

  log "------------------------------------------------------------" | tee -a "$LOG_FILE"
  log "Executing: ${CMD[*]}" | tee -a "$LOG_FILE"

  set +e
  "${CMD[@]}" 2>&1 | tee -a "$LOG_FILE"
  status=${PIPESTATUS[0]}
  set -e

  if (( status != 0 )); then
    log "Range ${xx}-${yy} FAILED (status ${status})" | tee -a "$LOG_FILE"
    if (( CONTINUE_ON_ERROR == 0 )); then
      log "Stopping due to --stop-on-error." | tee -a "$LOG_FILE"
      exit ${status}
    fi
  else
    log "Range ${xx}-${yy} completed." | tee -a "$LOG_FILE"
  fi

  # Stop if we've reached the end
  (( yy >= END_LIMIT )) && break

  # Sleep between runs unless disabled
  (( SLEEP_SECS > 0 )) && { log "Sleeping ${SLEEP_SECS}s..." | tee -a "$LOG_FILE"; sleep "${SLEEP_SECS}"; }

  # Advance to next window
  xx=$(( xx + STEP ))
done

log "All ranges complete." | tee -a "$LOG_FILE"
