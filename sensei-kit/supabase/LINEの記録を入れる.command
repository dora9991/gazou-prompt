#!/bin/bash
# 先生の道具箱を公式LINE「アラフォー」の特典にするための、本番（会員サイトの Supabase）の準備。
# ① 記録の置き場所（スキーマ sensei_usage）の SQL をクリップボードに入れて SQL Editor を開く（Run は自分で押す）
# ② Exposed schemas に sensei_usage を足す画面を開く
# ③ LINE の本人確認の関数（sensei-line）を入れて、設定（チャネル ID・呼んでよいページ）を入れる
# 会員サイトの表・関数には何もさわらない。
cd "$(dirname "$0")" || exit 1
REF="xisijxspafqhspgexfty"
CLI="$HOME/Documents/Claude/Projects/membership-site/node_modules/.bin/supabase"
[ -x "$CLI" ] || CLI="$HOME/Documents/Claude/Projects/サイト作りについて/hogosha-app/node_modules/.bin/supabase"
echo ""
echo "=== ① 記録の置き場所（sensei_usage）の SQL を、クリップボードに入れました ==="
pbcopy < sensei_usage.sql
open "https://supabase.com/dashboard/project/$REF/sql/new"
echo "  1. 開いた SQL Editor に貼りつけて（⌘V）、Run を押してください。"
echo "  2. いちばん下に出る「管理キー（su_…）」をコピーして、安全な場所に控えてください。"
echo "     利用状況の画面（usage-admin.html）を開くときに使います。チャットには貼らないでください。もう一度は表示されません。"
echo ""
read -r -p "  終わったら Enter を押してください（API の設定の画面を開きます）" _
open "https://supabase.com/dashboard/project/$REF/settings/api"
echo ""
echo "=== ② Exposed schemas に sensei_usage を「追加」して Save ==="
echo "  いまある名前（public・graphql_public・hogosha・gazou_prompt など）は消さないでください。"
echo "  （画面の名前が違うときは Project Settings → Data API の中です）"
echo ""
read -r -p "  終わったら Enter を押してください（LINE の関数を入れます）" _
echo ""
echo "=== ③ LINE の本人確認の関数（sensei-line）を入れます ==="
read -r -p "LINE ログインのチャネル ID（数字。アラフォーのプロバイダーに作ったもの）を入れて Enter： " CH
CH="$(echo "$CH" | tr -d '[:space:]')"
if ! echo "$CH" | grep -Eq '^[0-9]{6,20}$'; then echo "チャネル ID は数字だけです（LIFF ID ではありません）。もう一度やり直してください。"; exit 1; fi
echo "1) 関数を入れています…"
if "$CLI" functions deploy sensei-line --project-ref "$REF" --no-verify-jwt --workdir . ; then
  echo "2) 設定を入れています…"
  if "$CLI" secrets set "SENSEI_LINE_CHANNEL_ID=$CH" "SENSEI_ALLOWED_ORIGINS=https://dora9991.github.io" --project-ref "$REF" --workdir . ; then
    echo ""
    echo "=== できました。Claude に「sensei_usage と関数を入れた」と、LIFF ID を伝えてください ==="
    exit 0
  fi
fi
echo ""
echo "=== うまくいかなかったので、ダッシュボードで入れる方法に切りかえます ==="
pbcopy < functions/sensei-line/index.ts
open "https://supabase.com/dashboard/project/$REF/functions"
echo "  1. 開いた画面で「Deploy a new function」→「Via Editor」"
echo "  2. 名前を sensei-line にして、中身をすべて消してから貼りつけ（⌘V。コピーしてあります）→ Deploy"
echo "  3. 関数の設定で「Verify JWT（Enforce JWT Verification）」をオフにして保存"
echo "  4. Edge Functions の Secrets に、次の2つを追加："
echo "       SENSEI_LINE_CHANNEL_ID = $CH"
echo "       SENSEI_ALLOWED_ORIGINS = https://dora9991.github.io"
echo "  終わったら Claude に「sensei_usage と関数を入れた」と、LIFF ID を伝えてください。"
