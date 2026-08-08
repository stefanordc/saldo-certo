-- Saldo Certo - transacoes insertion timestamps and date range guard
-- Run this in Supabase SQL Editor for the existing database.

begin;

alter table public.transacoes
  add column if not exists data_insercao timestamptz,
  add column if not exists criado_em timestamptz;

update public.transacoes
set
  data_insercao = coalesce(data_insercao, created_at, now()),
  criado_em = coalesce(criado_em, data_insercao, created_at, now())
where data_insercao is null
   or criado_em is null;

alter table public.transacoes
  alter column data_insercao set default now(),
  alter column data_insercao set not null,
  alter column criado_em set default now(),
  alter column criado_em set not null;

alter table public.transacoes
  drop constraint if exists transacoes_data_contabil_range,
  drop constraint if exists transacoes_data_competencia_range;

alter table public.transacoes
  add constraint transacoes_data_contabil_range
    check (data_contabil between date '1900-01-01' and date '3099-12-31') not valid,
  add constraint transacoes_data_competencia_range
    check (data_competencia between date '1900-01-01' and date '3099-12-31') not valid;

commit;
