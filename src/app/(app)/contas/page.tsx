import Link from "next/link";
import { cancelar, conciliar, excluir, marcarPago, reabrir } from "./actions";
import { FormLancamento } from "@/components/form-lancamento";
import {
  Cabecalho,
  Cartao,
  EstadoVazio,
  classeBotao,
  classeBotaoSecundario,
  classeCampo,
} from "@/components/ui";
import { formatarData, formatarMoeda, hojeYmd, somarDias } from "@/lib/format";
import { carregarCategorias } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";
import type { Lancamento } from "@/lib/types";

type Params = { [chave: string]: string | string[] | undefined };

type Sugestao = { id: string; data: string; descricao: string; valor: number };

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

const MAX_SUGESTOES = 30;

export default async function PaginaContas({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const tipo = ["pagar", "receber"].includes(primeiro(params.tipo)) ? primeiro(params.tipo) : "";
  const status = ["aberto", "pago", "cancelado", "todos"].includes(primeiro(params.status))
    ? primeiro(params.status)
    : "aberto";
  const hoje = hojeYmd();

  const supabase = await createClient();

  let consulta = supabase
    .from("lancamentos")
    .select("*")
    .order("vencimento", { ascending: status === "aberto" })
    .limit(200);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (status !== "todos") consulta = consulta.eq("status", status);

  const [lancamentosRes, categorias, vinculadasRes] = await Promise.all([
    consulta,
    carregarCategorias(supabase),
    supabase.from("lancamentos").select("transacao_id").not("transacao_id", "is", null),
  ]);

  const lancamentos = (lancamentosRes.data ?? []) as Lancamento[];
  const jaVinculadas = new Set((vinculadasRes.data ?? []).map((l) => l.transacao_id as string));

  // Para cada conta em aberto, procura no extrato um lançamento do mesmo valor perto do vencimento.
  const abertas = lancamentos.filter((l) => l.status === "aberto").slice(0, MAX_SUGESTOES);
  const sugestoes = new Map<string, Sugestao[]>();
  await Promise.all(
    abertas.map(async (l) => {
      const alvo = l.tipo === "pagar" ? -Number(l.valor) : Number(l.valor);
      const { data } = await supabase
        .from("transacoes")
        .select("id, data, descricao, valor")
        .eq("valor", alvo)
        .eq("ignorar", false)
        .gte("data", somarDias(l.vencimento, -7))
        .lte("data", somarDias(l.vencimento, 15))
        .limit(5);
      const candidatas = ((data ?? []) as Sugestao[]).filter((t) => !jaVinculadas.has(t.id));
      if (candidatas.length) sugestoes.set(l.id, candidatas.slice(0, 2));
    }),
  );

  const totalAPagar = lancamentos
    .filter((l) => l.status === "aberto" && l.tipo === "pagar")
    .reduce((t, l) => t + Number(l.valor), 0);
  const totalAReceber = lancamentos
    .filter((l) => l.status === "aberto" && l.tipo === "receber")
    .reduce((t, l) => t + Number(l.valor), 0);
  const nomeCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nome;

  return (
    <>
      <Cabecalho
        titulo="A pagar e a receber"
        descricao="Cadastre o que você vai pagar e receber. Quando o pagamento aparece no extrato, o sistema sugere a conciliação."
      />

      <Cartao titulo="Novo lançamento" className="mb-6">
        <FormLancamento categorias={categorias} />
      </Cartao>

      <Cartao className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Tipo
            <select name="tipo" defaultValue={tipo} className={`${classeCampo} mt-1 w-auto`}>
              <option value="">Todos</option>
              <option value="pagar">A pagar</option>
              <option value="receber">A receber</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Situação
            <select name="status" defaultValue={status} className={`${classeCampo} mt-1 w-auto`}>
              <option value="aberto">Em aberto</option>
              <option value="pago">Pagos / recebidos</option>
              <option value="cancelado">Cancelados</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <button className={classeBotao}>Filtrar</button>
          <Link href="/contas" className={classeBotaoSecundario}>Limpar</Link>
          <p className="ml-auto text-sm text-slate-600">
            Em aberto nesta lista:{" "}
            <strong className="text-rose-700">pagar {formatarMoeda(totalAPagar)}</strong> ·{" "}
            <strong className="text-emerald-700">receber {formatarMoeda(totalAReceber)}</strong>
          </p>
        </form>
      </Cartao>

      {lancamentos.length === 0 ? (
        <EstadoVazio>Nenhum lançamento encontrado.</EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Vencimento</th>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Situação</th>
                <th className="px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => {
                const atrasado = l.status === "aberto" && l.vencimento < hoje;
                const sugeridas = sugestoes.get(l.id) ?? [];
                return (
                  <FragmentoLinha key={l.id}>
                    <tr className="border-t border-slate-100 align-top">
                      <td className={`whitespace-nowrap px-3 py-2.5 ${atrasado ? "font-medium text-rose-700" : ""}`}>
                        {formatarData(l.vencimento)}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-slate-900">{l.descricao}</p>
                        <p className="text-xs text-slate-500">
                          {l.tipo === "pagar" ? "A pagar" : "A receber"}
                          {l.contraparte && ` · ${l.contraparte}`}
                          {nomeCategoria(l.categoria_id) && ` · ${nomeCategoria(l.categoria_id)}`}
                        </p>
                      </td>
                      <td
                        className={`tabular whitespace-nowrap px-3 py-2.5 text-right font-medium ${
                          l.tipo === "pagar" ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {formatarMoeda(l.valor)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                        {l.status === "aberto" && (atrasado ? <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-800">Atrasado</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Em aberto</span>)}
                        {l.status === "pago" && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                            {l.tipo === "pagar" ? "Pago" : "Recebido"} em {formatarData(l.pago_em)}
                            {l.transacao_id && " · conciliado"}
                          </span>
                        )}
                        {l.status === "cancelado" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Cancelado</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          {l.status === "aberto" ? (
                            <>
                              <AcaoForm acao={marcarPago} id={l.id} rotulo={l.tipo === "pagar" ? "Marcar como pago" : "Marcar como recebido"} />
                              <AcaoForm acao={cancelar} id={l.id} rotulo="Cancelar" />
                            </>
                          ) : (
                            <AcaoForm acao={reabrir} id={l.id} rotulo="Reabrir" />
                          )}
                          <AcaoForm acao={excluir} id={l.id} rotulo="Excluir" perigo />
                        </div>
                      </td>
                    </tr>
                    {sugeridas.map((t) => (
                      <tr key={t.id} className="bg-amber-50/60 text-xs text-amber-900">
                        <td colSpan={5} className="px-3 py-2">
                          <form action={conciliar} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="lancamento_id" value={l.id} />
                            <input type="hidden" name="transacao_id" value={t.id} />
                            <span>
                              Possível {l.tipo === "pagar" ? "pagamento" : "recebimento"} no extrato:{" "}
                              <strong>{t.descricao}</strong> em {formatarData(t.data)} ({formatarMoeda(t.valor)})
                            </span>
                            <button className="rounded-md border border-amber-300 bg-white px-2 py-1 font-medium hover:bg-amber-100">
                              Conciliar
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </FragmentoLinha>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FragmentoLinha({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AcaoForm({
  acao,
  id,
  rotulo,
  perigo = false,
}: {
  acao: (formData: FormData) => Promise<void>;
  id: string;
  rotulo: string;
  perigo?: boolean;
}) {
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <button
        className={`rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50 ${
          perigo ? "border-slate-200 text-rose-700" : "border-slate-300 text-slate-700"
        }`}
      >
        {rotulo}
      </button>
    </form>
  );
}
