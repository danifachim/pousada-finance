import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria, ResumoMensal } from "@/lib/types";

/** Busca o resumo mensal por categoria entre dois meses ("YYYY-MM"), com o mês normalizado. */
export async function carregarResumo(
  supabase: SupabaseClient,
  deMes: string,
  ateMes: string,
): Promise<ResumoMensal[]> {
  const { data, error } = await supabase
    .from("resumo_mensal")
    .select("mes, categoria_id, entradas, saidas, qtd")
    .gte("mes", `${deMes}-01`)
    .lte("mes", `${ateMes}-01`);
  if (error) throw new Error("Não foi possível carregar o resumo mensal.");

  return (data ?? []).map((r) => ({
    mes: String(r.mes).slice(0, 7),
    categoria_id: (r.categoria_id as string | null) ?? null,
    entradas: Number(r.entradas),
    saidas: Number(r.saidas),
    qtd: Number(r.qtd),
  }));
}

export async function carregarCategorias(supabase: SupabaseClient): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nome, grupo_dre")
    .order("nome");
  if (error) throw new Error("Não foi possível carregar as categorias.");
  return (data ?? []) as Categoria[];
}
