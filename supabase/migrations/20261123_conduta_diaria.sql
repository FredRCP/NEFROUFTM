-- Conduta do dia: começa sem valor ("Definir conduta") e é zerada à meia-noite (horário de Brasília)
alter table public.acompanhamentos_nefro alter column situacao_dialitica drop default;
alter table public.acompanhamentos_nefro alter column situacao_dialitica drop not null;

-- Zera a conduta todo dia às 00:00 de Brasília (03:00 UTC).
-- Se o job já existir com esse nome, rode antes: select cron.unschedule('reset-conduta-diaria');
select cron.schedule(
  'reset-conduta-diaria',
  '0 3 * * *',
  $$update public.acompanhamentos_nefro set situacao_dialitica = null$$
);

-- Opcional, uma única vez, para zerar a conduta de hoje agora:
-- update public.acompanhamentos_nefro set situacao_dialitica = null where ativo = true;

notify pgrst, 'reload schema';
