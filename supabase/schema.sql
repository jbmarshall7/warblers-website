-- ============================================================
-- Warblers Meadery — Supabase schema
-- Paste this whole file into: Supabase dashboard → SQL Editor → Run
--
-- Security model (Row Level Security, enforced ON THE SERVER):
--   anonymous visitors  → may READ approved mural patches,
--                         SUBMIT new pending patches,
--                         file a report flag, send a contact message.
--                         They can NEVER update, delete, approve,
--                         or read pending/unmoderated content.
--   authenticated user  → full control. With sign-ups disabled in
--                         Auth settings, the ONLY authenticated user
--                         is you — so "authenticated" = admin.
--                         (Do not skip the "disable sign ups" step!)
-- ============================================================

-- ---------- the mural ----------
create table public.mural_regions (
  id         uuid primary key default gen_random_uuid(),
  status     text not null default 'pending' check (status in ('pending','approved')),
  x          int  not null check (x between 0 and 11),  -- grid col, 0-based
  y          int  not null check (y >= 0),              -- grid row, 0-based
  w          int  not null check (w between 1 and 4),
  h          int  not null check (h between 1 and 3),
  art        text check (art is null or length(art) < 400000), -- transparent PNG data-URL (strokes only)
  text       text not null default '' check (length(text) <= 60),
  name       text not null default '' check (length(name) <= 40),
  z          int  not null default 0,                   -- layering order (admin curated; higher = front)
  visitor    text not null,                             -- anonymous visitor id (self-issued)
  created_at timestamptz not null default now()
);
alter table public.mural_regions enable row level security;

create policy "public reads approved patches"
  on public.mural_regions for select
  using (status = 'approved');

create policy "public submits pending patches"
  on public.mural_regions for insert
  with check (status = 'pending');

create policy "admin has full control of patches"
  on public.mural_regions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------- report flags (insert-only for the public) ----------
create table public.mural_flags (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid not null references public.mural_regions (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.mural_flags enable row level security;

create policy "public files a report"
  on public.mural_flags for insert
  with check (true);

create policy "admin reads and clears reports"
  on public.mural_flags for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------- contact form messages ----------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 80),
  email      text not null check (length(email) between 3 and 200),
  reason     text not null default 'General question' check (length(reason) <= 60),
  message    text not null check (length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

create policy "public sends a message"
  on public.contact_messages for insert
  with check (true);

create policy "admin reads and deletes messages"
  on public.contact_messages for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
