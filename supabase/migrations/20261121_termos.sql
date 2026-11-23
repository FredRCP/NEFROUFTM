-- Aceite de Termo de Uso e Política de Privacidade (LGPD)
-- Rodar no SQL Editor do Supabase.

-- 1) Colunas de estado atual em medicos
alter table public.medicos add column if not exists termo_versao text;
alter table public.medicos add column if not exists termo_aceito_em timestamptz;

-- 2) Histórico de aceites (prova do consentimento). Ninguém escreve direto:
--    só a função abaixo, e o app não lê esta tabela.
create table if not exists public.termo_aceites (
  id bigserial primary key,
  medico_id uuid not null references public.medicos(id) on delete cascade,
  versao text not null,
  aceito_em timestamptz not null default now()
);
alter table public.termo_aceites enable row level security;

-- 3) Função de aceite: roda com privilégio do dono, mas só altera o próprio usuário
create or replace function public.aceitar_termo(p_versao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  update public.medicos
     set termo_versao = p_versao,
         termo_aceito_em = now()
   where id = auth.uid();

  if not found then
    raise exception 'usuário sem cadastro em medicos';
  end if;

  insert into public.termo_aceites (medico_id, versao)
  values (auth.uid(), p_versao);
end;
$$;

revoke execute on function public.aceitar_termo(text) from public, anon;
grant execute on function public.aceitar_termo(text) to authenticated;

-- Recarrega o cache da API do Supabase para a função aparecer imediatamente
notify pgrst, 'reload schema';
