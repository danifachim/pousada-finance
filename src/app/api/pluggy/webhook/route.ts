import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import type { WebhookEventPayload } from "pluggy-sdk";
import { processarWebhook } from "@/lib/sync";

export const maxDuration = 60;

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Recebe os avisos do Pluggy (item atualizado, transações novas etc.).
 * Rota pública, protegida pelo segredo `?token=` que vai na URL cadastrada no
 * Pluggy. O corpo nunca é usado como dado: ele só diz o que mudou, e os dados
 * reais são buscados na API do Pluggy com as nossas credenciais.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!segredoValido(token)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const evento = (await request.json().catch(() => null)) as WebhookEventPayload | null;
  if (!evento || typeof evento.event !== "string") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  // Responde logo (o Pluggy espera resposta rápida) e processa em seguida.
  after(async () => {
    try {
      await processarWebhook(evento);
    } catch (erro) {
      console.error(`[pluggy-webhook] falha em ${evento.event}:`, erro);
    }
  });

  return NextResponse.json({ ok: true });
}
