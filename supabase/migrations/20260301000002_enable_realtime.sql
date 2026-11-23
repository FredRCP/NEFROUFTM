-- ============================================================
-- NEFRO-UFTM — Habilitar Supabase Realtime
-- Rodar DEPOIS do schema.sql, uma única vez.
-- Necessário para o dashboard atualizar em tempo real entre
-- os médicos (Seção 1.2 da especificação).
-- ============================================================

alter publication supabase_realtime add table public.acompanhamentos_nefro;
alter publication supabase_realtime add table public.pendencias;
alter publication supabase_realtime add table public.internacoes;
