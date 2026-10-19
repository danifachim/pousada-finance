import Link from "next/link";
import { Aviso, Cabecalho, Cartao, EstadoVazio, Indicador } from "@/components/ui";
import {
  formatarData,
  diasAte,
  formatarMoeda,
  hojeYmd,
  limitesDoMes,
  mesAtual,
  nomeDoMes,
  somarDias,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ContaBancaria, Lancamento } from "@/lib/types";

const PROBLEMAS = new Set(["LOGIN_ERROR", "OUTDATED", "WAITING_USER_INPUT", "WAITING_USER_ACTION"]);

export default async function Painel() {
  const supabase = await createClient();
  const hoje = hojeYmd();
  const mes = mesAtual();
  const { inicio } = limitesDoMes(mes);

  const [contasRes, resumoRes, vencimentosRes, conexoesRes, semCategoriaRes] = await Promise.all([
    supabase
      .from("contas_bancarias")
      .select("*, conexoes(conector_nome)")
      .order("tipo")
      .order("nome"),
    supabase.from("resumo_mensal").select("entradas, saidas").eq("mes", inicio),
    supabase
      .from("lancamentos")
      .select("*")
      .eq("status", "aberto")
      .lte("vencimento", somarDias(hoje, 30))
      .order("vencimento")
      .limit(8),
    supabase.from("conexoes").select("item_id, conector_nome, status, consentimento_expira_em"),
    supabase
      .from("transacoes")
      .select("id", { count: "exact", head: true })
      .is("categoria_id", null)
      .eq("ignorar", false),
  ]);

  const contas = (contasRes.data ?? []) as ContaBancaria[];
  const vencimentos = (vencimentosRes.data ?? []) as Lancamento[];
  const conexoes = conexoesRes.data ?? [];
  const semCategoria = semCategoriaRes.count ?? 0;

  const saldoContas = contas.filter((c) => c.tipo === "BANK").reduce((t, c) => t + Number(c.saldo), 0);
  const faturas = contas.filter((c) => c.tipo === "CREDIT").reduce((t, c) => t + Number(c.saldo), 0);
  const entradas = (resumoRes.data ?? []).reduce((t, r) => t + Number(r.entradas), 0);
  const saidas = (resumoRes.data ?? []).reduce((t, r) => t + Number(r.saidas), 0);
  const resultado = entradas - saidas;

  const comProblema = conexoes.filter((c) => PROBLEMAS.has(c.status as string));
  const consentimentoPerto = conexoes.filter((c) => {
    const dias = diasAte(c.consentimento_expira_em as string | null);
    return dias !== null && dias <= 15;
  });

  if (!contas.length && !conexoes.length) {
    return (
      <>
        <Cabecalho titulo="Painel" />
        <EstadoVazio>
          Ainda não há dados. Comece <Link href="/conexoes" className="font-medium text-slate-900 underline">conectando seu primeiro banco</Link>.
        </EstadoVazio>
      </>
    );
  }

  return (
    <>
      <Cabecalho titulo="Painel" descricao={`Visão geral de ${nomeDoMes(mes)}.`} />

      <div className="mb-6 space-y-3">
        {comProblema.length > 0 && (
          <Aviso tipo="alerta">
            {comProblema.map((c) => c.conector_nome).join(", ")}: a conexão precisa de atenção.{" "}
            <Link href="/conexoes" className="font-medium underline">Ver conexões</Link>
          </Aviso>
        )}
        {consentimentoPerto.length > 0 && (
          <Aviso tipo="alerta">
            O consentimento de {consentimentoPerto.map((c) => c.conector_nome).join(", ")} está perto
            de vencer.{" "}
            <Link href="/conexoes" className="font-medium underline">Renovar</Link>
          </Aviso>
        )}
        {semCategoria > 0 && (
          <Aviso>
            {semCategoria} transaç{semCategoria === 1 ? "ão" : "ões"} sem categoria.{" "}
            <Link href="/extrato?filtro=sem-categoria" className="font-medium underline">Categorizar</Link>
          </Aviso>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Saldo em contas" valor={formatarMoeda(saldoContas)} />
        <Indicador
          rotulo="Faturas de cartão"
          valor={formatarMoeda(faturas)}
          detalhe="Fatura atual somada"
        />
        <Indicador rotulo="Entradas no mês" valor={formatarMoeda(entradas)} tom="positivo" />
        <Indicador
          rotulo="Saídas no mês"
          valor={formatarMoeda(saidas)}
          detalhe={`Resultado: ${formatarMoeda(resultado)}`}
          tom="negativo"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo="Contas e cartões">
          {contas.length === 0 ? (
            <p className="text-sm text-slate-500">
              Conexão feita, mas o banco ainda não liberou as contas. Tente “Atualizar” em{" "}
              <Link href="/conexoes" className="underline">Conexões</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contas.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{c.nome}</p>
                    <p className="text-xs text-slate-500">
                      {c.conexoes?.conector_nome}
                      {c.tipo === "CREDIT" && c.fatura_vencimento && ` · vence ${formatarData(c.fatura_vencimento)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm font-semibold text-slate-900">{formatarMoeda(c.saldo)}</p>
                    <p className="text-xs text-slate-500">
                      {c.tipo === "CREDIT"
                        ? c.limite_disponivel !== null
                          ? `Fatura · limite livre ${formatarMoeda(c.limite_disponivel)}`
                          : "Fatura atual"
                        : "Saldo"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Vencimentos nos próximos 30 dias">
          {vencimentos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nada em aberto para os próximos 30 dias.{" "}
              <Link href="/contas" className="underline">Cadastrar contas</Link>
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {vencimentos.map((l) => {
                const atrasado = l.vencimento < hoje;
                return (
                  <li key={l.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{l.descricao}</p>
                      <p className={`text-xs ${atrasado ? "font-medium text-rose-700" : "text-slate-500"}`}>
                        {l.tipo === "pagar" ? "A pagar" : "A receber"} · {atrasado ? "venceu em" : "vence em"}{" "}
                        {formatarData(l.vencimento)}
                      </p>
                    </div>
                    <p
                      className={`tabular text-sm font-semibold ${
                        l.tipo === "pagar" ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {l.tipo === "pagar" ? "−" : "+"}
                      {formatarMoeda(l.valor)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
