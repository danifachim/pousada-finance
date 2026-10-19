import { excluirCategoria, excluirRegra } from "./actions";
import { Cabecalho, Cartao } from "@/components/ui";
import { BotaoAplicarRegras, FormNovaCategoria, FormNovaRegra } from "@/components/formularios-categorias";
import { carregarCategorias } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";
import { NOMES_GRUPO_DRE, type GrupoDre, type RegraCategoria } from "@/lib/types";

function BotaoExcluir({ rotulo }: { rotulo: string }) {
  return (
    <button aria-label={rotulo} className="text-xs text-slate-400 hover:text-rose-700">
      Excluir
    </button>
  );
}

export default async function PaginaCategorias() {
  const supabase = await createClient();
  const [categorias, regrasRes] = await Promise.all([
    carregarCategorias(supabase),
    supabase.from("regras_categoria").select("id, termo, categoria_id, ignorar").order("criado_em"),
  ]);
  const regras = (regrasRes.data ?? []) as RegraCategoria[];
  const grupos = Object.keys(NOMES_GRUPO_DRE) as GrupoDre[];

  return (
    <>
      <Cabecalho
        titulo="Categorias e regras"
        descricao="As categorias decidem onde cada transação aparece na DRE. As regras categorizam sozinhas as transações novas pela descrição."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Cartao titulo="Categorias">
            <div className="space-y-4">
              {grupos.map((grupo) => {
                const doGrupo = categorias.filter((c) => c.grupo_dre === grupo);
                if (!doGrupo.length) return null;
                return (
                  <div key={grupo}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {NOMES_GRUPO_DRE[grupo]}
                    </p>
                    <ul className="divide-y divide-slate-100">
                      {doGrupo.map((c) => (
                        <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                          <span className="text-slate-800">{c.nome}</span>
                          <form action={excluirCategoria}>
                            <input type="hidden" name="id" value={c.id} />
                            <BotaoExcluir rotulo={`Excluir categoria ${c.nome}`} />
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Excluir uma categoria deixa as transações dela sem categoria.
            </p>
          </Cartao>
          <Cartao titulo="Nova categoria">
            <FormNovaCategoria />
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao titulo="Regras automáticas">
            {regras.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma regra ainda.</p>
            ) : (
              <ul className="mb-4 divide-y divide-slate-100">
                {regras.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-800">
                      “{r.termo}” →{" "}
                      <strong>{categorias.find((c) => c.id === r.categoria_id)?.nome ?? "?"}</strong>
                      {r.ignorar && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">ignorar</span>}
                    </span>
                    <form action={excluirRegra}>
                      <input type="hidden" name="id" value={r.id} />
                      <BotaoExcluir rotulo={`Excluir regra ${r.termo}`} />
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <BotaoAplicarRegras />
            <p className="mt-2 text-xs text-slate-500">
              As regras valem para transações novas e, ao clicar acima, para as que ainda estão sem
              categoria. O que você já categorizou à mão nunca é alterado.
            </p>
          </Cartao>
          <Cartao titulo="Nova regra">
            <FormNovaRegra categorias={categorias} />
          </Cartao>
        </div>
      </div>
    </>
  );
}
