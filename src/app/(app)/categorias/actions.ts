"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOMES_GRUPO_DRE, type GrupoDre } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoForm = { erro?: string; ok?: string } | undefined;

function texto(formData: FormData, campo: string, max = 120): string {
  return String(formData.get(campo) ?? "").trim().slice(0, max);
}

export async function criarCategoria(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const nome = texto(formData, "nome", 60);
  const grupo = texto(formData, "grupo_dre") as GrupoDre;
  if (!nome) return { erro: "Informe o nome da categoria." };
  if (!(grupo in NOMES_GRUPO_DRE)) return { erro: "Escolha o grupo da DRE." };

  const supabase = await createClient();
  const { error } = await supabase.from("categorias").insert({ nome, grupo_dre: grupo });
  if (error) {
    return {
      erro: error.code === "23505" ? "Já existe uma categoria com esse nome." : "Não foi possível criar a categoria.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: "Categoria criada." };
}

export async function excluirCategoria(formData: FormData) {
  const id = texto(formData, "id");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("categorias").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function criarRegra(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const termo = texto(formData, "termo", 80);
  const categoriaId = texto(formData, "categoria_id");
  const ignorar = formData.get("ignorar") === "on";
  if (termo.length < 3) return { erro: "O trecho da descrição precisa ter ao menos 3 letras." };
  if (!UUID.test(categoriaId)) return { erro: "Escolha a categoria." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("regras_categoria")
    .insert({ termo, categoria_id: categoriaId, ignorar });
  if (error) return { erro: "Não foi possível criar a regra." };
  revalidatePath("/categorias");
  return { ok: "Regra criada. Use “Aplicar regras agora” para categorizar o que já existe." };
}

export async function excluirRegra(formData: FormData) {
  const id = texto(formData, "id");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("regras_categoria").delete().eq("id", id);
  revalidatePath("/categorias");
}

/** Aplica as regras às transações que ainda estão sem categoria (não mexe nas que você já categorizou). */
export async function aplicarRegras(): Promise<EstadoForm> {
  const supabase = await createClient();
  const { data: regras, error } = await supabase
    .from("regras_categoria")
    .select("termo, categoria_id, ignorar")
    .order("criado_em");
  if (error) return { erro: "Não foi possível ler as regras." };
  if (!regras?.length) return { erro: "Cadastre ao menos uma regra antes." };

  let atualizadas = 0;
  for (const regra of regras) {
    const termo = String(regra.termo).replace(/[%_]/g, "");
    if (termo.length < 3) continue;
    const alteracoes: { categoria_id: string; ignorar?: boolean } = {
      categoria_id: regra.categoria_id as string,
    };
    if (regra.ignorar) alteracoes.ignorar = true;

    const { data, error: erroUpdate } = await supabase
      .from("transacoes")
      .update(alteracoes)
      .is("categoria_id", null)
      .ilike("descricao", `%${termo}%`)
      .select("id");
    if (erroUpdate) return { erro: "Falha ao aplicar as regras." };
    atualizadas += data?.length ?? 0;
  }

  revalidatePath("/", "layout");
  return { ok: `${atualizadas} transaç${atualizadas === 1 ? "ão categorizada" : "ões categorizadas"}.` };
}
