-- 先生の道具箱（sensei-kit）：アカウントに保存する場所（鍵つき）
--
-- ジーニー会員サイトの Supabase に「同居」する。会員サイトの表・関数には一切さわらない（public に何も足さない）。
-- 全部を専用スキーマ sensei の中に置き、画面からは下の関数（RPC）だけを呼ぶ。表は直接読めない。
--
-- 中身は、先生の端末の中で暗号にしてから送られてくる（AES-GCM。鍵は先生の「合言葉」から端末で作る）。
-- ここに残るのは読めない文字列だけ。合言葉も鍵もサーバーには来ない。運営も中身を読めない。
--
-- 入れ方（本番）：SQL Editor にこのファイルを丸ごと貼って Run → Settings → API → Exposed schemas に sensei を足す。
--   何度流しても同じ結果になる（表は作り直さない・関数は置きかえる）。
-- やめ方：Exposed schemas から sensei を外す → teardown.sql（drop schema sensei cascade）。
--   ※ Exposed schemas に残したままスキーマを消すと、PostgREST 全体（会員サイトも）が止まる。順番を守る。
--
-- 使える人：会員サイトにプロフィールがあり、利用停止（suspended_at）になっていない人。
--   保護者会アプリの人（プロフィールを作らない）は使えない。プランで絞るときは sensei.settings の min_rank を上げる。

create schema if not exists sensei;
revoke all on schema sensei from public;
grant usage on schema sensei to authenticated;

/* ───────── 設定（1行だけ） ───────── */
create table if not exists sensei.settings (
  id               int primary key default 1 check (id = 1),
  min_rank         int    not null default 0,                    -- 0＝プランを問わない。上げると public.current_plan_rank() がそれ以上の人だけ
  user_bytes       bigint not null default 10 * 1024 * 1024,     -- 1人の上限（暗号にしたあとの大きさ）
  user_rows        int    not null default 6000,                 -- 1人の行数の上限
  total_bytes      bigint not null default 200 * 1024 * 1024,    -- sensei 全体の上限（会員サイトと容量を分け合うため）
  tombstone_days   int    not null default 120                   -- 消した印を残す日数（ほかの端末に「消した」を伝えるため）
);
insert into sensei.settings (id) values (1) on conflict (id) do nothing;

/* ───────── 合言葉の確かめ用（1人1行） ─────────
   salt と回数は鍵を作るための材料（秘密ではない）。check は決まった文字列を鍵で暗号にしたもの。
   ほかの端末で合言葉を入れたとき、これが開ければ合言葉が正しい */
create table if not exists sensei.vaults (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  salt        text not null check (salt ~ '^[A-Za-z0-9_-]{16,64}$'),
  iterations  int  not null check (iterations between 100000 and 5000000),
  check_iv    text not null check (check_iv ~ '^[A-Za-z0-9_-]{8,32}$'),
  check_data  text not null check (char_length(check_data) between 8 and 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

/* ───────── 中身（暗号にしたもの。道具箱の「ひとつもの」「ならぶもの」の1件が1行） ───────── */
create table if not exists sensei.blobs (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('d', 'c')),                       -- d＝ひとつもの（設定など）／c＝ならぶものの1件
  name        text not null check (name ~ '^[a-z][a-z0-9_]{0,39}$'),         -- 例：classes, seatplans, profile
  item_id     text not null default '' check (item_id ~ '^[A-Za-z0-9_.:-]{0,100}$'),
  iv          text not null default '' check (iv ~ '^[A-Za-z0-9_-]{0,32}$'),
  data        text not null default '' check (octet_length(data) <= 1600000), -- 暗号にした中身（base64url）
  deleted     boolean not null default false,                                 -- 消した印（ほかの端末にも消してもらう）
  updated_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, name, item_id)
);
create index if not exists blobs_user_updated on sensei.blobs (user_id, updated_at);

alter table sensei.settings enable row level security;
alter table sensei.vaults   enable row level security;
alter table sensei.blobs    enable row level security;
-- ポリシーは作らない＝画面（anon・authenticated）からは表を直接読めない。下の関数だけが読み書きする
revoke all on all tables in schema sensei from public, anon, authenticated;

/* ───────── だれが呼んでいるか（会員か）を確かめる ───────── */
create or replace function sensei._me()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v uuid := auth.uid();
  need int;
begin
  if v is null then
    raise exception 'not_logged_in' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v and p.suspended_at is null) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select s.min_rank into need from sensei.settings s where s.id = 1;
  if coalesce(need, 0) > 0 and coalesce(public.current_plan_rank(v), 0) < need then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  return v;
end;
$$;

/* ───────── いまの様子：合言葉の確かめ用・使っている量 ───────── */
create or replace function sensei.status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := sensei._me();
  v sensei.vaults;
  st sensei.settings;
  used bigint;
  n int;
begin
  select * into v from sensei.vaults where user_id = me;
  select * into st from sensei.settings where id = 1;
  select coalesce(sum(octet_length(b.data)), 0), count(*) into used, n from sensei.blobs b where b.user_id = me and not b.deleted;
  return jsonb_build_object(
    'vault', case when v.user_id is null then null else jsonb_build_object('salt', v.salt, 'iterations', v.iterations, 'check_iv', v.check_iv, 'check_data', v.check_data, 'updated_at', v.updated_at) end,
    'bytes', used, 'rows', n, 'limit_bytes', st.user_bytes, 'limit_rows', st.user_rows,
    'now', clock_timestamp());
end;
$$;

/* ───────── 合言葉を決める（はじめての1回） ───────── */
create or replace function sensei.vault_init(p_salt text, p_iterations int, p_check_iv text, p_check_data text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := sensei._me();
begin
  if exists (select 1 from sensei.vaults where user_id = me) then
    raise exception 'vault_exists' using errcode = 'P0001';
  end if;
  insert into sensei.vaults (user_id, salt, iterations, check_iv, check_data) values (me, p_salt, p_iterations, p_check_iv, p_check_data);
  return jsonb_build_object('ok', true);
end;
$$;

/* ───────── 作り直す（合言葉を忘れたとき）：アカウントの中身を全部消して、新しい合言葉にする ───────── */
create or replace function sensei.vault_reset(p_salt text, p_iterations int, p_check_iv text, p_check_data text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := sensei._me();
  gone int;
begin
  delete from sensei.blobs where user_id = me;
  get diagnostics gone = row_count;
  insert into sensei.vaults (user_id, salt, iterations, check_iv, check_data) values (me, p_salt, p_iterations, p_check_iv, p_check_data)
  on conflict (user_id) do update set salt = excluded.salt, iterations = excluded.iterations, check_iv = excluded.check_iv,
    check_data = excluded.check_data, updated_at = now();
  return jsonb_build_object('ok', true, 'removed', gone);
end;
$$;

/* ───────── 送る：変わった行をまとめて（最大 200 行・3MB） ─────────
   p_rows：[{ kind, name, item_id, iv, data, deleted }]。消した行は iv・data を空にして印だけ残す */
create or replace function sensei.push(p_rows jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := sensei._me();
  st sensei.settings;
  r jsonb;
  n int := 0;
  used bigint;
  rows_now int;
  at timestamptz;
begin
  if not exists (select 1 from sensei.vaults where user_id = me) then
    raise exception 'no_vault' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then
    raise exception 'bad_rows' using errcode = '22023';
  end if;
  if octet_length(p_rows::text) > 3 * 1024 * 1024 then
    raise exception 'too_large' using errcode = '22023';
  end if;
  select * into st from sensei.settings where id = 1;
  if pg_total_relation_size('sensei.blobs') > st.total_bytes then
    raise exception 'total_quota' using errcode = '53400';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) <> 'object' then raise exception 'bad_rows' using errcode = '22023'; end if;
    insert into sensei.blobs as b (user_id, kind, name, item_id, iv, data, deleted, updated_at)
    values (me, r->>'kind', r->>'name', coalesce(r->>'item_id', ''),
            case when coalesce((r->>'deleted')::boolean, false) then '' else coalesce(r->>'iv', '') end,
            case when coalesce((r->>'deleted')::boolean, false) then '' else coalesce(r->>'data', '') end,
            coalesce((r->>'deleted')::boolean, false), clock_timestamp())
    on conflict (user_id, kind, name, item_id) do update
      set iv = excluded.iv, data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;

  select coalesce(sum(octet_length(b.data)), 0), count(*) filter (where not b.deleted) into used, rows_now from sensei.blobs b where b.user_id = me;
  if used > st.user_bytes then raise exception 'quota' using errcode = '53400'; end if;
  if rows_now > st.user_rows then raise exception 'too_many_rows' using errcode = '53400'; end if;

  -- 古い「消した印」を片付ける（送ってきた本人の分だけ）
  delete from sensei.blobs b where b.user_id = me and b.deleted and b.updated_at < now() - make_interval(days => st.tombstone_days);

  at := clock_timestamp();
  return jsonb_build_object('saved', n, 'bytes', used, 'at', at);
end;
$$;

/* ───────── 受け取る：p_since より後に変わった行（古い順・最大 1000 行ずつ） ───────── */
create or replace function sensei.pull(p_since timestamptz default null, p_limit int default 500)
returns table (kind text, name text, item_id text, iv text, data text, deleted boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := sensei._me();
begin
  return query
    select b.kind, b.name, b.item_id, b.iv, b.data, b.deleted, b.updated_at
      from sensei.blobs b
     where b.user_id = me and (p_since is null or b.updated_at > p_since) and (p_since is not null or not b.deleted)
     order by b.updated_at, b.kind, b.name, b.item_id
     limit greatest(1, least(coalesce(p_limit, 500), 1000));
end;
$$;

/* ───────── アカウントの道具箱を全部消す（合言葉の確かめ用も） ───────── */
create or replace function sensei.forget_me()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := sensei._me();
  gone int;
begin
  delete from sensei.blobs where user_id = me;
  get diagnostics gone = row_count;
  delete from sensei.vaults where user_id = me;
  return jsonb_build_object('ok', true, 'removed', gone);
end;
$$;

-- 呼べるのはログインした人だけ（_me は中で使うだけ）
revoke all on all functions in schema sensei from public, anon, authenticated;
grant execute on function sensei.status() to authenticated;
grant execute on function sensei.vault_init(text, int, text, text) to authenticated;
grant execute on function sensei.vault_reset(text, int, text, text) to authenticated;
grant execute on function sensei.push(jsonb) to authenticated;
grant execute on function sensei.pull(timestamptz, int) to authenticated;
grant execute on function sensei.forget_me() to authenticated;

-- 確かめ（Run の結果に出る）：表3つ・RLS が全部オン・anon が呼べる関数 0
select
  (select count(*) from pg_tables where schemaname = 'sensei') as tables,
  (select bool_and(rowsecurity) from pg_tables where schemaname = 'sensei') as rls_all_on,
  (select count(*) from information_schema.routine_privileges where routine_schema = 'sensei' and grantee in ('anon', 'PUBLIC')) as anon_functions;
