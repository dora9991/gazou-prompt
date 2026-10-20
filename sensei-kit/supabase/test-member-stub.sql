-- 手元のテスト用だけ（本番には流さない）：会員サイトの profiles のまね。
-- 本番の public.profiles は会員サイトの SQL が作る。ここでは sensei.sql が使う列（id・suspended_at）と、
-- アカウントができたら profiles を作るトリガー（会員サイトの handle_new_user と同じ動き）だけをまねる。
-- user_metadata.app = 'hogosha' の人には作らない（保護者会アプリのガードと同じ結果）。
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  suspended_at timestamptz
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'app', '') = 'hogosha' then return new; end if;
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.current_plan_rank(uid uuid default auth.uid()) returns int language sql stable as $$ select 0 $$;
