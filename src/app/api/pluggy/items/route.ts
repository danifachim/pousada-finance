import { NextResponse } from "next/server";
import { requireAuthorizedUser } from "@/lib/auth";
import { removerConexao, sincronizarItem } from "@/lib/sync";

export const maxDuration = 60;

/** Chamado pelo navegador quando o widget conclui uma conexão: grava o item e importa os dados. */
export async function POST(request: Request) {
  const auth = await requireAuthorizedUser();
  if (!auth.ok) return auth.response;

  try {
    const corpo = await request.json().catch(() => null);
    const itemId = corpo?.itemId;
    if (typeof itemId !== "string" || itemId.length < 10) {
      return NextResponse.json({ error: "itemId inválido." }, { status: 400 });
    }
    const resultado = await sincronizarItem(itemId);
    return NextResponse.json(resultado);
  } catch (erro) {
    return NextResponse.json({ error: mensagemDeErro(erro) }, { status: 500 });
  }
}

/** Remove uma conexão (no Pluggy e aqui). Use ?itemId=... */
export async function DELETE(request: Request) {
  const auth = await requireAuthorizedUser();
  if (!auth.ok) return auth.response;

  try {
    const itemId = new URL(request.url).searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId obrigatório." }, { status: 400 });
    }
    await removerConexao(itemId);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return NextResponse.json({ error: mensagemDeErro(erro) }, { status: 500 });
  }
}

function mensagemDeErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Erro ao falar com o Pluggy.";
}
