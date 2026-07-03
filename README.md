# NEFRO-UFTM — Folhão Digital

Sistema de gestão da interconsulta nefrológica — equipe de nefrologia do HC-UFTM.
Substitui o "folhão" físico A3 por um PWA colaborativo com atualização em tempo real.

Especificação funcional completa: ver `folhao-digital-spec.md` (documento separado, v1.2).

## Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, região São Paulo `sa-east-1`)
- **Auth**: Supabase Auth (e-mail + senha)
- **Tempo real**: Supabase Realtime (a configurar nas próximas fases)
- **Deploy**: Vercel ou Netlify

## Setup local

### 1. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha `.env.local` com a URL e a chave `anon` do seu projeto Supabase
(Project Settings → API).

### 2. Instalar dependências

```bash
npm install
```

### 3. Rodar o schema no Supabase

No painel do Supabase, vá em **SQL Editor** e cole o conteúdo de `schema.sql`.
Execute. Isso cria todas as tabelas, triggers e políticas de RLS da Fase 1.

### 4. Criar o primeiro médico

Depois de criar seu usuário em **Authentication → Users** (ou pela própria
tela de login, se você habilitar signup), rode no SQL Editor:

```sql
insert into public.medicos (id, nome, crm, ativo)
values ('UUID-DO-USUARIO-AQUI', 'Seu Nome', 'CRM-MG 00000', true);
```

O UUID é encontrado na lista de usuários em Authentication → Users.

> Sem essa linha em `medicos`, o login funciona mas o RLS bloqueia
> qualquer acesso a dados — é a trava de segurança que restringe o
> sistema aos 7 nefrologistas da equipe (ver Seção 2 da especificação).

### 5. Rodar localmente

```bash
npm run dev
```

Acesse http://localhost:3000 — vai redirecionar para `/login`.

## Status atual (Fase 1 — em andamento)

- [x] Schema do banco (pacientes, internações, acompanhamentos, evoluções,
      pendências, auditoria) com RLS
- [x] Autenticação e-mail/senha
- [x] Middleware de proteção de rotas
- [ ] Dashboard com cards por setor
- [ ] Cadastro de paciente com verificação de duplicidade por RG
- [ ] Evoluções, pendências, marcação de "avaliado hoje"
- [ ] Busca global
- [ ] Indicadores agregados no topo do dashboard

Ver roadmap completo na Seção 13 da especificação funcional.
