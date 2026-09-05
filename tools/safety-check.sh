#!/usr/bin/env bash
# Safety check: block dangerous config from reaching production
# Usage: tools/safety-check.sh [branch]
set -euo pipefail

BRANCH="${1:-${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}}"
CONFIG="jango-api/src/main/resources/application.yml"
EXIT_CODE=0

echo "=== Safety Check (branch: $BRANCH) ==="

# Only enforce on main (production) branch
if [[ "$BRANCH" != "main" ]]; then
  echo "SKIP: safety checks only enforced on 'main' branch"
  exit 0
fi

# Check 1: monthly-report.admin-only must not be hardcoded to false
if grep -qE '^\s*admin-only:\s*false\s*$' "$CONFIG"; then
  echo "FAIL: monthly-report.admin-only is hardcoded to 'false' in $CONFIG"
  echo "      Production must use env var or default to 'true'"
  EXIT_CODE=1
else
  echo "PASS: admin-only is not hardcoded false"
fi

# Check 2: internal.jobs.secret must not have a hardcoded value (only env var ref)
SECRET_LINE=$(grep -E '^\s*secret:' "$CONFIG" | head -1 || true)
if echo "$SECRET_LINE" | grep -qvE '\$\{'; then
  echo "FAIL: internal.jobs.secret appears hardcoded in $CONFIG"
  EXIT_CODE=1
else
  echo "PASS: secrets use env var references"
fi

# Check 3: admin.secret must not be hardcoded
ADMIN_SECRET=$(grep -E '^\s*secret:.*admin' "$CONFIG" || true)
if [[ -n "$ADMIN_SECRET" ]] && echo "$ADMIN_SECRET" | grep -qvE '\$\{'; then
  echo "FAIL: admin.secret appears hardcoded in $CONFIG"
  EXIT_CODE=1
else
  echo "PASS: admin secret uses env var reference"
fi

# Check 4: no Flyway migration version gaps or duplicates
MIGRATIONS_DIR="jango-core/src/main/resources/db/migration"
if [[ -d "$MIGRATIONS_DIR" ]]; then
  VERSIONS=$(ls "$MIGRATIONS_DIR"/V*.sql 2>/dev/null | sed 's/.*V\([0-9]*\)__.*/\1/' | sort -n)
  PREV=""
  for V in $VERSIONS; do
    if [[ -n "$PREV" ]]; then
      EXPECTED=$((PREV + 1))
      if [[ "$V" -ne "$EXPECTED" ]]; then
        echo "WARN: Flyway migration gap: V${PREV} -> V${V} (expected V${EXPECTED})"
      fi
    fi
    PREV="$V"
  done
  DUPES=$(echo "$VERSIONS" | uniq -d)
  if [[ -n "$DUPES" ]]; then
    echo "FAIL: Duplicate Flyway versions: $DUPES"
    EXIT_CODE=1
  else
    echo "PASS: No duplicate Flyway versions"
  fi
else
  echo "SKIP: No migrations directory found"
fi

echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "=== All safety checks passed ==="
else
  echo "=== SAFETY CHECK FAILED ==="
fi
exit $EXIT_CODE
