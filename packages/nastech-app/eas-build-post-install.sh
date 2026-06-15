#!/usr/bin/env bash
set -euo pipefail
echo "=== [EAS POST-INSTALL HOOK] ==="
echo "PWD: $(pwd)"
echo "=== sources/assets/images/ ==="
ls sources/assets/images/ 2>&1 | head -20 || echo "DIRECTORY MISSING"
echo "=== icon-adaptive.png ==="
test -f sources/assets/images/icon-adaptive.png && echo "FOUND" || echo "MISSING"
echo "=== __dirname equivalent ==="
ls "$(dirname "$0")/../sources/assets/images/" 2>&1 | head -5 || echo "N/A"
echo "=== END HOOK ==="
