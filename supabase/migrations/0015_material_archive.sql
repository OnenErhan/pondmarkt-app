alter table public.materials
  add column if not exists active boolean;

update public.materials
   set active = true
 where active is null;

alter table public.materials
  alter column active set default true;

alter table public.materials
  alter column active set not null;

create index if not exists idx_materials_active on public.materials(active);