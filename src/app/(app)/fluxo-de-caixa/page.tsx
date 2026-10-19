import Link from "next/link";
import { Aviso, Cabecalho, Cartao, EstadoVazio, Indicador } from "@/components/ui";
import {
  formatarMoeda,
  intervaloDeMeses,
  mesAtual,
  mesCurto,
  mesValido,
  nomeDoMes,
  somarMeses,
} from "@/lib/format";
import { carregarCategorias, carregarResumo } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, ResumoMensal } from "@/lib/types";

type Params = { [chave: string]: string | string[] | undefined };

export default async function FluxoDeCaixa({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const atual = mesAtual();
  const inicioJanela = somarMeses(atual, -11);
  const bruto = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  let selecionado = mesValido(bruto, atual);
  if (selecionado < inicioJanela) selecionado = inicioJanela;
  if (selecionado > atual) selecionado = atual;

  const supabase = await createClient();
  let resumo: ResumoMensal[];
  let categorias: Categoria[];
  try {
    [resumo, categorias] = await Promise.all([
      carregarResumo(supabase, inicioJanela, atual),
      carregarCategorias(supabase),
    ]);
  } catch (erro) {
    return (
      <>
        <Cabecalho titulo="Fluxo de caixa" />
        <Aviso tipo="erro">{erro instanceof Error ? erro.message : "Erro ao carregar."}</Aviso>
      </>
    );
  }

  const meses = intervaloDeMeses(inicioJanela, atual);
  const porMes = meses.map((mes) => {
    const linhas = resumo.filter((r) => r.mes === mes);
    const entradas = linhas.reduce((t, r) => t + r.entradas, 0);
    const saidas = linhas.reduce((t, r) => t + r.saidas, 0);
    return { mes, entradas, saidas, resultado: entradas - saidas };
  });

  if (resumo.length === 0) {
    return (
      <>
        <Cabecalho titulo="Fluxo de caixa" />
        <EstadoVazio>
          Ainda não há transações para montar o fluxo de caixa.{" "}
          <Link href="/conexoes" className="font-medium text-slate-900 underline">Conecte um banco</Link>.
        </EstadoVazio>
      </>
    );
  }

  const maior = Math.max(1, ...porMes.flatMap((m) => [m.entradas, m.saidas]));
  const doMes = porMes.find((m) => m.mes === selecionado)!;

  const nomeCategoria = (id: string | null) =>
    id ? (categorias.find((c) => c.id === id)?.nome ?? "Categoria removida") : "Sem categoria";

  function porCategoria(tipo: "entradas" | "saidas") {
    const mapa = new Map<string, number>();
    for (const r of resumo.filter((x) => x.mes === selecionado)) {
      const valor = r[tipo];
      if (!valor) continue;
      const nome = nomeCategoria(r.categoria_id);
      mapa.set(nome, (mapa.get(nome) ?? 0) + valor);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }
  const entradasPorCategoria = porCategoria("entradas");
  const saidasPorCategoria = porCategoria("saidas");

  return (
    <>
      <Cabecalho
        titulo="Fluxo de caixa"
        descricao="Entradas e saídas reais das contas, mês a mês. Transações marcadas como “ignorar” (como pagamento de fatura e transferências entre contas) ficam de fora."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador rotulo={`Entradas · ${nomeDoMes(selecionado)}`} valor={formatarMoeda(doMes.entradas)} tom="positivo" />
        <Indicador rotulo={`Saídas · ${nomeDoMes(selecionado)}`} valor={formatarMoeda(doMes.saidas)} tom="negativo" />
        <Indicador
          rotulo="Resultado do mês"
          valor={formatarMoeda(doMes.resultado)}
          tom={doMes.resultado >= 0 ? "positivo" : "negativo"}
        />
      </div>

      <Cartao titulo="Últimos 12 meses (clique em um mês para detalhar)" className="mb-6">
        <div className="mb-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Entradas</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-600" /> Saídas</span>
        </div>
        <div className="flex h-44 items-end gap-1.5 sm:gap-3">
          {porMes.map((m) => (
            <Link
              key={m.mes}
              href={`/fluxo-de-caixa?mes=${m.mes}`}
              title={`${nomeDoMes(m.mes)}: entradas ${formatarMoeda(m.entradas)}, saídas ${formatarMoeda(m.saidas)}`}
              aria-label={`${nomeDoMes(m.mes)}: entradas ${formatarMoeda(m.entradas)}, saídas ${formatarMoeda(m.saidas)}`}
              className={`flex h-full flex-1 flex-col justify-end rounded-md px-0.5 pt-1 ${
                m.mes === selecionado ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
            >
              <div className="flex h-full items-end justify-center gap-0.5">
                <div className="w-full max-w-4 rounded-t bg-emerald-600" style={{ height: `${(m.entradas / maior) * 100}%` }} />
                <div className="w-full max-w-4 rounded-t bg-rose-600" style={{ height: `${(m.saidas / maior) * 100}%` }} />
              </div>
              <span className="mt-1 text-center text-[10px] text-slate-500 sm:text-xs">{mesCurto(m.mes)}</span>
            </Link>
          ))}
        </div>
      </Cartao>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Cartao titulo={`Entradas por categoria · ${nomeDoMes(selecionado)}`}>
          <ListaCategorias linhas={entradasPorCategoria} tom="text-emerald-700" />
        </Cartao>
        <Cartao titulo={`Saídas por categoria · ${nomeDoMes(selecionado)}`}>
          <ListaCategorias linhas={saidasPorCategoria} tom="text-rose-700" />
        </Cartao>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Mês</th>
              <th className="px-4 py-2 text-right font-medium">Entradas</th>
              <th className="px-4 py-2 text-right font-medium">Saídas</th>
              <th className="px-4 py-2 text-right font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {[...porMes].reverse().map((m) => (
              <tr key={m.mes} className="border-t border-slate-100">
                <td className="px-4 py-2.5">{nomeDoMes(m.mes)}</td>
                <td className="tabular px-4 py-2.5 text-right text-emerald-700">{formatarMoeda(m.entradas)}</td>
                <td className="tabular px-4 py-2.5 text-right text-rose-700">{formatarMoeda(m.saidas)}</td>
                <td className={`tabular px-4 py-2.5 text-right font-medium ${m.resultado >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatarMoeda(m.resultado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ListaCategorias({ linhas, tom }: { linhas: [string, number][]; tom: string }) {
  if (linhas.length === 0) return <p className="text-sm text-slate-500">Sem movimento neste mês.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {linhas.map(([nome, valor]) => (
        <li key={nome} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="truncate text-slate-700">{nome}</span>
          <span className={`tabular font-medium ${tom}`}>{formatarMoeda(valor)}</span>
        </li>
      ))}
    </ul>
  );
}
