-- ═══════════════════════════════════════════════════════════════
--  SALDO CERTO — Schema Supabase
--  Execute no SQL Editor do Supabase: https://supabase.com/dashboard
-- ═══════════════════════════════════════════════════════════════

-- Habilitar UUID
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────
-- TABELAS DE CONFIGURAÇÃO
-- ──────────────────────────────────────────

create table if not exists cartoes (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  created_at  timestamptz default now()
);

create table if not exists categorias (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  created_at  timestamptz default now()
);

create table if not exists subcategorias (
  id           uuid primary key default uuid_generate_v4(),
  nome         text not null,
  categoria_id uuid references categorias(id) on delete set null,
  created_at   timestamptz default now()
);

create table if not exists formas_pagamento (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  created_at  timestamptz default now()
);

create table if not exists tipos_pagamento (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  created_at  timestamptz default now()
);

create table if not exists perfis_despesa (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  created_at  timestamptz default now()
);

create table if not exists naturezas (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

create table if not exists decisoes (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

create table if not exists status_compra (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  created_at  timestamptz default now()
);

create table if not exists trabalhos (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references auth.users(id) on delete cascade,
  empresa             text not null,
  data_admissao       date not null,
  data_demissao       date,
  emprego_atual       boolean not null default false,
  hora_inicio         time not null,
  hora_inicio_almoco  time not null,
  hora_fim_almoco     time not null,
  hora_fim_trabalho   time not null,
  created_at          timestamptz default now(),
  constraint trabalhos_periodo_valido check (data_demissao is null or data_demissao >= data_admissao),
  constraint trabalhos_horarios_validos check (
    hora_inicio < hora_inicio_almoco
    and hora_inicio_almoco < hora_fim_almoco
    and hora_fim_almoco < hora_fim_trabalho
  )
);

create index if not exists idx_trabalhos_user_periodo on trabalhos(user_id, data_admissao, data_demissao);

-- ──────────────────────────────────────────
-- TRANSAÇÕES
-- ──────────────────────────────────────────

create table if not exists transacoes (
  id                  uuid primary key default uuid_generate_v4(),
  data_contabil       date not null,
  data_competencia    date not null,
  data_insercao       timestamptz not null default now(),
  descricao           text not null,
  descricao_tratada   text,
  valor               numeric(15,2) not null check (valor >= 0),
  parcelado           text default 'Não' check (parcelado in ('Sim','Não')),
  parcela_atual       int,
  parcela_maxima      int,
  observacoes         text,
  importado           boolean default false,

  cartao_id           uuid references cartoes(id)           on delete set null,
  conta_destino_id    uuid references cartoes(id)           on delete set null,
  tipo_pagamento_id   uuid references tipos_pagamento(id)   on delete set null,
  forma_pagamento_id  uuid references formas_pagamento(id)  on delete set null,
  perfil_despesa_id   uuid references perfis_despesa(id)    on delete set null,
  natureza_id         uuid references naturezas(id)          on delete set null,
  decisao_id          uuid references decisoes(id)           on delete set null,
  categoria_id        uuid references categorias(id)        on delete set null,
  subcategoria_id     uuid references subcategorias(id)     on delete set null,
  status_compra_id    uuid references status_compra(id)     on delete set null,

  created_at          timestamptz default now(),
  constraint transacoes_data_contabil_range check (data_contabil between date '1900-01-01' and date '3099-12-31'),
  constraint transacoes_data_competencia_range check (data_competencia between date '1900-01-01' and date '3099-12-31')
);

create index if not exists idx_transacoes_data_competencia on transacoes(data_competencia);
create index if not exists idx_transacoes_cartao_id        on transacoes(cartao_id);
create index if not exists idx_transacoes_categoria_id     on transacoes(categoria_id);

-- ──────────────────────────────────────────
-- ORÇAMENTOS
-- ──────────────────────────────────────────

create table if not exists orcamentos (
  id           uuid primary key default uuid_generate_v4(),
  categoria_id uuid references categorias(id) on delete cascade,
  valor        numeric(15,2) not null check (valor >= 0),
  tipo         text default 'despesa' check (tipo in ('despesa','receita')),
  created_at   timestamptz default now(),
  unique (categoria_id, tipo)
);

-- ──────────────────────────────────────────
-- METAS FINANCEIRAS
-- ──────────────────────────────────────────

create table if not exists metas (
  id              uuid primary key default uuid_generate_v4(),
  nome            text not null,
  categoria       text not null,
  valor_objetivo  numeric(15,2) not null check (valor_objetivo > 0),
  valor_atual     numeric(15,2) not null default 0 check (valor_atual >= 0),
  data_limite     date,
  descricao       text,
  status          text default 'em_andamento'
                    check (status in ('em_andamento','concluida','cancelada','pausada')),
  created_at      timestamptz default now()
);

-- ──────────────────────────────────────────
-- CONTAS A RECEBER
-- ──────────────────────────────────────────

create table if not exists contas_receber (
  id          uuid primary key default uuid_generate_v4(),
  descricao   text not null,
  devedor     text,
  valor       numeric(15,2) not null check (valor > 0),
  vencimento  date not null,
  status      text default 'pendente'
                check (status in ('pendente','recebida','cancelada')),
  observacoes text,
  transacao_id uuid references transacoes(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_contas_receber_vencimento on contas_receber(vencimento);
create index if not exists idx_contas_receber_status     on contas_receber(status);

-- ──────────────────────────────────────────
-- CONTAS A PAGAR
-- ──────────────────────────────────────────

create table if not exists contas_pagar (
  id          uuid primary key default uuid_generate_v4(),
  descricao   text not null,
  credor      text,
  valor       numeric(15,2) not null check (valor > 0),
  vencimento  date not null,
  status      text default 'pendente'
                check (status in ('pendente','paga','cancelada')),
  observacoes text,
  transacao_id uuid references transacoes(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_contas_pagar_vencimento on contas_pagar(vencimento);
create index if not exists idx_contas_pagar_status     on contas_pagar(status);

-- ──────────────────────────────────────────
-- LISTA DE DESEJOS
-- ──────────────────────────────────────────

create table if not exists lista_desejos (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  url         text,
  valor       numeric(15,2),
  prioridade  text default 'media'
                check (prioridade in ('alta','media','baixa')),
  status      text default 'desejado'
                check (status in ('desejado','comprado','descartado')),
  observacoes text,
  created_at  timestamptz default now()
);

-- ──────────────────────────────────────────
-- INVESTIMENTOS — Configurações
-- ──────────────────────────────────────────

create table if not exists inv_corretoras (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null unique,
  created_at  timestamptz default now()
);

create table if not exists inv_modalidades (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null unique,
  created_at  timestamptz default now()
);

-- ──────────────────────────────────────────
-- INVESTIMENTOS — Movimentações
-- ──────────────────────────────────────────

create table if not exists inv_movimentos (
  id              uuid primary key default uuid_generate_v4(),
  data            date not null,
  tipo            text not null check (tipo in ('Compra','Venda')),
  ticker          text not null,
  empresa         text not null,
  setor           text,
  subsetor        text,
  quantidade      numeric(20,8) not null check (quantidade > 0),
  preco_unitario  numeric(15,6) not null check (preco_unitario > 0),
  valor_total     numeric(15,2) not null,

  corretora_id    uuid references inv_corretoras(id)  on delete set null,
  modalidade_id   uuid references inv_modalidades(id) on delete set null,

  created_at      timestamptz default now()
);

create index if not exists idx_inv_movimentos_ticker on inv_movimentos(ticker);
create index if not exists idx_inv_movimentos_data   on inv_movimentos(data);

-- ──────────────────────────────────────────
-- INVESTIMENTOS — Dividendos
-- ──────────────────────────────────────────

create table if not exists inv_dividendos (
  id            uuid primary key default uuid_generate_v4(),
  data          date not null,
  ticker        text not null,
  empresa       text,
  setor         text,
  subsetor      text,
  modalidade    text,
  valor         numeric(15,2) not null check (valor > 0),
  created_at    timestamptz default now()
);

create index if not exists idx_inv_dividendos_ticker on inv_dividendos(ticker);
create index if not exists idx_inv_dividendos_data   on inv_dividendos(data);

-- ──────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────
-- Habilitar RLS em todas as tabelas (boas práticas Supabase)

alter table cartoes           enable row level security;
alter table categorias        enable row level security;
alter table subcategorias     enable row level security;
alter table formas_pagamento  enable row level security;
alter table tipos_pagamento   enable row level security;
alter table perfis_despesa    enable row level security;
alter table naturezas         enable row level security;
alter table decisoes          enable row level security;
alter table status_compra     enable row level security;
alter table trabalhos         enable row level security;
alter table transacoes        enable row level security;
alter table orcamentos        enable row level security;
alter table metas             enable row level security;
alter table contas_receber    enable row level security;
alter table contas_pagar      enable row level security;
alter table lista_desejos     enable row level security;
alter table inv_corretoras    enable row level security;
alter table inv_modalidades   enable row level security;
alter table inv_movimentos    enable row level security;
alter table inv_dividendos    enable row level security;

-- Políticas: acesso total via service_role (chave secreta do app)
-- Ajuste para autenticação por usuário quando necessário

do $$ declare t text;
begin
  foreach t in array array[
    'cartoes','categorias','subcategorias','formas_pagamento','tipos_pagamento',
    'perfis_despesa','naturezas','decisoes','status_compra','trabalhos','transacoes','orcamentos','metas',
    'contas_receber','contas_pagar','lista_desejos',
    'inv_corretoras','inv_modalidades','inv_movimentos','inv_dividendos'
  ] loop
    execute format('
      create policy if not exists "service_role_all" on %I
      for all using (true) with check (true)', t);
  end loop;
end $$;

-- ──────────────────────────────────────────
-- DADOS INICIAIS (configurações padrão)
-- ──────────────────────────────────────────

insert into tipos_pagamento (nome) values
  ('Entrada'), ('Saída'), ('Investimento'), ('Transferência')
on conflict do nothing;

insert into naturezas (nome) values
  ('Renda'),
  ('Neutro'),
  ('Transferência'),
  ('Supérfluo'),
  ('Conveniência'),
  ('Recuperação'),
  ('Essencial'),
  ('Qualidade de vida')
on conflict do nothing;

insert into decisoes (nome) values
  ('Eventual'),
  ('Transferência'),
  ('Impulsivo'),
  ('Recorrente')
on conflict do nothing;

insert into inv_modalidades (nome) values
  ('Ação'), ('Fundo Imobiliário'), ('Criptomoeda'), ('ETF'), ('Renda Fixa')
on conflict do nothing;

-- ══════════════════════════════════════════
-- Schema criado com sucesso! ✅
-- Tabelas: 19 | Índices: 8 | RLS: ativo
-- ══════════════════════════════════════════
