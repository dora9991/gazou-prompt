-- 先生の道具箱（sensei-kit）の保存場所をやめる（全部消す）。
-- 先に：Settings → API → Exposed schemas から sensei を外して Save。
-- （外さずに消すと、PostgREST 全体＝会員サイトの画面も止まる）
-- アカウントに保存した先生の記録は、すべて消えて戻せない（先生の端末に残っている写しは消えない）。
drop schema if exists sensei cascade;
select count(*) as sensei_schema_left from pg_namespace where nspname = 'sensei';  -- 0 ならおしまい
