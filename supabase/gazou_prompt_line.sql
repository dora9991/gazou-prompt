-- プロンプト処方箋 ― LINE（LIFF）とつなぐための追加分
--
-- Supabase の SQL Editor に、このファイルを丸ごと貼って「Run」する。
-- 今ある記録（events）も、今ある関数のしくみも壊さない。足すだけ・包むだけ。
-- もう一度流しても、二重に包まれない（何度流しても同じ結果になる）。
--
-- 前提（すでにあるもの）：
--   gazou_prompt.events / gazou_prompt.log_event(p jsonb) returns jsonb
--   gazou_prompt.admin_events(p_key text, p_since timestamptz, p_limit …) returns jsonb
--   gazou_prompt._admin_ok(p_key text) returns boolean
--   前提と違っていたら、何も変えずに止まる（トランザクションなので、途中まで変わることはない）。
--
-- 足すもの：
--   1. events に line_user_id / line_name の列
--   2. 記録用の札（line_sessions）。札そのものは保存せず、ハッシュだけ持つ
--   3. create_line_session（Edge Function「gazou-line」だけが呼べる）
--   4. log_event を包む：札があれば、記録に LINE の名前をつける（札が古ければ session:"expired" を返す）
--   5. admin_events を包む：管理画面の記録に、LINE の名前の列をつける
--   6. admin_forget_user：LINE の人を忘れる（名前から切り離す／記録ごと消す）

begin;

-- ---------------------------------------------------------------- 前提の確認
do $$
begin
  if to_regprocedure('gazou_prompt._admin_ok(text)') is null then
    raise exception '前提がちがいます：gazou_prompt._admin_ok(text) がありません';
  end if;
  -- log_event：まだ包んでいなければ、(p jsonb) → jsonb であること
  if to_regprocedure('gazou_prompt._log_event_base(jsonb)') is null then
    if to_regprocedure('gazou_prompt.log_event(jsonb)') is null
       or (select prorettype from pg_proc where oid = 'gazou_prompt.log_event(jsonb)'::regprocedure) <> 'jsonb'::regtype then
      raise exception '前提がちがいます：gazou_prompt.log_event(p jsonb) returns jsonb がありません';
    end if;
  end if;
  -- admin_events：まだ包んでいなければ、jsonb を返す p_key / p_since / p_limit つきの関数が1つだけあること
  if not exists (select 1 from pg_proc where pronamespace = 'gazou_prompt'::regnamespace and proname = '_admin_events_base') then
    if (select count(*) from pg_proc where pronamespace = 'gazou_prompt'::regnamespace and proname = 'admin_events') <> 1 then
      raise exception '前提がちがいます：gazou_prompt.admin_events が1つだけではありません';
    end if;
    if not exists (
      select 1 from pg_proc
      where pronamespace = 'gazou_prompt'::regnamespace and proname = 'admin_events'
        and prorettype = 'jsonb'::regtype
        and proargnames @> array['p_key', 'p_since', 'p_limit']
    ) then
      raise exception '前提がちがいます：gazou_prompt.admin_events(p_key, p_since, p_limit …) returns jsonb がありません';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------- 1. events に列を足す
alter table gazou_prompt.events
  add column if not exists line_user_id text,
  add column if not exists line_name text;

create index if not exists events_line_user_idx
  on gazou_prompt.events (line_user_id) where line_user_id is not null;

-- 記録に LINE の名前をつけるのは、この仕掛けだけ。
-- 記録の中身（p）に line_user_id などが書かれていても無視する（なりすまし防止）。
create or replace function gazou_prompt._events_fill_line()
returns trigger
language plpgsql
set search_path = gazou_prompt, pg_temp
as $$
begin
  new.line_user_id := nullif(current_setting('gazou_prompt.line_user', true), '');
  new.line_name    := case when new.line_user_id is null then null
                           else nullif(current_setting('gazou_prompt.line_name', true), '') end;
  return new;
end $$;

drop trigger if exists events_fill_line on gazou_prompt.events;
create trigger events_fill_line
  before insert on gazou_prompt.events
  for each row execute function gazou_prompt._events_fill_line();

-- ---------------------------------------------------------------- 2. 記録用の札
create table if not exists gazou_prompt.line_sessions (
  token_hash   text primary key check (token_hash ~ '^[0-9a-f]{64}$'),   -- 札の SHA-256（札そのものは持たない）
  line_user_id text not null,
  line_name    text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists line_sessions_expires_idx on gazou_prompt.line_sessions (expires_at);
create index if not exists line_sessions_user_idx    on gazou_prompt.line_sessions (line_user_id);

alter table gazou_prompt.line_sessions enable row level security;   -- 方針（policy）は作らない＝公開用キーからは読めない
revoke all on gazou_prompt.line_sessions from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. 札を作る（gazou-line だけ）
create or replace function gazou_prompt.create_line_session(
  p_token_hash   text,
  p_line_user_id text,
  p_name         text,
  p_ttl_seconds  integer default 43200
) returns jsonb
language plpgsql
security definer
set search_path = gazou_prompt, pg_temp
as $$
declare
  v_ttl integer := least(greatest(coalesce(p_ttl_seconds, 43200), 60), 86400);
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or coalesce(p_line_user_id, '') = '' then
    raise exception 'bad_args';
  end if;
  delete from gazou_prompt.line_sessions where expires_at < now() - interval '1 day';   -- 古い札のそうじ
  insert into gazou_prompt.line_sessions (token_hash, line_user_id, line_name, expires_at)
  values (p_token_hash, p_line_user_id, nullif(left(btrim(coalesce(p_name, '')), 60), ''), now() + make_interval(secs => v_ttl));
  return jsonb_build_object('ok', true, 'expires_in', v_ttl);
end $$;

revoke all on function gazou_prompt.create_line_session(text, text, text, integer) from public, anon, authenticated;
grant execute on function gazou_prompt.create_line_session(text, text, text, integer) to service_role;
grant usage on schema gazou_prompt to service_role;

-- ---------------------------------------------------------------- 4. log_event を包む
do $$
begin
  if to_regprocedure('gazou_prompt._log_event_base(jsonb)') is null then
    alter function gazou_prompt.log_event(jsonb) rename to _log_event_base;
  end if;
end $$;

revoke all on function gazou_prompt._log_event_base(jsonb) from public, anon, authenticated;

create or replace function gazou_prompt.log_event(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = gazou_prompt, pg_temp
as $$
declare
  v_tok     text := p ->> 'session';
  v_uid     text;
  v_name    text;
  v_expired boolean := false;
  v_out     jsonb;
begin
  if v_tok is not null and v_tok <> '' then
    if v_tok ~ '^[0-9a-f]{64}$' then
      select s.line_user_id, s.line_name into v_uid, v_name
        from gazou_prompt.line_sessions s
       where s.token_hash = encode(sha256(convert_to(v_tok, 'UTF8')), 'hex')
         and s.expires_at > now();
    end if;
    v_expired := (v_uid is null);   -- 札が古い・知らない札：名前なしで記録して、つなぎ直すよう知らせる
  end if;

  perform set_config('gazou_prompt.line_user', coalesce(v_uid, ''), true);
  perform set_config('gazou_prompt.line_name', coalesce(v_name, ''), true);

  v_out := gazou_prompt._log_event_base(p - 'session' - 'line_user_id' - 'line_name');

  perform set_config('gazou_prompt.line_user', '', true);
  perform set_config('gazou_prompt.line_name', '', true);

  if v_expired and jsonb_typeof(v_out) = 'object' then
    v_out := v_out || jsonb_build_object('session', 'expired');
  end if;
  return v_out;
end $$;

revoke all on function gazou_prompt.log_event(jsonb) from public;
grant execute on function gazou_prompt.log_event(jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- 5. admin_events を包む
do $$
declare
  v_sig text;
begin
  if not exists (select 1 from pg_proc where pronamespace = 'gazou_prompt'::regnamespace and proname = '_admin_events_base') then
    select p.oid::regprocedure::text into v_sig
      from pg_proc p where p.pronamespace = 'gazou_prompt'::regnamespace and p.proname = 'admin_events';
    execute format('alter function %s rename to _admin_events_base', v_sig);
  end if;
end $$;

do $$
begin
  execute (
    select format('revoke all on function %s from public, anon, authenticated', p.oid::regprocedure)
      from pg_proc p where p.pronamespace = 'gazou_prompt'::regnamespace and p.proname = '_admin_events_base'
  );
end $$;

create or replace function gazou_prompt.admin_events(
  p_key   text,
  p_since timestamptz default null,
  p_limit integer default 50000
) returns jsonb
language plpgsql
security definer
set search_path = gazou_prompt, pg_temp
as $$
declare
  v_out jsonb;
begin
  -- 管理キーの確認や、記録の取り出し方は、もとの関数にまかせる
  v_out := gazou_prompt._admin_events_base(p_key => p_key, p_since => p_since, p_limit => p_limit);

  if jsonb_typeof(v_out -> 'rows') = 'array' then
    v_out := jsonb_set(v_out, '{rows}', coalesce((
      select jsonb_agg(
               t.r || jsonb_build_object('line_user_id', e.line_user_id, 'line_name', e.line_name)
               order by t.ord)
        from jsonb_array_elements(v_out -> 'rows') with ordinality as t(r, ord)
        left join gazou_prompt.events e on e.id = (t.r ->> 'id')::bigint
    ), '[]'::jsonb));
  end if;
  return v_out;
end $$;

revoke all on function gazou_prompt.admin_events(text, timestamptz, integer) from public;
grant execute on function gazou_prompt.admin_events(text, timestamptz, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- 6. LINE の人を忘れる
-- p_delete = false：記録は名前なしで残し、LINE の表示名と番号を消す
-- p_delete = true ：その人の記録を、すべて消す
-- どちらも、その人の札も消す。返事：{ ok, events: 変えた（消した）記録の件数 }
create or replace function gazou_prompt.admin_forget_user(
  p_key          text,
  p_line_user_id text,
  p_delete       boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = gazou_prompt, pg_temp
as $$
declare
  v_n bigint;
begin
  if not gazou_prompt._admin_ok(p_key) then
    return jsonb_build_object('ok', false, 'error', 'bad_key');
  end if;
  if coalesce(p_line_user_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;

  delete from gazou_prompt.line_sessions where line_user_id = p_line_user_id;

  if coalesce(p_delete, false) then
    delete from gazou_prompt.events where line_user_id = p_line_user_id;
  else
    update gazou_prompt.events set line_user_id = null, line_name = null where line_user_id = p_line_user_id;
  end if;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'events', v_n);
end $$;

revoke all on function gazou_prompt.admin_forget_user(text, text, boolean) from public;
grant execute on function gazou_prompt.admin_forget_user(text, text, boolean) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
