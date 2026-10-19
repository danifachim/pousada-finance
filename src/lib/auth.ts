import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Para rotas de API que usam a chave de serviço: confirma que quem chama está
 * logado E consta na lista de e-mails autorizados. Só estar logado não basta.
 */
export async function requireAuthorizedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  const { data: autorizado, error } = await supabase.rpc("is_authorized");
  if (error || autorizado !== true) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    };
  }

  return { ok: true as const, user, supabase };
}
