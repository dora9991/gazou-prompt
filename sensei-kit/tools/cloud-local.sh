#!/bin/bash
# 手元の Supabase（本番とは別）を起こす。会員サイトのまね（supabase/test-member-stub.sql）と supabase/sensei.sql を、
# 作業用フォルダ tools/_out/cloud-workdir に「移行」として置いて start する（API が起きる前に sensei スキーマが要るため）。
# 終わると URL と公開用キーを tools/_out/cloud-local.json に書く（tools/cloud-test.cjs が読む）。止めるのは --stop。
set -euo pipefail
cd "$(dirname "$0")/.."
SB="${SUPABASE_BIN:-$(pwd)/../../hogosha-app/node_modules/.bin/supabase}"
W=tools/_out/cloud-workdir
if [ "${1:-}" = "--stop" ]; then "$SB" stop --workdir "$W" --no-backup >/dev/null; echo "止めました"; exit 0; fi
rm -rf "$W"; mkdir -p "$W/supabase/migrations"
cp supabase/config.toml "$W/supabase/config.toml"
cp supabase/test-member-stub.sql "$W/supabase/migrations/20261020000000_member_stub.sql"
cp supabase/sensei.sql "$W/supabase/migrations/20261020000001_sensei.sql"
"$SB" start --workdir "$W" -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor,edge-runtime >/dev/null 2>&1
"$SB" status --workdir "$W" -o json 2>/dev/null > tools/_out/cloud-local.json
node -e "const s=require('./tools/_out/cloud-local.json'); console.log('手元の Supabase：' + s.API_URL)"
