import Link from "next/link";
import { Aviso, Cabecalho, EstadoVazio, classeBotao, classeCampo } from "@/components/ui";
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
import { NOMES_GRUPO_DRE, type Categoria, type GrupoDre, type ResumoMensal } from "@/lib/types";

type Params = { [chave: string]: string | string[] | undefined };

const QUANTIDADE_MESES = 6;

type Linha = {
  rotulo: string;
  valores: number[];
  tipo: "grupo" | "subtotal" | "detalhe" | "margem" | "informativo";
};

export default async function PaginaDre({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const atual = mesAtual();
  const bruto = Array.isArray(params.ate) ? params.ate[0] : params.ate;
  const ate = mesValido(bruto, atual);
  const de = somarMeses(ate, -(QUANTIDADE_MESES - 1));
  const meses = intervaloDeMeses(de, ate);

  const supabase = await createClient();
  let resumo: ResumoMensal[];
  let categorias: Categoria[];
  try {
    [resumo, categorias] = await Promise.all([
      carregarResumo(supabase, de, ate),
      carregarCategorias(supabase),
    ]);
  } catch (erro) {
    return (
      <>
        <Cabecalho titulo="DRE" />
        <Aviso tipo="erro">{erro instanceof Error ? erro.message : "Erro ao carregar."}</Aviso>
      </>
    );
  }

  // Valor líquido (entradas − saídas) de cada categoria em cada mês.
  const porGrupo = new Map<GrupoDre, Map<string, number[]>>();
  let semCategoria = 0;
  for (const r of resumo) {
    const categoria = r.categoria_id ? categorias.find((c) => c.id === r.categoria_id) : undefined;
    const grupo: GrupoDre = categoria?.grupo_dre ?? "outras";
    const nome = categoria?.nome ?? "Sem categoria";
    if (!categoria) semCategoria += r.qtd;

    const linhas = porGrupo.get(grupo) ?? new Map<string, number[]>();
    const valores = linhas.get(nome) ?? meses.map(() => 0);
    valores[meses.indexOf(r.mes)] += r.entradas - r.saidas;
    linhas.set(nome, valores);
    porGrupo.set(grupo, linhas);
  }

  const totalDoGrupo = (grupo: GrupoDre): number[] => {
    const soma = meses.map(() => 0);
    for (const valores of porGrupo.get(grupo)?.values() ?? []) {
      valores.forEach((v, i) => (soma[i] += v));
    }
    return soma;
  };
  const somar = (...series: number[][]) => meses.map((_, i) => series.reduce((t, s) => t + s[i], 0));

  const receitaBruta = totalDoGrupo("receita_bruta");
  const deducoes = totalDoGrupo("deducoes");
  const receitaLiquida = somar(receitaBruta, deducoes);
  const custos = totalDoGrupo("custos");
  const lucroBruto = somar(receitaLiquida, custos);
  const despesasOperacionais = totalDoGrupo("despesas_operacionais");
  const resultadoOperacional = somar(lucroBruto, despesasOperacionais);
  const despesasFinanceiras = totalDoGrupo("despesas_financeiras");
  const outras = totalDoGrupo("outras");
  const resultado = somar(resultadoOperacional, despesasFinanceiras, outras);
  const foraDaDre = totalDoGrupo("fora_dre");

  const detalhes = (grupo: GrupoDre): Linha[] =>
    [...(porGrupo.get(grupo)?.entries() ?? [])]
      .sort((a, b) => Math.abs(b[1].reduce((t, v) => t + v, 0)) - Math.abs(a[1].reduce((t, v) => t + v, 0)))
      .map(([rotulo, valores]) => ({ rotulo, valores, tipo: "detalhe" as const }));

  const margem = (numerador: number[]) =>
    numerador.map((n, i) => (receitaBruta[i] ? (n / receitaBruta[i]) * 100 : NaN));

  const linhas: Linha[] = [
    { rotulo: NOMES_GRUPO_DRE.receita_bruta, valores: receitaBruta, tipo: "grupo" },
    ...detalhes("receita_bruta"),
    { rotulo: `(−) ${NOMES_GRUPO_DRE.deducoes}`, valores: deducoes, tipo: "grupo" },
    ...detalhes("deducoes"),
    { rotulo: "= Receita líquida", valores: receitaLiquida, tipo: "subtotal" },
    { rotulo: `(−) ${NOMES_GRUPO_DRE.custos}`, valores: custos, tipo: "grupo" },
    ...detalhes("custos"),
    { rotulo: "= Lucro bruto", valores: lucroBruto, tipo: "subtotal" },
    { rotulo: `(−) ${NOMES_GRUPO_DRE.despesas_operacionais}`, valores: despesasOperacionais, tipo: "grupo" },
    ...detalhes("despesas_operacionais"),
    { rotulo: "= Resultado operacional", valores: resultadoOperacional, tipo: "subtotal" },
    { rotulo: `(−) ${NOMES_GRUPO_DRE.despesas_financeiras}`, valores: despesasFinanceiras, tipo: "grupo" },
    ...detalhes("despesas_financeiras"),
    { rotulo: `(+/−) ${NOMES_GRUPO_DRE.outras}`, valores: outras, tipo: "grupo" },
    ...detalhes("outras"),
    { rotulo: "= Resultado do período", valores: resultado, tipo: "subtotal" },
  ];

  const temDados = resumo.length > 0;
  const anterior = somarMeses(ate, -QUANTIDADE_MESES);
  const proximo = somarMeses(ate, QUANTIDADE_MESES);

  return (
    <>
      <Cabecalho
        titulo="DRE"
        descricao="Demonstrativo de resultado por mês, montado a partir das transações categorizadas."
        acoes={
          <>
            <Link href={`/dre?ate=${anterior}`} className="text-sm text-slate-600 underline">← Anteriores</Link>
            {proximo <= atual && (
              <Link href={`/dre?ate=${proximo}`} className="text-sm text-slate-600 underline">Próximos →</Link>
            )}
            <form method="get" className="flex items-center gap-2">
              <input type="month" name="ate" defaultValue={ate} max={atual} aria-label="Último mês exibido" className={`${classeCampo} w-auto`} />
              <button className={classeBotao}>Ver</button>
            </form>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <Aviso>
          Esta DRE é por <strong>regime de caixa</strong>: considera o que entrou e saiu das contas
          no mês, não a data de competência. Transações marcadas como “ignorar” e as das categorias
          “fora da DRE” (retiradas, empréstimos, aportes) não entram no resultado.
        </Aviso>
        {semCategoria > 0 && (
          <Aviso tipo="alerta">
            {semCategoria} transaç{semCategoria === 1 ? "ão" : "ões"} do período sem categoria estão
            somadas em “Outras receitas e despesas”.{" "}
            <Link href="/extrato?filtro=sem-categoria" className="font-medium underline">Categorizar</Link>
          </Aviso>
        )}
      </div>

      {!temDados ? (
        <EstadoVazio>Nenhuma transação no período de {nomeDoMes(de)} a {nomeDoMes(ate)}.</EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-176 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Conta</th>
                {meses.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-medium">{mesCurto(m)}</th>
                ))}
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => (
                <LinhaDre key={`${linha.rotulo}-${i}`} linha={linha} />
              ))}
              <LinhaDre linha={{ rotulo: "Margem bruta", valores: margem(lucroBruto), tipo: "margem" }} totalPercentual={percentualTotal(lucroBruto, receitaBruta)} />
              <LinhaDre linha={{ rotulo: "Margem do resultado", valores: margem(resultado), tipo: "margem" }} totalPercentual={percentualTotal(resultado, receitaBruta)} />
              <tr><td colSpan={meses.length + 2} className="h-3" /></tr>
              <LinhaDre linha={{ rotulo: "Informativo: movimentações fora da DRE", valores: foraDaDre, tipo: "informativo" }} />
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function percentualTotal(numerador: number[], base: number[]) {
  const b = base.reduce((t, v) => t + v, 0);
  return b ? (numerador.reduce((t, v) => t + v, 0) / b) * 100 : NaN;
}

function LinhaDre({ linha, totalPercentual }: { linha: Linha; totalPercentual?: number }) {
  const { rotulo, valores, tipo } = linha;
  const ehPercentual = tipo === "margem";
  const total = ehPercentual ? (totalPercentual ?? NaN) : valores.reduce((t, v) => t + v, 0);

  const estiloLinha = {
    grupo: "border-t border-slate-100 bg-white font-medium text-slate-900",
    subtotal: "border-t border-slate-300 bg-slate-50 font-semibold text-slate-900",
    detalhe: "text-slate-600",
    margem: "border-t border-slate-100 text-slate-600 italic",
    informativo: "border-t border-dashed border-slate-300 text-slate-500",
  }[tipo];

  const celula = (v: number) => {
    if (ehPercentual) return Number.isNaN(v) ? "—" : `${v.toFixed(1).replace(".", ",")}%`;
    return v === 0 && tipo === "detalhe" ? "—" : formatarMoeda(v);
  };
  const cor = (v: number) =>
    ehPercentual || tipo === "informativo" || tipo === "detalhe" ? "" : v < 0 ? "text-rose-700" : "";

  return (
    <tr className={estiloLinha}>
      <td className={`px-4 py-2 ${tipo === "detalhe" ? "pl-8 text-[13px]" : ""}`}>{rotulo}</td>
      {valores.map((v, i) => (
        <td key={i} className={`tabular px-3 py-2 text-right ${tipo === "detalhe" ? "text-[13px]" : ""} ${cor(v)}`}>
          {celula(v)}
        </td>
      ))}
      <td className={`tabular px-4 py-2 text-right ${tipo === "detalhe" ? "text-[13px]" : ""} ${cor(total)}`}>{celula(total)}</td>
    </tr>
  );
}
