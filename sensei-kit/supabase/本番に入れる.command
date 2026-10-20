#!/bin/bash
# 先生の道具箱の「アカウントに保存（鍵つき）」を、本番の Supabase（会員サイト）に入れるための手伝い。
# SQL をクリップボードに入れて SQL Editor を開くだけ。流す（Run を押す）のは自分で行う。
cd "$(dirname "$0")" || exit 1
REF="xisijxspafqhspgexfty"
echo ""
echo "=== ① 保存場所（スキーマ sensei）を作る SQL を、クリップボードに入れました ==="
pbcopy < sensei.sql
open "https://supabase.com/dashboard/project/$REF/sql/new"
echo "  1. 開いた SQL Editor に貼りつけて（⌘V）、Run を押してください。"
echo "  2. いちばん下の結果が  tables = 3 ・ rls_all_on = true ・ anon_functions = 0  なら OK です。"
echo "     （会員サイトの表・関数には何もさわりません。何度流しても同じ結果です）"
echo ""
read -r -p "  終わったら Enter を押してください（API の設定の画面を開きます）" _
open "https://supabase.com/dashboard/project/$REF/settings/api"
echo ""
echo "=== ② Exposed schemas に sensei を「追加」して Save ==="
echo "  いまある public・graphql_public・hogosha・gazou_prompt は消さないでください。"
echo "  （画面の名前が違うときは Project Settings → Data API の中です）"
echo "  ※ 順番が大事：①の SQL を流してから②。やめるときは②を外してから teardown.sql。"
echo ""
echo "終わったら、Claude に「sensei を入れた」と伝えてください（公開用キーだけで動きを確かめてから、ログインの入口を出します）。"
echo "このウィンドウは閉じて大丈夫です。"
