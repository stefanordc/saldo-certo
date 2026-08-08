-- Saldo Certo - Supabase pre-migration patch
-- Run this in Supabase SQL Editor after a backup and before importing MySQL data.
-- The corretoras block recreates the table only when its id column is still bigint.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.naturezas (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.decisoes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade
);

alter table public.naturezas
  add column if not exists created_at timestamptz default now(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.decisoes
  add column if not exists created_at timestamptz default now(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.transacoes
  add column if not exists conta_destino_id uuid references public.cartoes(id) on delete set null,
  add column if not exists natureza_id uuid references public.naturezas(id) on delete set null,
  add column if not exists decisao_id uuid references public.decisoes(id) on delete set null,
  add column if not exists criado_em timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'corretoras'
      and column_name = 'id'
      and data_type = 'bigint'
  ) then
    drop table if exists public.corretoras cascade;

    create table public.corretoras (
      id uuid primary key default uuid_generate_v4(),
      nome text not null,
      created_at timestamptz default now(),
      user_id uuid
    );

    alter table public.corretoras enable row level security;
  end if;
end $$;

alter table public.orcamentos
  add column if not exists mes text,
  add column if not exists subcategoria_id uuid references public.subcategorias(id) on delete set null;

alter table public.contas_receber
  add column if not exists cartao_id uuid references public.cartoes(id) on delete set null,
  add column if not exists categoria_id uuid references public.categorias(id) on delete set null,
  add column if not exists subcategoria_id uuid references public.subcategorias(id) on delete set null,
  add column if not exists status_id uuid references public.status_compra(id) on delete set null,
  add column if not exists perfil_id uuid references public.perfis_despesa(id) on delete set null,
  add column if not exists forma_id uuid references public.formas_pagamento(id) on delete set null,
  add column if not exists recorrente boolean default false,
  add column if not exists frequencia text,
  add column if not exists data_fim date,
  add column if not exists data_liquidacao date;

alter table public.contas_pagar
  add column if not exists cartao_id uuid references public.cartoes(id) on delete set null,
  add column if not exists categoria_id uuid references public.categorias(id) on delete set null,
  add column if not exists subcategoria_id uuid references public.subcategorias(id) on delete set null,
  add column if not exists status_id uuid references public.status_compra(id) on delete set null,
  add column if not exists perfil_id uuid references public.perfis_despesa(id) on delete set null,
  add column if not exists forma_id uuid references public.formas_pagamento(id) on delete set null,
  add column if not exists recorrente boolean default false,
  add column if not exists frequencia text,
  add column if not exists data_fim date,
  add column if not exists data_liquidacao date;

alter table public.lista_desejos
  add column if not exists forma_id uuid references public.formas_pagamento(id) on delete set null,
  add column if not exists parcelado text default 'nao',
  add column if not exists parcelas integer default 1;

alter table public.movimentos_inv
  add column if not exists modalidade text,
  add column if not exists observacoes text;

alter table public.dividendos
  add column if not exists tipo text;

alter table public.perfis_usuario enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'perfis_usuario'
      and policyname = 'perfis_usuario_owner_all'
  ) then
    create policy perfis_usuario_owner_all
      on public.perfis_usuario
      for all
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;

do $$
declare
  t text;
  p text;
begin
  foreach t in array array[
    'cartoes',
    'categorias',
    'subcategorias',
    'formas_pagamento',
    'tipos_pagamento',
    'perfis_despesa',
    'naturezas',
    'decisoes',
    'status_compra',
    'transacoes',
    'orcamentos',
    'metas',
    'contas_receber',
    'contas_pagar',
    'lista_desejos',
    'corretoras',
    'modalidades_inv',
    'movimentos_inv',
    'dividendos'
  ] loop
    p := t || '_owner_all';

    execute format('alter table public.%I enable row level security', t);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = p
    ) then
      execute format(
        'create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
        p,
        t
      );
    end if;
  end loop;
end $$;

insert into public.naturezas (nome, user_id)
select v.nome, u.id
from auth.users u
cross join (values
  ('Renda'),
  ('Neutro'),
  ('Transferência'),
  ('Supérfluo'),
  ('Conveniência'),
  ('Recuperação'),
  ('Essencial'),
  ('Qualidade de vida')
) as v(nome)
where not exists (
  select 1
  from public.naturezas n
  where n.user_id = u.id
    and lower(n.nome) = lower(v.nome)
);

insert into public.decisoes (nome, user_id)
select v.nome, u.id
from auth.users u
cross join (values
  ('Eventual'),
  ('Transferência'),
  ('Impulsivo'),
  ('Recorrente')
) as v(nome)
where not exists (
  select 1
  from public.decisoes d
  where d.user_id = u.id
    and lower(d.nome) = lower(v.nome)
);
