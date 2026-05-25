insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instruction-images',
  'instruction-images',
  true,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.robot_instruction_images (
  id uuid primary key default gen_random_uuid(),
  instruction_id text references public.robot_instructions(id) on delete cascade,
  group_id text references public.robot_groups(id) on delete cascade,
  storage_bucket text not null default 'instruction-images',
  storage_path text not null,
  public_url text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists robot_instruction_images_instruction_id_idx
  on public.robot_instruction_images(instruction_id);

create index if not exists robot_instruction_images_group_id_idx
  on public.robot_instruction_images(group_id);

alter table public.robot_instruction_images enable row level security;

drop policy if exists "Instruction images are publicly readable" on storage.objects;
drop policy if exists "Authenticated users upload instruction images" on storage.objects;
drop policy if exists "Authenticated users update own instruction images" on storage.objects;
drop policy if exists "Authenticated users delete own instruction images" on storage.objects;

create policy "Instruction images are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'instruction-images');

create policy "Authenticated users upload instruction images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'instruction-images');

create policy "Authenticated users update own instruction images"
on storage.objects
for update
to authenticated
using (bucket_id = 'instruction-images' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'instruction-images' and owner_id = (select auth.uid()::text));

create policy "Authenticated users delete own instruction images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'instruction-images' and owner_id = (select auth.uid()::text));

drop policy if exists "Instruction image metadata is readable" on public.robot_instruction_images;
drop policy if exists "Authenticated users manage instruction image metadata" on public.robot_instruction_images;

create policy "Instruction image metadata is readable"
on public.robot_instruction_images
for select
to public
using (true);

create policy "Authenticated users manage instruction image metadata"
on public.robot_instruction_images
for all
to authenticated
using (true)
with check (true);
