-- Mantém uma única conta padrão por usuário, sem quebrar bancos já criados.
alter table public.cartoes
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists padrao boolean not null default false;

create unique index if not exists cartoes_um_padrao_por_usuario_idx
  on public.cartoes (user_id)
  where padrao;

-- A troca ocorre dentro de uma transação para nunca violar o índice parcial.
create or replace function public.definir_conta_padrao(p_cartao_id uuid default null, p_padrao boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  if p_padrao and p_cartao_id is null then
    raise exception 'Uma conta deve ser informada para defini-la como padrão';
  end if;

  if p_padrao and not exists (
    select 1 from public.cartoes
    where id = p_cartao_id and user_id = auth.uid()
  ) then
    raise exception 'Conta não encontrada para este usuário';
  end if;

  update public.cartoes
    set padrao = false
    where user_id = auth.uid() and padrao;

  if p_padrao then
    update public.cartoes
      set padrao = true
      where id = p_cartao_id and user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.definir_conta_padrao(uuid, boolean) from public;
grant execute on function public.definir_conta_padrao(uuid, boolean) to authenticated;
