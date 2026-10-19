import Link from "next/link";
import { Aviso, Cabecalho, Cartao, EstadoVazio, classeBotao, classeBotaoSecundario, classeCampo } from "@/components/ui";
import { LinhaTransacao } from "@/components/linha-transacao";
import { limitesDoMes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, Transacao } from "@/lib/types";

const POR_PAGINA = 50;

type Params = { [chave: string]: string | string[] | undefined };

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export default async function PaginaExtrato({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const conta = primeiro(params.conta);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(primeiro(params.mes)) ? primeiro(params.mes) : "";
  const q = primeiro(params.q).trim().slice(0, 80);
  const filtro = ["sem-categoria", "ignoradas"].includes(primeiro(params.filtro)) ? primeiro(params.filtro) : "";
  const pagina = Math.max(1, Number.parseInt(primeiro(params.pagina), 10) || 1);

  const supabase = await createClient();

  let consulta = supabase
    .from("transacoes")
    .select(
      "id, conta_id, data, descricao, valor, status, categoria_pluggy, categoria_id, ignorar, observacao, contas_bancarias(nome, conexoes(conector_nome))",
      { count: "exact" },
    )
    .order("data", { ascending: false })
    .order("id")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  if (conta) consulta = consulta.eq("conta_id", conta);
  if (mes) {
    const { inicio, fim } = limitesDoMes(mes);
    consulta = consulta.gte("data", inicio).lte("data", fim);
  }
  if (q) consulta = consulta.ilike("descricao", `%${q.replace(/[%_]/g, "")}%`);
  if (filtro === "sem-categoria") consulta = consulta.is("categoria_id", null).eq("ignorar", false);
  if (filtro === "ignoradas") consulta = consulta.eq("ignorar", true);

  const [transacoesRes, contasRes, categoriasRes] = await Promise.all([
    consulta,
    supabase.from("contas_bancarias").select("id, nome, conexoes(conector_nome)").order("nome"),
    supabase.from("categorias").select("id, nome, grupo_dre").order("nome"),
  ]);

  const transacoes = (transacoesRes.data ?? []) as unknown as Transacao[];
  const total = transacoesRes.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const categorias = (categoriasRes.data ?? []) as Categoria[];
  const contas = (contasRes.data ?? []) as unknown as {
    id: string;
    nome: string;
    conexoes: { conector_nome: string } | null;
  }[];

  function link(novaPagina: number) {
    const p = new URLSearchParams();
    if (conta) p.set("conta", conta);
    if (mes) p.set("mes", mes);
    if (q) p.set("q", q);
    if (filtro) p.set("filtro", filtro);
    if (novaPagina > 1) p.set("pagina", String(novaPagina));
    const texto = p.toString();
    return texto ? `/extrato?${texto}` : "/extrato";
  }

  return (
    <>
      <Cabecalho
        titulo="Extrato"
        descricao="Todas as transações das contas e cartões conectados. Defina a categoria de cada uma; marque “ignorar” nas que não são receita nem despesa (ex.: transferência entre suas contas)."
      />

      <Cartao className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <label className="text-xs font-medium text-slate-600">
            Conta
            <select name="conta" defaultValue={conta} className={`${classeCampo} mt-1`}>
              <option value="">Todas</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.conexoes?.conector_nome} · {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Mês
            <input type="month" name="mes" defaultValue={mes} className={`${classeCampo} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Descrição contém
            <input type="search" name="q" defaultValue={q} maxLength={80} className={`${classeCampo} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Mostrar
            <select name="filtro" defaultValue={filtro} className={`${classeCampo} mt-1`}>
              <option value="">Todas</option>
              <option value="sem-categoria">Só sem categoria</option>
              <option value="ignoradas">Só ignoradas</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className={classeBotao}>Filtrar</button>
            <Link href="/extrato" className={classeBotaoSecundario}>Limpar</Link>
          </div>
        </form>
      </Cartao>

      {transacoesRes.error && <Aviso tipo="erro">Não foi possível carregar as transações.</Aviso>}

      {transacoes.length === 0 && !transacoesRes.error ? (
        <EstadoVazio>Nenhuma transação encontrada com esses filtros.</EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 font-medium">Categoria</th>
                <th className="px-3 py-2 text-center font-medium">Ignorar</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.map((t) => (
                <LinhaTransacao key={t.id} transacao={t} categorias={categorias} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <p>
          {total} transaç{total === 1 ? "ão" : "ões"} · página {Math.min(pagina, totalPaginas)} de {totalPaginas}
        </p>
        <div className="flex gap-2">
          {pagina > 1 && (
            <Link href={link(pagina - 1)} className={classeBotaoSecundario}>← Anterior</Link>
          )}
          {pagina < totalPaginas && (
            <Link href={link(pagina + 1)} className={classeBotaoSecundario}>Próxima →</Link>
          )}
        </div>
      </div>
    </>
  );
}
