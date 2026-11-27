-- Diurese não anotada: marca o dia com justificativa, sem volume.
-- Idempotente: pode rodar mais de uma vez.

alter table public.diureses add column if not exists sem_registro boolean not null default false;
alter table public.diureses add column if not exists justificativa text;
alter table public.diureses alter column volume_ml drop not null;
alter table public.diureses alter column horas drop not null;

notify pgrst, 'reload schema';
