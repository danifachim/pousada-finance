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
