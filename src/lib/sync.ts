import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Item, Transaction, WebhookEventPayload } from "pluggy-sdk";
import { getPluggy } from "@/lib/pluggy";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = SupabaseClient;

/** Nas atualizações seguintes só relemos os últimos dias (a primeira lê tudo). */
const DIAS_INCREMENTAL = 60;

/**
 * Pagamentos de fatura aparecem duas vezes: como saída na conta corrente e como
 * crédito no cartão. Marcamos como "ignorar" para não contar em dobro nos
 * relatórios (as compras do cartão já entram como despesa). Dá para corrigir
 * manualmente no extrato.
 */
const PADRAO_PAGAMENTO_FATURA =
  /\b(pag(amento|to)?|pgto|pgt)\.?\s*(de\s*)?(fatura|cart[aã]o)|fatura\s*(do\s*)?cart[aã]o|pagamento recebido|credit card payment/i;

type Regra = { termo: string; categoria_id: string; ignorar: boolean };

// ---------------------------------------------------------------- utilidades

function ymd(valor: Date | string): string {
  return new Date(valor).toISOString().slice(0, 10);
}

function iso(valor: Date | string | null | undefined): string | null {
  return valor ? new Date(valor).toISOString() : null;
}

function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}

function partes<T>(lista: T[], tamanho: number): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho));
  return saida;
}

/** Entrada positiva, saída negativa, independente de como o banco informa o sinal. */
function valorComSinal(t: Transaction): number {
  const abs = Math.abs(t.amount);
  return arredondar(t.type === "CREDIT" ? abs : -abs);
}

// -------------------------------------------------------------------- regras

async function carregarRegras(admin: Admin): Promise<Regra[]> {
  const { data, error } = await admin
    .from("regras_categoria")
    .select("termo, categoria_id, ignorar")
    .order("criado_em");
  if (error) throw error;
  return (data ?? []) as Regra[];
}

function classificar(t: Transaction, regras: Regra[]) {
  const texto = `${t.description} ${t.descriptionRaw ?? ""}`.toLowerCase();
  const regra = regras.find((r) => r.termo.trim() && texto.includes(r.termo.trim().toLowerCase()));
  const pagamentoDeFatura =
    PADRAO_PAGAMENTO_FATURA.test(texto) || PADRAO_PAGAMENTO_FATURA.test(t.category ?? "");
  return {
    categoria_id: regra?.categoria_id ?? null,
    ignorar: Boolean(regra?.ignorar) || pagamentoDeFatura,
  };
}

// ------------------------------------------------------------------ gravação

async function salvarConexao(admin: Admin, item: Item) {
  const { error } = await admin.from("conexoes").upsert(
    {
      item_id: item.id,
      conector_id: item.connector.id,
      conector_nome: item.connector.name,
      conector_logo: item.connector.imageUrl,
      status: item.status,
      erro: item.error?.message ?? null,
      ultima_atualizacao: iso(item.lastUpdatedAt),
      consentimento_expira_em: iso(item.consentExpiresAt),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "item_id" },
  );
  if (error) throw error;
}

async function salvarContas(admin: Admin, itemId: string, contas: Account[]) {
  if (!contas.length) return;
  const agora = new Date().toISOString();
  const linhas = contas.map((c) => ({
    id: c.id,
    item_id: itemId,
    tipo: c.type,
    subtipo: c.subtype ?? null,
    nome: c.marketingName ?? c.name,
    numero: c.number ?? null,
    saldo: arredondar(c.balance ?? 0),
    moeda: c.currencyCode ?? "BRL",
    limite_credito: c.creditData?.creditLimit ?? null,
    limite_disponivel: c.creditData?.availableCreditLimit ?? null,
    fatura_vencimento: c.creditData?.balanceDueDate ? ymd(c.creditData.balanceDueDate) : null,
    fatura_valor_minimo: c.creditData?.minimumPayment ?? null,
    atualizado_em: agora,
  }));
  const { error } = await admin.from("contas_bancarias").upsert(linhas, { onConflict: "id" });
  if (error) throw error;
}

/**
 * Grava as transações. As novas recebem categoria/ignorar pelas regras; as que
 * já existem só têm os dados do banco atualizados, preservando o que você
 * categorizou à mão.
 */
async function gravarTransacoes(admin: Admin, transacoes: Transaction[], regras: Regra[]) {
  if (!transacoes.length) return 0;
  const agora = new Date().toISOString();

  const existentes = new Set<string>();
  for (const grupo of partes(
    transacoes.map((t) => t.id),
    100,
  )) {
    const { data, error } = await admin.from("transacoes").select("id").in("id", grupo);
    if (error) throw error;
    data?.forEach((linha) => existentes.add(linha.id as string));
  }

  const novas: Record<string, unknown>[] = [];
  const antigas: Record<string, unknown>[] = [];
  for (const t of transacoes) {
    const base = {
      id: t.id,
      conta_id: t.accountId,
      data: ymd(t.date),
      descricao: t.description,
      valor: valorComSinal(t),
      status: t.status ?? "POSTED",
      categoria_pluggy: t.category ?? null,
      atualizado_em: agora,
    };
    if (existentes.has(t.id)) antigas.push(base);
    else novas.push({ ...base, ...classificar(t, regras) });
  }

  for (const grupo of partes(novas, 500)) {
    const { error } = await admin.from("transacoes").upsert(grupo, { onConflict: "id" });
    if (error) throw error;
  }
  for (const grupo of partes(antigas, 500)) {
    const { error } = await admin.from("transacoes").upsert(grupo, { onConflict: "id" });
    if (error) throw error;
  }
  return novas.length;
}

async function sincronizarTransacoesDaConta(admin: Admin, contaId: string, regras: Regra[]) {
  const { count, error } = await admin
    .from("transacoes")
    .select("id", { count: "exact", head: true })
    .eq("conta_id", contaId);
  if (error) throw error;

  const primeiraVez = !count;
  const dateFrom = primeiraVez
    ? undefined
    : ymd(new Date(Date.now() - DIAS_INCREMENTAL * 24 * 60 * 60 * 1000));

  const transacoes = await getPluggy().fetchAllTransactions(
    contaId,
    dateFrom ? { dateFrom } : undefined,
  );
  return gravarTransacoes(admin, transacoes, regras);
}

// ------------------------------------------------------------------ interface

export type ResultadoSync = {
  itemId: string;
  status: string;
  contas: number;
  transacoesNovas: number;
};

/** Traz do Pluggy a conexão, as contas e as transações e grava no banco. */
export async function sincronizarItem(itemId: string): Promise<ResultadoSync> {
  const pluggy = getPluggy();
  const admin = createAdminClient();

  const item = await pluggy.fetchItem(itemId);
  await salvarConexao(admin, item);

  // As contas só existem depois da primeira coleta; antes disso a lista vem vazia.
  const { results: contas } = await pluggy.fetchAccounts(itemId);
  await salvarContas(admin, itemId, contas);

  const regras = await carregarRegras(admin);
  let transacoesNovas = 0;
  for (const conta of contas) {
    transacoesNovas += await sincronizarTransacoesDaConta(admin, conta.id, regras);
  }

  return { itemId, status: item.status, contas: contas.length, transacoesNovas };
}

/** Pede ao Pluggy para buscar dados novos no banco (o resultado chega por webhook). */
export async function pedirAtualizacaoNoBanco(itemId: string) {
  await getPluggy().updateItem(itemId);
}

/** Apaga a conexão no Pluggy e, junto, as contas e transações dela aqui. */
export async function removerConexao(itemId: string) {
  await getPluggy().deleteItem(itemId);
  const { error } = await createAdminClient().from("conexoes").delete().eq("item_id", itemId);
  if (error) throw error;
}

/** Se a conta ainda não existe aqui, sincroniza o item inteiro. Retorna true se fez isso. */
async function sincronizouItemInteiro(admin: Admin, itemId: string, contaId: string) {
  const { data, error } = await admin
    .from("contas_bancarias")
    .select("id")
    .eq("id", contaId)
    .maybeSingle();
  if (error) throw error;
  if (data) return false;
  await sincronizarItem(itemId);
  return true;
}

/** Reage aos avisos (webhooks) do Pluggy. Sempre busca os dados na API, nunca confia no corpo. */
export async function processarWebhook(evento: WebhookEventPayload): Promise<void> {
  const admin = createAdminClient();
  const pluggy = getPluggy();

  switch (evento.event) {
    case "item/created":
    case "item/updated":
      await sincronizarItem(evento.itemId);
      break;

    case "item/error":
    case "item/waiting_user_input":
    case "item/waiting_user_action":
    case "item/login_succeeded":
      await salvarConexao(admin, await pluggy.fetchItem(evento.itemId));
      break;

    case "item/deleted": {
      const { error } = await admin.from("conexoes").delete().eq("item_id", evento.itemId);
      if (error) throw error;
      break;
    }

    case "transactions/created": {
      if (await sincronizouItemInteiro(admin, evento.itemId, evento.accountId)) break;
      const novas = await pluggy.fetchAllTransactions(evento.accountId, {
        createdAtFrom: evento.transactionsCreatedAtFrom,
      });
      await gravarTransacoes(admin, novas, await carregarRegras(admin));
      break;
    }

    case "transactions/updated": {
      if (await sincronizouItemInteiro(admin, evento.itemId, evento.accountId)) break;
      const regras = await carregarRegras(admin);
      for (const grupo of partes(evento.transactionIds, 200)) {
        const pagina = await pluggy.fetchTransactionsCursor(evento.accountId, { ids: grupo });
        await gravarTransacoes(admin, pagina.results, regras);
      }
      break;
    }

    case "transactions/deleted": {
      for (const grupo of partes(evento.transactionIds, 100)) {
        const { error } = await admin.from("transacoes").delete().in("id", grupo);
        if (error) throw error;
      }
      break;
    }

    default:
      break;
  }
}
