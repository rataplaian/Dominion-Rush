#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .engine-build
tsc -p tsconfig.engine.json
node tests/engine.test.cjs
