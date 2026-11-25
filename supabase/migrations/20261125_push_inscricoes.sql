-- Inscrições de notificação push (aviso das 16h30) por aparelho do médico.
-- Seguro para rodar mais de uma vez.

begin;

create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medicos(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

alter table public.push_inscricoes enable row level security;

drop policy if exists "medico gerencia a propria inscricao" on public.push_inscricoes;
create policy "medico gerencia a propria inscricao"
  on public.push_inscricoes
  for all
  using (medico_id = auth.uid())
  with check (medico_id = auth.uid());

commit;

notify pgrst, 'reload schema';
