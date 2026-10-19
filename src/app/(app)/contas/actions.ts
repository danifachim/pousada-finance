"use server";

import { revalidatePath } from "next/cache";
import { dataValida, hojeYmd, parseValorBr } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoForm = { erro?: string; ok?: string } | undefined;

function texto(formData: FormData, campo: string, max = 200): string {
  return String(formData.get(campo) ?? "").trim().slice(0, max);
}

function atualizarTelas() {
  revalidatePath("/", "layout");
}

export async function criarLancamento(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const tipo = texto(formData, "tipo");
  const descricao = texto(formData, "descricao", 120);
  const contraparte = texto(formData, "contraparte", 120);
  const valor = parseValorBr(texto(formData, "valor", 20));
  const vencimento = texto(formData, "vencimento", 10);
  const categoriaId = texto(formData, "categoria_id");
  const observacao = texto(formData, "observacao", 300);

  if (tipo !== "pagar" && tipo !== "receber") return { erro: "Escolha se é a pagar ou a receber." };
  if (!descricao) return { erro: "Informe a descrição." };
  if (valor === null) return { erro: "Informe um valor válido, como 1.250,90." };
  if (!dataValida(vencimento)) return { erro: "Informe a data de vencimento." };
  if (categoriaId && !UUID.test(categoriaId)) return { erro: "Categoria inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").insert({
    tipo,
    descricao,
    contraparte: contraparte || null,
    valor,
    vencimento,
    categoria_id: categoriaId || null,
    observacao: observacao || null,
  });
  if (error) return { erro: "Não foi possível salvar. Tente de novo." };

  atualizarTelas();
  return { ok: "Lançamento salvo." };
}

async function mudarStatus(
  id: string,
  campos: { status: "aberto" | "pago" | "cancelado"; pago_em: string | null; transacao_id: null | string },
) {
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase
    .from("lancamentos")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  atualizarTelas();
}

export async function marcarPago(formData: FormData) {
  await mudarStatus(texto(formData, "id"), { status: "pago", pago_em: hojeYmd(), transacao_id: null });
}

export async function reabrir(formData: FormData) {
  await mudarStatus(texto(formData, "id"), { status: "aberto", pago_em: null, transacao_id: null });
}

export async function cancelar(formData: FormData) {
  await mudarStatus(texto(formData, "id"), { status: "cancelado", pago_em: null, transacao_id: null });
}

export async function excluir(formData: FormData) {
  const id = texto(formData, "id");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("lancamentos").delete().eq("id", id);
  atualizarTelas();
}

/** Liga o lançamento a uma transação do extrato e o marca como pago na data dela. */
export async function conciliar(formData: FormData) {
  const lancamentoId = texto(formData, "lancamento_id");
  const transacaoId = texto(formData, "transacao_id");
  if (!UUID.test(lancamentoId) || !transacaoId) return;

  const supabase = await createClient();
  const { data: transacao } = await supabase
    .from("transacoes")
    .select("id, data")
    .eq("id", transacaoId)
    .maybeSingle();
  if (!transacao) return;

  await supabase
    .from("lancamentos")
    .update({
      status: "pago",
      pago_em: transacao.data as string,
      transacao_id: transacao.id as string,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", lancamentoId);
  atualizarTelas();
}
