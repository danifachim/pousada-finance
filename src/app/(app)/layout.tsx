import { redirect } from "next/navigation";
import { sair } from "@/app/login/actions";
import { Navegacao } from "@/components/navegacao";
import { classeBotaoSecundario } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function LayoutDoApp({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: autorizado } = await supabase.rpc("is_authorized");
  if (autorizado !== true) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Acesso não autorizado</h1>
          <p className="mt-2 text-sm text-slate-600">
            O e-mail <strong>{user.email}</strong> não está na lista de usuários deste sistema.
            Peça para quem administra incluir o e-mail na tabela <code>usuarios_autorizados</code>.
          </p>
          <form action={sair} className="mt-6">
            <button className={classeBotaoSecundario}>Sair</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
      <aside className="lg:w-56 lg:shrink-0">
        <div className="mb-4 flex items-center justify-between lg:block">
          <p className="text-lg font-semibold text-slate-900">Financeiro</p>
          <form action={sair} className="lg:mt-1">
            <button className="text-xs text-slate-500 underline hover:text-slate-900">
              Sair ({user.email})
            </button>
          </form>
        </div>
        <Navegacao />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
