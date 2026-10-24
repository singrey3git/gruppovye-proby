-- Схема для групповых проб. Выполнить один раз: Supabase → SQL Editor → New query → вставить → Run.

create extension if not exists pgcrypto;

-- Сессия = один групповой запуск теста преподавателем. По её коду дети заходят по ссылке.
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  teacher_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default '',
  opts        jsonb not null default '{}'::jsonb,
  status      text not null default 'open' check (status in ('open','closed')),
  created_at  timestamptz not null default now()
);

-- Ребёнок в сессии. token нужен, чтобы ребёнок мог продолжить после перезагрузки страницы.
create table if not exists public.participants (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  name        text not null,
  birth       date,
  token       uuid not null default gen_random_uuid(),
  joined_at   timestamptz not null default now()
);
create index if not exists participants_session_idx on public.participants(session_id);
-- Этап ребёнка: r1 — проходит тесты, results — видит свои результаты, r2 — второй этап (перерешивание).
-- Меняет только преподаватель.
alter table public.participants add column if not exists stage text not null default 'r1';
-- Номер ребёнка из 4 цифр: по нему можно вернуться, если ссылка потерялась. Уникален внутри запуска.
alter table public.participants add column if not exists pin text;
do $$ declare r record; c text; begin
  for r in select id, session_id from public.participants where pin is null loop
    loop
      c := lpad(floor(random() * 10000)::int::text, 4, '0');
      exit when not exists (select 1 from public.participants where session_id = r.session_id and pin = c);
    end loop;
    update public.participants set pin = c where id = r.id;
  end loop;
end $$;
create unique index if not exists participants_pin_idx on public.participants(session_id, pin);
do $$ begin
  alter table public.participants add constraint participants_stage_check check (stage in ('r1','results','r2'));
exception when duplicate_object then null; end $$;

-- Журнал прохождения: начало пробы, неудачная попытка, конец пробы, конец теста.
create table if not exists public.events (
  id              bigint generated always as identity primary key,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  kind            text not null,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists events_session_idx on public.events(session_id);

alter table public.sessions     enable row level security;
alter table public.participants enable row level security;
alter table public.events       enable row level security;

-- Преподаватель видит и меняет только свои сессии и их данные.
drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "own participants" on public.participants;
create policy "own participants" on public.participants
  for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.teacher_id = auth.uid()));

drop policy if exists "own participants delete" on public.participants;
create policy "own participants delete" on public.participants
  for delete to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.teacher_id = auth.uid()));

drop policy if exists "own participants stage" on public.participants;
create policy "own participants stage" on public.participants
  for update to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.teacher_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.teacher_id = auth.uid()));

drop policy if exists "own events" on public.events;
create policy "own events" on public.events
  for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.teacher_id = auth.uid()));

-- Дети не входят в систему. Они работают только через эти функции,
-- и напрямую читать или менять таблицы не могут.

create or replace function public.session_info(p_code text)
returns json language sql security definer set search_path = public as $$
  select json_build_object('code', code, 'title', title, 'opts', opts, 'status', status)
  from sessions where code = upper(trim(p_code));
$$;

create or replace function public.join_session(p_code text, p_name text, p_birth date)
returns json language plpgsql security definer set search_path = public as $$
declare s sessions; p participants; n int; c text;
begin
  select * into s from sessions where code = upper(trim(p_code));
  if not found then raise exception 'session_not_found'; end if;
  if s.status <> 'open' then raise exception 'session_closed'; end if;
  if coalesce(length(trim(p_name)), 0) = 0 then raise exception 'name_required'; end if;
  select count(*) into n from participants where session_id = s.id;
  if n >= 300 then raise exception 'session_full'; end if;
  loop
    c := lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from participants where session_id = s.id and pin = c);
  end loop;
  insert into participants(session_id, name, birth, pin)
    values (s.id, left(trim(p_name), 60), p_birth, c) returning * into p;
  return json_build_object('pid', p.id, 'token', p.token, 'pin', p.pin);
end $$;

-- Вернуться по номеру: код запуска + 4 цифры. Работает и когда вход для новых закрыт.
create or replace function public.rejoin_session(p_code text, p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare p participants;
begin
  select pt.* into p from participants pt join sessions s on s.id = pt.session_id
    where s.code = upper(trim(p_code)) and pt.pin = trim(p_pin);
  if not found then raise exception 'pin_not_found'; end if;
  return json_build_object('pid', p.id, 'token', p.token, 'pin', p.pin);
end $$;

create or replace function public.log_event(p_pid uuid, p_token uuid, p_kind text, p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare sid uuid; new_id bigint;
begin
  select session_id into sid from participants where id = p_pid and token = p_token;
  if not found then raise exception 'bad_token'; end if;
  if p_kind not in ('probe_start', 'attempt', 'probe_end', 'finish') then raise exception 'bad_kind'; end if;
  if octet_length(p_data::text) > 8000 then raise exception 'too_big'; end if;
  insert into events(session_id, participant_id, kind, data)
    values (sid, p_pid, p_kind, coalesce(p_data, '{}'::jsonb)) returning id into new_id;
  return new_id;
end $$;

create or replace function public.resume_participant(p_pid uuid, p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare p participants; s sessions;
begin
  select * into p from participants where id = p_pid and token = p_token;
  if not found then raise exception 'bad_token'; end if;
  select * into s from sessions where id = p.session_id;
  return json_build_object(
    'participant', json_build_object('id', p.id, 'name', p.name, 'birth', p.birth, 'stage', p.stage, 'pin', p.pin),
    'session', json_build_object('code', s.code, 'title', s.title, 'opts', s.opts, 'status', s.status),
    'events', coalesce((select json_agg(json_build_object('kind', e.kind, 'data', e.data) order by e.id)
                        from events e where e.participant_id = p.id), '[]'::json)
  );
end $$;

create or replace function public.kid_state(p_pid uuid, p_token uuid)
returns text language sql security definer set search_path = public as $$
  select stage from participants where id = p_pid and token = p_token;
$$;

revoke all on function public.kid_state(uuid, uuid) from public;
grant execute on function public.kid_state(uuid, uuid) to anon, authenticated;
revoke all on function public.session_info(text) from public;
revoke all on function public.join_session(text, text, date) from public;
revoke all on function public.log_event(uuid, uuid, text, jsonb) from public;
revoke all on function public.rejoin_session(text, text) from public;
grant execute on function public.rejoin_session(text, text) to anon, authenticated;
revoke all on function public.resume_participant(uuid, uuid) from public;
grant execute on function public.session_info(text) to anon, authenticated;
grant execute on function public.join_session(text, text, date) to anon, authenticated;
grant execute on function public.log_event(uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.resume_participant(uuid, uuid) to anon, authenticated;

-- Чтобы карта у преподавателя обновлялась сама.
do $$ begin
  begin alter publication supabase_realtime add table public.participants; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.events; exception when duplicate_object then null; end;
end $$;
