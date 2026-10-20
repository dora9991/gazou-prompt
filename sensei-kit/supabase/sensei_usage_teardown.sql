-- 先生の道具箱の「利用の記録」（スキーマ sensei_usage）をやめる（全部消す）。
-- 先に：Settings → API（Data API）の Exposed schemas から sensei_usage を外して Save。外さずに消すと、会員サイトの API ごと止まる。
-- Edge Function「sensei-line」も、ダッシュボードの Edge Functions から消す。
drop schema if exists sensei_usage cascade;
select count(*) as sensei_usage_schema_left from pg_namespace where nspname = 'sensei_usage';  -- 0 ならおしまい
