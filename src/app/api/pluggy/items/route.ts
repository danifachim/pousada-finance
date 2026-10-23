import { NextResponse } from "next/server";
import { requireAuthorizedUser } from "@/lib/auth";
import { garantirWebhookGeral, PADRAO_ITEM_ID } from "@/lib/pluggy";
import { removerConexao, sincronizarItem } from "@/lib/sync";

export const maxDuration = 60;

/**
 * Grava uma conexão e importa os dados. Chamado quando o widget conclui uma
 * conexão, ou quando o Item ID é colado à mão (conexões criadas no painel do
 * Pluggy, por exemplo via Meu Pluggy).
 */
export async function POST(request: Request) {
  const auth = await requireAuthorizedUser();
  if (!auth.ok) return auth.response;

  try {
    const corpo = await request.json().catch(() => null);
    const itemId = typeof corpo?.itemId === "string" ? corpo.itemId.trim() : "";
    if (!PADRAO_ITEM_ID.test(itemId)) {
      return NextResponse.json(
        { error: "Item ID inválido. Ele tem o formato 1a2b3c4d-1234-5678-9abc-1234567890ab." },
        { status: 400 },
      );
    }
    const resultado = await sincronizarItem(itemId);

    // Conexões feitas fora do sistema não trazem o nosso webhook; cadastra o geral.
    let webhookAtivo = false;
    try {
      webhookAtivo = await garantirWebhookGeral();
    } catch (erro) {
      console.error("[pluggy] não foi possível cadastrar o webhook geral:", erro);
    }

    return NextResponse.json({ ...resultado, webhookAtivo });
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
