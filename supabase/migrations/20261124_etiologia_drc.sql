-- Amplia as etiologias de DRC aceitas em pacientes.etiologia_drc.
-- Mantém todos os valores já existentes e acrescenta:
--   Congenita_hereditaria, Doenca_renal_policistica, Nefropatia_por_refluxo
-- Seguro para rodar mais de uma vez.

begin;

alter table public.pacientes
  drop constraint if exists pacientes_etiologia_drc_check;

alter table public.pacientes
  add constraint pacientes_etiologia_drc_check check (etiologia_drc in (
    'Nefropatia_diabetica', 'Nefroesclerose_hipertensiva', 'DRPAD',
    'Glomerulopatia', 'Nefrite_tubulo_intersticial', 'Obstrutiva',
    'Indeterminada', 'Outras',
    'Congenita_hereditaria', 'Doenca_renal_policistica', 'Nefropatia_por_refluxo'
  ));

commit;

-- Recarrega o schema da API (PostgREST)
notify pgrst, 'reload schema';
