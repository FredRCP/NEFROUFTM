-- ============================================================
-- NEFRO-UFTM — Migration: título do médico (Dr./Dra.)
-- Rodar no SQL Editor do Supabase, depois do schema.sql original.
-- Não derruba dados existentes.
-- ============================================================

alter table public.medicos add column if not exists titulo text check (titulo in ('Dr', 'Dra')) default 'Dr';

comment on column public.medicos.titulo is 'Usado para exibir "Dr. Nome" ou "Dra. Nome" na topbar.';

-- Defina o título correto para cada médico já cadastrado, por exemplo:
-- update public.medicos set titulo = 'Dra' where id = 'UUID-AQUI';
