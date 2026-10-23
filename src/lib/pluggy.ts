import "server-only";
import { PluggyClient } from "pluggy-sdk";

let client: PluggyClient | null = null;

/** Cliente da API do Pluggy. O SDK renova a API key (válida por 2h) sozinho. */
export function getPluggy(): PluggyClient {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no ambiente do servidor.",
    );
  }
  client ??= new PluggyClient({ clientId, clientSecret });
  return client;
}

/**
 * Endereço que o Pluggy chama para avisar de dados novos. Só existe com URL
 * pública em HTTPS (ex.: o endereço na Vercel) e com o segredo configurado.
 */
export function urlDoWebhook(): string | undefined {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const segredo = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!appUrl.startsWith("https://") || !segredo) return undefined;
  return `${appUrl}/api/pluggy/webhook?token=${encodeURIComponent(segredo)}`;
}

/** Item IDs do Pluggy são UUIDs. */
export const PADRAO_ITEM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Conexões criadas fora do sistema (ex.: no painel do Pluggy, via Meu Pluggy)
 * não carregam o nosso webhook. Este cadastro geral, feito uma vez na
 * aplicação do Pluggy, faz o Pluggy avisar o sistema sobre todas elas.
 * Retorna true se o webhook geral está ativo.
 */
export async function garantirWebhookGeral(): Promise<boolean> {
  const url = urlDoWebhook();
  if (!url) return false;
  const pluggy = getPluggy();
  const { results } = await pluggy.fetchWebhooks();
  const existente = results.find((w) => w.url === url && w.event === "all");
  if (existente) {
    if (existente.disabledAt) await pluggy.updateWebhook(existente.id, { enabled: true });
    return true;
  }
  await pluggy.createWebhook("all", url);
  return true;
}
