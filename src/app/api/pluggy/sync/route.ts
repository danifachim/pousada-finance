import { NextResponse } from "next/server";
import { requireAuthorizedUser } from "@/lib/auth";
import { pedirAtualizacaoNoBanco, sincronizarItem, type ResultadoSync } from "@/lib/sync";

export const maxDuration = 60;

/**
 * Botão "Atualizar": relê do Pluggy todas as conexões (ou só uma).
 * Corpo opcional: { itemId?: string, atualizarNoBanco?: boolean }
 *  - atualizarNoBanco=true pede ao Pluggy para buscar dados novos no banco
 *    antes de ler; o resultado completo chega depois via webhook.
 */
export async function POST(request: Request) {
  const auth = await requireAuthorizedUser();
  if (!auth.ok) return auth.response;

  try {
    const corpo = await request.json().catch(() => ({}));
    const itemUnico = typeof corpo?.itemId === "string" ? corpo.itemId : null;
    const atualizarNoBanco = corpo?.atualizarNoBanco === true;

    let itens: string[];
    if (itemUnico) {
      itens = [itemUnico];
    } else {
      const { data, error } = await auth.supabase.from("conexoes").select("item_id");
      if (error) throw error;
      itens = (data ?? []).map((linha) => linha.item_id as string);
    }

    const resultados: ResultadoSync[] = [];
    const avisos: string[] = [];

    for (const itemId of itens) {
      if (atualizarNoBanco) {
        try {
          await pedirAtualizacaoNoBanco(itemId);
        } catch (erro) {
          avisos.push(
            `Não foi possível pedir atualização ao banco (${
              erro instanceof Error ? erro.message : "erro desconhecido"
            }). Os dados já guardados no Pluggy foram lidos normalmente.`,
          );
        }
      }
      resultados.push(await sincronizarItem(itemId));
    }

    return NextResponse.json({ resultados, avisos });
  } catch (erro) {
    return NextResponse.json(
      { error: erro instanceof Error ? erro.message : "Erro ao sincronizar." },
      { status: 500 },
    );
  }
}
