-- Mantém uma única conta padrão por usuário, sem quebrar bancos já criados.
alter table public.cartoes
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists padrao boolean not null default false;

create unique index if not exists cartoes_um_padrao_por_usuario_idx
  on public.cartoes (user_id)
  where padrao;
