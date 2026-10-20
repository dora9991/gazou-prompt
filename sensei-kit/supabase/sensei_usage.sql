-- =====================================================================================
-- 先生の道具箱（sensei-kit）：公式LINE「アラフォー」の特典として使われたときの「利用の記録」― スキーマ sensei_usage
--
-- ・会員サイト（ジーニー）の Supabase に「同居」させるための SQL。作るものは、すべてスキーマ sensei_usage の中だけ。
--   public・auth・storage には何も作らず、何も変えない。何度流しても同じ結果になる。
-- ・記録するのは「どの道具で、何をしたか」だけ（例：seats / open、seats / run、flyer / print、demo / done）。
--   生徒の名前・名簿・入力した中身・アカウント保存の中身は、そもそも送られてこない（画面の側で送らない）。
-- ・だれの記録かは、次のどちらか（どちらもないときは記録しない）：
--     LINE … 公式LINE の LIFF から開き、Edge Function「sensei-line」が LINE に本人確認をした人（userId と表示名）
--     コード … line-hub の「その人専用のリンク」から開いた人（?c=lh-… の合言葉。だれかは line-hub の管理画面で分かる）
-- ・流したあと：Settings → API（Data API）→ Exposed schemas に sensei_usage を「追加」する（いまある名前は消さない）。
-- ・いちばん最後に「管理キー」が表示される（1回目だけ）。利用状況の画面（usage-admin.html）に貼って使う。
--   作り直すとき：select sensei_usage.issue_admin_key();（前のキーは使えなくなる）
-- ・やめるとき：先に Exposed schemas から sensei_usage を外す → そのあと supabase/sensei_usage_teardown.sql
--   （逆の順にすると、API 全体＝会員サイトも止まる）
-- 守っていること
-- ・公開用キー（anon）にできるのは「記録を送る」「本人確認の札を外のブラウザへ渡す」と、管理キーつきの集計だけ。表は直接読めない。
-- ・共有のデータベース（無料枠 500MB）を守るため、1日の件数・端末ごとの件数・全体の行数に上限を設ける。
-- ・管理キー・本人確認の札は、ハッシュだけを保存する。
-- =====================================================================================

begin;

create schema if not exists sensei_usage;
comment on schema sensei_usage is '先生の道具箱の利用の記録（公式LINE アラフォーの特典）。会員サイトとは別。sensei-kit/supabase/sensei_usage.sql';

-- ---------------------------------------------------------------- 表
create table if not exists sensei_usage.settings (
  id                     boolean primary key default true check (id),
  logging_enabled        boolean not null default true,
  max_events_per_day     integer not null default 20000,
  max_per_device_10min   integer not null default 300,
  max_rows               integer not null default 500000,      -- 全体の行数（1行は約100バイト＝約50MB）
  session_days           integer not null default 30,          -- 本人確認の札の有効日数
  admin_failures         integer not null default 0,
  admin_failed_at        timestamptz,
  updated_at             timestamptz not null default now()
);
insert into sensei_usage.settings (id) values (true) on conflict (id) do nothing;

create table if not exists sensei_usage.admin_keys (
  id          bigint generated always as identity primary key,
  salt        text not null,
  hash        text not null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create table if not exists sensei_usage.line_users (
  line_user_id  text primary key check (line_user_id ~ '^U[0-9a-f]{32}$'),
  display_name  text check (display_name is null or char_length(display_name) <= 100),
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  sign_ins      integer not null default 0
);
comment on table sensei_usage.line_users is 'LINE で本人確認できた人（userId と表示名だけ）';

create table if not exists sensei_usage.line_sessions (
  token_hash    text primary key,
  line_user_id  text not null references sensei_usage.line_users (line_user_id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index if not exists line_sessions_user_idx on sensei_usage.line_sessions (line_user_id);

-- LINE の中で本人確認をしたあと、外のブラウザ（Safari・Chrome）で開き直すときの、1回だけ使える受け渡しの札（10分）
create table if not exists sensei_usage.handoffs (
  code_hash     text primary key,
  line_user_id  text not null references sensei_usage.line_users (line_user_id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz
);

create table if not exists sensei_usage.events (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  device        text not null check (device ~ '^[A-Za-z0-9_-]{16,64}$'),
  line_user_id  text references sensei_usage.line_users (line_user_id) on delete cascade,
  code          text check (code is null or code ~ '^[A-Za-z0-9_-]{1,64}$'),
  app           text not null check (app ~ '^[a-z][a-z0-9-]{0,30}$'),
  action        text not null check (action ~ '^[a-z][a-z0-9_.:-]{0,40}$'),
  n             integer not null default 1 check (n between 1 and 1000),
  check (line_user_id is not null or code is not null)
);
create index if not exists events_at_idx on sensei_usage.events (at desc);
create index if not exists events_device_idx on sensei_usage.events (device, at desc);
create index if not exists events_user_idx on sensei_usage.events (line_user_id, at desc) where line_user_id is not null;
create index if not exists events_code_idx on sensei_usage.events (code, at desc) where code is not null;

create table if not exists sensei_usage.usage_day (
  day      date primary key,                 -- 日本時間
  events   integer not null default 0,
  refused  integer not null default 0
);

alter table sensei_usage.settings      enable row level security;
alter table sensei_usage.admin_keys    enable row level security;
alter table sensei_usage.line_users    enable row level security;
alter table sensei_usage.line_sessions enable row level security;
alter table sensei_usage.handoffs      enable row level security;
alter table sensei_usage.events        enable row level security;
alter table sensei_usage.usage_day     enable row level security;
-- ポリシーは作らない＝公開用キー・ログインした人からは、表を直接読めない・書けない（下の関数だけ）

-- ---------------------------------------------------------------- 内部の関数
create or replace function sensei_usage._hash(p text)
returns text language sql immutable set search_path = ''
as $$ select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex') $$;

create or replace function sensei_usage._clean(p text, maxlen integer)
returns text language sql immutable set search_path = ''
as $$ select nullif(btrim(left(regexp_replace(coalesce(p, ''), '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]', '', 'g'), maxlen)), '') $$;

-- 札（64桁の16進）から、本人確認できた人を出す（期限切れ・まちがいは null）
create or replace function sensei_usage._who(p_session text)
returns text language sql stable security definer set search_path = ''
as $$
  select s.line_user_id from sensei_usage.line_sessions s
   where p_session ~ '^[0-9a-f]{64}$' and s.token_hash = sensei_usage._hash(p_session) and s.expires_at > now()
$$;

create or replace function sensei_usage._admin_ok(p_key text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_key is not null and length(p_key) between 20 and 200 and exists (
       select 1 from sensei_usage.admin_keys k
        where k.revoked_at is null and k.hash = encode(sha256(convert_to(k.salt || p_key, 'UTF8')), 'hex')) then
    return true;
  end if;
  update sensei_usage.settings set admin_failures = admin_failures + 1, admin_failed_at = now() where id;
  return false;
end;
$$;

-- ---------------------------------------------------------------- 画面から呼ぶ：記録を送る（まとめて最大 50 件）
-- p = { session?: 札, code?: 合言葉, device: 端末の番号, events: [{ app, action, n? }] }
create or replace function sensei_usage.log_events(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  st       sensei_usage.settings;
  v_dev    text := p ->> 'device';
  v_code   text := nullif(p ->> 'code', '');
  v_sess   text := nullif(p ->> 'session', '');
  v_user   text;
  v_expired boolean := false;
  v_day    date := (now() at time zone 'Asia/Tokyo')::date;
  v_n      integer;
  v_recent integer;
  e        jsonb;
begin
  select * into st from sensei_usage.settings where id;
  if not st.logging_enabled then return jsonb_build_object('ok', false, 'error', 'off'); end if;
  if v_dev is null or v_dev !~ '^[A-Za-z0-9_-]{16,64}$' then return jsonb_build_object('ok', false, 'error', 'bad_device'); end if;
  if v_code is not null and v_code !~ '^[A-Za-z0-9_-]{1,64}$' then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  if jsonb_typeof(p -> 'events') <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_events'); end if;
  v_n := jsonb_array_length(p -> 'events');
  if v_n = 0 then return jsonb_build_object('ok', true, 'saved', 0); end if;
  if v_n > 50 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;

  if v_sess is not null then
    v_user := sensei_usage._who(v_sess);
    v_expired := v_user is null;
  end if;
  if v_user is null and v_code is null then return jsonb_build_object('ok', false, 'error', 'no_identity', 'expired', v_expired); end if;

  -- 上限：端末ごと（10分）・1日・全体
  select count(*) into v_recent from sensei_usage.events where device = v_dev and at > now() - interval '10 minutes';
  if v_recent + v_n > st.max_per_device_10min
     or coalesce((select events from sensei_usage.usage_day where day = v_day), 0) + v_n > st.max_events_per_day
     or (select count(*) from sensei_usage.events) + v_n > st.max_rows then
    insert into sensei_usage.usage_day as u (day, refused) values (v_day, v_n) on conflict (day) do update set refused = u.refused + v_n;
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;

  for e in select * from jsonb_array_elements(p -> 'events') loop
    if jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'app', '') !~ '^[a-z][a-z0-9-]{0,30}$'
       or coalesce(e ->> 'action', '') !~ '^[a-z][a-z0-9_.:-]{0,40}$'
       or (e ? 'n' and (jsonb_typeof(e -> 'n') <> 'number' or (e ->> 'n')::numeric not between 1 and 1000)) then
      raise exception 'bad_event' using errcode = '22023';
    end if;
    insert into sensei_usage.events (device, line_user_id, code, app, action, n)
    values (v_dev, v_user, v_code, e ->> 'app', e ->> 'action', coalesce((e ->> 'n')::integer, 1));
  end loop;
  insert into sensei_usage.usage_day as u (day, events) values (v_day, v_n) on conflict (day) do update set events = u.events + v_n;
  if v_user is not null then update sensei_usage.line_users set last_seen = now() where line_user_id = v_user; end if;
  return jsonb_build_object('ok', true, 'saved', v_n, 'who', case when v_user is not null then 'line' else 'code' end, 'expired', v_expired);
end;
$$;

-- ---------------------------------------------------------------- 本人確認のあと（Edge Function sensei-line だけが呼ぶ）
create or replace function sensei_usage.line_session_start(p_line_user_id text, p_display_name text default null)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_name  text := sensei_usage._clean(p_display_name, 100);
  v_days  integer := (select session_days from sensei_usage.settings where id);
begin
  if p_line_user_id is null or p_line_user_id !~ '^U[0-9a-f]{32}$' then return jsonb_build_object('ok', false, 'error', 'bad_user'); end if;
  insert into sensei_usage.line_users as u (line_user_id, display_name, sign_ins) values (p_line_user_id, v_name, 1)
  on conflict (line_user_id) do update set display_name = coalesce(excluded.display_name, u.display_name), last_seen = now(), sign_ins = u.sign_ins + 1;
  insert into sensei_usage.line_sessions (token_hash, line_user_id, expires_at) values (sensei_usage._hash(v_token), p_line_user_id, now() + make_interval(days => v_days));
  delete from sensei_usage.line_sessions where expires_at < now() - interval '1 day';
  delete from sensei_usage.handoffs where expires_at < now() - interval '1 day';
  return jsonb_build_object('ok', true, 'session', v_token, 'expires_in', v_days * 86400);
end;
$$;

-- LINE の中 → 外のブラウザへ：札を持っている人だけが、1回だけ使える受け渡しの札（10分）を作れる
create or replace function sensei_usage.handoff_create(p_session text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user text := sensei_usage._who(p_session);
  v_code text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if (select count(*) from sensei_usage.handoffs where line_user_id = v_user and created_at > now() - interval '10 minutes') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  insert into sensei_usage.handoffs (code_hash, line_user_id, expires_at) values (sensei_usage._hash(v_code), v_user, now() + interval '10 minutes');
  return jsonb_build_object('ok', true, 'code', v_code, 'expires_in', 600);
end;
$$;

create or replace function sensei_usage.handoff_redeem(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  h      sensei_usage.handoffs;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_days  integer := (select session_days from sensei_usage.settings where id);
  v_name  text;
begin
  if p_code is null or p_code !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  update sensei_usage.handoffs set used_at = now()
   where code_hash = sensei_usage._hash(p_code) and used_at is null and expires_at > now()
  returning * into h;
  if h.code_hash is null then return jsonb_build_object('ok', false, 'error', 'used_or_expired'); end if;
  insert into sensei_usage.line_sessions (token_hash, line_user_id, expires_at) values (sensei_usage._hash(v_token), h.line_user_id, now() + make_interval(days => v_days));
  select display_name into v_name from sensei_usage.line_users where line_user_id = h.line_user_id;
  return jsonb_build_object('ok', true, 'session', v_token, 'expires_in', v_days * 86400, 'name', v_name);
end;
$$;

-- ---------------------------------------------------------------- 管理キーつき：利用状況を見る
create or replace function sensei_usage.admin_status(p_key text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not sensei_usage._admin_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'bad_key'); end if;
  return jsonb_build_object('ok', true,
    'logging', (select logging_enabled from sensei_usage.settings where id),
    'events', (select count(*) from sensei_usage.events),
    'people_line', (select count(*) from sensei_usage.line_users),
    'codes', (select count(distinct code) from sensei_usage.events where code is not null),
    'today', coalesce((select events from sensei_usage.usage_day where day = (now() at time zone 'Asia/Tokyo')::date), 0),
    'refused_7d', coalesce((select sum(refused) from sensei_usage.usage_day where day > (now() at time zone 'Asia/Tokyo')::date - 7), 0));
end;
$$;

-- 期間の記録を、まとめて返す（画面で集計する。最大 20000 行）
create or replace function sensei_usage.admin_events(p_key text, p_since timestamptz default null, p_limit integer default 20000)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not sensei_usage._admin_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'bad_key'); end if;
  return jsonb_build_object('ok', true,
    'events', coalesce((select jsonb_agg(jsonb_build_array(extract(epoch from e.at)::bigint, e.line_user_id, e.code, e.app, e.action, e.n, e.device) order by e.at desc)
      from (select * from sensei_usage.events where p_since is null or at >= p_since order by at desc limit greatest(1, least(coalesce(p_limit, 20000), 20000))) e), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', u.line_user_id, 'name', u.display_name, 'first', u.first_seen, 'last', u.last_seen, 'sign_ins', u.sign_ins))
      from sensei_usage.line_users u), '[]'::jsonb));
end;
$$;

-- 人（LINE）またはコードの記録を消す
create or replace function sensei_usage.admin_forget(p_key text, p_line_user_id text default null, p_code text default null)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare n integer := 0;
begin
  if not sensei_usage._admin_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'bad_key'); end if;
  if p_line_user_id is not null then
    delete from sensei_usage.events where line_user_id = p_line_user_id;
    get diagnostics n = row_count;
    delete from sensei_usage.line_users where line_user_id = p_line_user_id;   -- 札・受け渡しの札も一緒に消える
  elsif p_code is not null then
    delete from sensei_usage.events where code = p_code and line_user_id is null;
    get diagnostics n = row_count;
  end if;
  return jsonb_build_object('ok', true, 'removed', n);
end;
$$;

create or replace function sensei_usage.admin_set_logging(p_key text, p_enabled boolean)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not sensei_usage._admin_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'bad_key'); end if;
  update sensei_usage.settings set logging_enabled = coalesce(p_enabled, true), updated_at = now() where id;
  return jsonb_build_object('ok', true, 'logging', coalesce(p_enabled, true));
end;
$$;

-- ---------------------------------------------------------------- 管理キーを作る（SQL Editor だけで使う）
create or replace function sensei_usage.issue_admin_key(p_revoke_others boolean default true)
returns text language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_key  text := 'su_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_salt text := replace(gen_random_uuid()::text, '-', '');
begin
  if p_revoke_others then update sensei_usage.admin_keys set revoked_at = now() where revoked_at is null; end if;
  insert into sensei_usage.admin_keys (salt, hash) values (v_salt, encode(sha256(convert_to(v_salt || v_key, 'UTF8')), 'hex'));
  update sensei_usage.settings set admin_failures = 0, admin_failed_at = null, updated_at = now() where id;
  return v_key;
end;
$$;

-- ---------------------------------------------------------------- 権限（このスキーマの中だけ）
revoke all on schema sensei_usage from public;
grant usage on schema sensei_usage to anon, authenticated, service_role;
revoke all on all tables in schema sensei_usage from public, anon, authenticated, service_role;
revoke all on all sequences in schema sensei_usage from public, anon, authenticated, service_role;
revoke all on all functions in schema sensei_usage from public, anon, authenticated, service_role;
grant execute on function sensei_usage.log_events(jsonb) to anon, authenticated;
grant execute on function sensei_usage.handoff_create(text) to anon, authenticated;
grant execute on function sensei_usage.handoff_redeem(text) to anon, authenticated;
grant execute on function sensei_usage.admin_status(text) to anon, authenticated;
grant execute on function sensei_usage.admin_events(text, timestamptz, integer) to anon, authenticated;
grant execute on function sensei_usage.admin_forget(text, text, text) to anon, authenticated;
grant execute on function sensei_usage.admin_set_logging(text, boolean) to anon, authenticated;
grant execute on function sensei_usage.line_session_start(text, text) to service_role;   -- Edge Function だけ
-- _hash・_clean・_who・_admin_ok・issue_admin_key は、公開用キーからは呼べない（SQL Editor の postgres だけ）

commit;

notify pgrst, 'reload schema';

select case
  when exists (select 1 from sensei_usage.admin_keys where revoked_at is null)
    then '（管理キーは発行ずみです。作り直すときは  select sensei_usage.issue_admin_key();  を実行。前のキーは使えなくなります）'
  else sensei_usage.issue_admin_key()
end as "管理キー（利用状況の画面に貼る）";
