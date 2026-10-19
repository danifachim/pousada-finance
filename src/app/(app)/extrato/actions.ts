"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoAcao = { ok: boolean; erro?: string };

/**
 * Muda a categoria e/ou o "ignorar nos relatórios" de uma transação.
 * Roda como o usuário logado: as regras de segurança do banco (RLS) decidem se pode.
 */
export async function atualizarTransacao(
  id: string,
  campos: { categoria_id?: string | null; ignorar?: boolean },
): Promise<ResultadoAcao> {
  if (typeof id !== "string" || !id) return { ok: false, erro: "Transação inválida." };

  const alteracoes: { categoria_id?: string | null; ignorar?: boolean } = {};
  if ("categoria_id" in campos) {
    const categoria = campos.categoria_id;
    if (categoria && !UUID.test(categoria)) return { ok: false, erro: "Categoria inválida." };
    alteracoes.categoria_id = categoria || null;
  }
  if (typeof campos.ignorar === "boolean") alteracoes.ignorar = campos.ignorar;
  if (!Object.keys(alteracoes).length) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("transacoes").update(alteracoes).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/", "layout");
  return { ok: true };
}
