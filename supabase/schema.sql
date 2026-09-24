-- One deliberately public collaborative workspace. Direct Data API access is
-- disabled; the bounded Edge Function validates documents before calling RPC.
create table public.travel_workspaces (
  id text primary key check (id = 'main'),
  version bigint not null check (version >= 0),
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) < 2000000),
  updated_at timestamptz not null default now()
);
create table public.travel_revisions (
  workspace_id text not null references public.travel_workspaces(id),
  version bigint not null,
  document jsonb not null,
  request_id uuid unique,
  created_at timestamptz not null default now(),
  primary key (workspace_id, version)
);
alter table public.travel_workspaces enable row level security;
alter table public.travel_revisions enable row level security;
revoke all on public.travel_workspaces, public.travel_revisions from public, anon, authenticated;
grant all on public.travel_workspaces, public.travel_revisions to service_role;
create policy service_access on public.travel_workspaces to service_role using (true) with check (true);
create policy service_access on public.travel_revisions to service_role using (true) with check (true);

create function public.travel_save(expected_version bigint, next_document jsonb, mutation_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.travel_workspaces; next_version bigint;
begin
  select * into current_row from public.travel_workspaces where id = 'main' for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if exists (select 1 from public.travel_revisions where request_id = mutation_id) then
    return jsonb_build_object('status','ok','version',current_row.version,'document',current_row.document,'updatedAt',current_row.updated_at);
  end if;
  if current_row.version <> expected_version then
    return jsonb_build_object('status','conflict','version',current_row.version,'document',current_row.document,'updatedAt',current_row.updated_at);
  end if;
  if mutation_id is null or jsonb_typeof(next_document) <> 'object' or next_document->>'schemaVersion' <> '1' then
    raise exception 'Invalid document';
  end if;
  next_version := current_row.version + 1;
  next_document := jsonb_set(next_document, '{revision}', to_jsonb(next_version));
  update public.travel_workspaces set version = next_version, document = next_document, updated_at = now() where id = 'main';
  insert into public.travel_revisions(workspace_id,version,document,request_id) values ('main',next_version,next_document,mutation_id);
  delete from public.travel_revisions where workspace_id = 'main' and version < next_version - 99;
  return jsonb_build_object('status','ok','version',next_version,'document',next_document,'updatedAt',now());
end;
$$;
revoke all on function public.travel_save(bigint,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.travel_save(bigint,jsonb,uuid) to service_role;
