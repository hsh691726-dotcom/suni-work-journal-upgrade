create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  title text not null,
  category text not null default '기타',
  status text not null default '예정',
  priority text not null default '보통',
  amount numeric not null default 0,
  vendor text not null default '',
  repeat_monthly text not null default '아니오',
  repeat_day integer,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_entries_work_date_idx on public.work_entries (work_date);
create index if not exists work_entries_status_idx on public.work_entries (status);
create index if not exists work_entries_category_idx on public.work_entries (category);

alter table public.work_entries enable row level security;

drop policy if exists "allow anonymous read work entries" on public.work_entries;
drop policy if exists "allow anonymous insert work entries" on public.work_entries;
drop policy if exists "allow anonymous update work entries" on public.work_entries;
drop policy if exists "allow anonymous delete work entries" on public.work_entries;

create policy "allow anonymous read work entries"
on public.work_entries for select
to anon
using (true);

create policy "allow anonymous insert work entries"
on public.work_entries for insert
to anon
with check (true);

create policy "allow anonymous update work entries"
on public.work_entries for update
to anon
using (true)
with check (true);

create policy "allow anonymous delete work entries"
on public.work_entries for delete
to anon
using (true);
