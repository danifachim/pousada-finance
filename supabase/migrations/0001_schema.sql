-- =====================================================================
-- Sistema financeiro - esquema inicial
-- Execute no Supabase: SQL Editor > New query > cole este arquivo > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quem pode usar o sistema
-- ---------------------------------------------------------------------
-- Só e-mails desta lista enxergam dados, mesmo que alguém consiga criar
-- uma conta no Supabase Auth. Depois de rodar este arquivo, cadastre os
-- dois e-mails (veja o final do arquivo).
create table if not exists public.usuarios_autorizados (
  email text primary key,
  criado_em timestamptz not null default now()
);
alter table public.usuarios_autorizados enable row level security;
-- Sem policies de propósito: a tabela só é editada pelo SQL Editor / service role.

create or replace function public.is_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios_autorizados u
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_authorized() from public;
revoke all on function public.is_authorized() from anon;
grant execute on function public.is_authorized() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Dados vindos do Pluggy (gravados apenas pelo servidor)
-- ---------------------------------------------------------------------
create table if not exists public.conexoes (
  item_id text primary key,                 -- itemId do Pluggy
  conector_id integer,
  conector_nome text not null,
  conector_logo text,
  status text not null,                     -- UPDATED, UPDATING, LOGIN_ERROR, ...
  erro text,
  ultima_atualizacao timestamptz,
  consentimento_expira_em timestamptz,      -- Open Finance: quando o consentimento vence
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.contas_bancarias (
  id text primary key,                      -- id da conta no Pluggy
  item_id text not null references public.conexoes(item_id) on delete cascade,
  tipo text not null check (tipo in ('BANK', 'CREDIT')),
  subtipo text,
  nome text not null,
  numero text,
  saldo numeric(14,2) not null default 0,   -- BANK: saldo | CREDIT: valor da fatura atual
  moeda text not null default 'BRL',
  limite_credito numeric(14,2),
  limite_disponivel numeric(14,2),
  fatura_vencimento date,
  fatura_valor_minimo numeric(14,2),
  atualizado_em timestamptz not null default now()
);
create index if not exists contas_bancarias_item_idx on public.contas_bancarias (item_id);

-- ---------------------------------------------------------------------
-- 3. Categorias e regras
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'grupo_dre') then
    create type public.grupo_dre as enum (
      'receita_bruta',          -- vendas e receitas operacionais
      'deducoes',               -- impostos sobre vendas, taxas de cartão/plataformas
      'custos',                 -- custos diretos do serviço/produto
      'despesas_operacionais',  -- aluguel, folha, marketing, contas...
      'despesas_financeiras',   -- juros, tarifas bancárias, IOF
      'outras',                 -- receitas/despesas não operacionais
      'fora_dre'                -- movimentações que não são resultado (retiradas, empréstimos)
    );
  end if;
end $$;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  grupo_dre public.grupo_dre not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.regras_categoria (
  id uuid primary key default gen_random_uuid(),
  termo text not null,                      -- trecho da descrição (sem diferenciar maiúsculas)
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  ignorar boolean not null default false,   -- também marca como "ignorar nos relatórios"
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Transações
-- ---------------------------------------------------------------------
create table if not exists public.transacoes (
  id text primary key,                      -- id da transação no Pluggy
  conta_id text not null references public.contas_bancarias(id) on delete cascade,
  data date not null,
  descricao text not null,
  valor numeric(14,2) not null,             -- com sinal: entrada > 0, saída < 0
  status text not null default 'POSTED',    -- POSTED | PENDING
  categoria_pluggy text,
  categoria_id uuid references public.categorias(id) on delete set null,
  ignorar boolean not null default false,   -- ex.: pagamento de fatura, transferência entre contas
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists transacoes_data_idx on public.transacoes (data desc);
create index if not exists transacoes_conta_data_idx on public.transacoes (conta_id, data desc);
create index if not exists transacoes_categoria_idx on public.transacoes (categoria_id);

-- ---------------------------------------------------------------------
-- 5. Contas a pagar e a receber
-- ---------------------------------------------------------------------
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pagar', 'receber')),
  descricao text not null,
  contraparte text,                         -- fornecedor ou cliente
  valor numeric(14,2) not null check (valor > 0),
  vencimento date not null,
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'cancelado')),
  categoria_id uuid references public.categorias(id) on delete set null,
  pago_em date,
  transacao_id text references public.transacoes(id) on delete set null,  -- conciliação
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists lancamentos_status_venc_idx on public.lancamentos (status, vencimento);
create unique index if not exists lancamentos_transacao_uidx
  on public.lancamentos (transacao_id) where transacao_id is not null;

-- ---------------------------------------------------------------------
-- 6. Resumo mensal por categoria (base do fluxo de caixa e da DRE)
-- ---------------------------------------------------------------------
-- security_invoker: a view respeita as regras de acesso de quem consulta.
create or replace view public.resumo_mensal
with (security_invoker = true) as
select
  date_trunc('month', t.data)::date as mes,
  t.categoria_id,
  sum(case when t.valor > 0 then t.valor else 0 end)::numeric(14,2) as entradas,
  sum(case when t.valor < 0 then -t.valor else 0 end)::numeric(14,2) as saidas,
  count(*)::int as qtd
from public.transacoes t
where not t.ignorar
group by 1, 2;

-- ---------------------------------------------------------------------
-- 7. Segurança (RLS + permissões)
-- ---------------------------------------------------------------------
alter table public.conexoes          enable row level security;
alter table public.contas_bancarias  enable row level security;
alter table public.categorias        enable row level security;
alter table public.regras_categoria  enable row level security;
alter table public.transacoes        enable row level security;
alter table public.lancamentos       enable row level security;

-- Leitura dos dados do Pluggy (a escrita é só do servidor, via service role)
drop policy if exists "leitura autorizada" on public.conexoes;
create policy "leitura autorizada" on public.conexoes
  for select to authenticated using (public.is_authorized());

drop policy if exists "leitura autorizada" on public.contas_bancarias;
create policy "leitura autorizada" on public.contas_bancarias
  for select to authenticated using (public.is_authorized());

drop policy if exists "leitura autorizada" on public.transacoes;
create policy "leitura autorizada" on public.transacoes
  for select to authenticated using (public.is_authorized());

drop policy if exists "edicao autorizada" on public.transacoes;
create policy "edicao autorizada" on public.transacoes
  for update to authenticated
  using (public.is_authorized()) with check (public.is_authorized());

-- Tabelas editáveis pelos usuários autorizados
drop policy if exists "acesso autorizado" on public.categorias;
create policy "acesso autorizado" on public.categorias
  for all to authenticated
  using (public.is_authorized()) with check (public.is_authorized());

drop policy if exists "acesso autorizado" on public.regras_categoria;
create policy "acesso autorizado" on public.regras_categoria
  for all to authenticated
  using (public.is_authorized()) with check (public.is_authorized());

drop policy if exists "acesso autorizado" on public.lancamentos;
create policy "acesso autorizado" on public.lancamentos
  for all to authenticated
  using (public.is_authorized()) with check (public.is_authorized());

-- Permissões de tabela: anônimo não acessa nada; usuário logado só o necessário.
revoke all on public.usuarios_autorizados from anon, authenticated;
revoke all on public.conexoes, public.contas_bancarias, public.transacoes,
              public.categorias, public.regras_categoria, public.lancamentos,
              public.resumo_mensal
  from anon, authenticated;

grant select on public.conexoes, public.contas_bancarias to authenticated;
grant select on public.transacoes to authenticated;
-- Na transação, o usuário só pode mudar categoria, "ignorar" e observação.
grant update (categoria_id, ignorar, observacao) on public.transacoes to authenticated;
grant select, insert, update, delete
  on public.categorias, public.regras_categoria, public.lancamentos to authenticated;
grant select on public.resumo_mensal to authenticated;

grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------
-- 8. Categorias iniciais (edite à vontade no sistema depois)
-- ---------------------------------------------------------------------
insert into public.categorias (nome, grupo_dre) values
  ('Vendas e receitas',            'receita_bruta'),
  ('Outras receitas operacionais', 'receita_bruta'),
  ('Taxas de cartão e plataformas','deducoes'),
  ('Impostos sobre vendas',        'deducoes'),
  ('Fornecedores e insumos',       'custos'),
  ('Custos diretos do serviço',    'custos'),
  ('Folha e pessoal',              'despesas_operacionais'),
  ('Aluguel',                      'despesas_operacionais'),
  ('Água, luz e internet',         'despesas_operacionais'),
  ('Marketing e vendas',           'despesas_operacionais'),
  ('Manutenção',                   'despesas_operacionais'),
  ('Contador e serviços',          'despesas_operacionais'),
  ('Outras despesas operacionais', 'despesas_operacionais'),
  ('Tarifas bancárias',            'despesas_financeiras'),
  ('Juros e IOF',                  'despesas_financeiras'),
  ('Rendimentos de aplicações',    'outras'),
  ('Receitas não operacionais',    'outras'),
  ('Despesas não operacionais',    'outras'),
  ('Retirada de sócios',           'fora_dre'),
  ('Empréstimos e financiamentos', 'fora_dre'),
  ('Aportes de capital',           'fora_dre')
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 9. ÚLTIMO PASSO: autorize os e-mails que vão usar o sistema
-- ---------------------------------------------------------------------
-- Troque pelos e-mails reais e rode estas linhas:
--
-- insert into public.usuarios_autorizados (email) values
--   ('seu-email@exemplo.com'),
--   ('email-do-seu-marido@exemplo.com')
-- on conflict do nothing;
