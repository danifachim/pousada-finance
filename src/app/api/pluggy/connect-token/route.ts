import { NextResponse } from "next/server";
import { requireAuthorizedUser } from "@/lib/auth";
import { getPluggy, urlDoWebhook } from "@/lib/pluggy";

/**
 * Gera o "connect token" (vale 30 min) que abre o widget do Pluggy no navegador.
 * O Client ID/Secret nunca saem do servidor; o navegador só recebe este token.
 *
 * Corpo opcional: { itemId } para renovar/atualizar uma conexão existente.
 */
export async function POST(request: Request) {
  const auth = await requireAuthorizedUser();
  if (!auth.ok) return auth.response;

  try {
    const corpo = await request.json().catch(() => ({}));
    const itemId = typeof corpo?.itemId === "string" ? corpo.itemId : undefined;

    // O webhook só funciona com URL pública em HTTPS (ex.: o endereço na Vercel).
    const webhookUrl = urlDoWebhook();

    const { accessToken } = await getPluggy().createConnectToken(itemId, {
      webhookUrl,
      clientUserId: auth.user.id,
      avoidDuplicates: true,
    });

    return NextResponse.json({ accessToken, webhookAtivo: Boolean(webhookUrl) });
  } catch (erro) {
    return NextResponse.json({ error: mensagemDeErro(erro) }, { status: 500 });
  }
}

function mensagemDeErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Erro ao falar com o Pluggy.";
}
