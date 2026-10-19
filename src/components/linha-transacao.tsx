"use client";

import { useState, useTransition } from "react";
import { atualizarTransacao } from "@/app/(app)/extrato/actions";
import { formatarData, formatarMoeda } from "@/lib/format";
import { NOMES_GRUPO_DRE, type Categoria, type GrupoDre, type Transacao } from "@/lib/types";

export function SeletorCategoria({
  categorias,
  valor,
  onChange,
  desabilitado,
  rotulo,
}: {
  categorias: Categoria[];
  valor: string;
  onChange: (id: string) => void;
  desabilitado?: boolean;
  rotulo: string;
}) {
  const grupos = Object.keys(NOMES_GRUPO_DRE) as GrupoDre[];
  return (
    <select
      aria-label={rotulo}
      value={valor}
      disabled={desabilitado}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-44 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
    >
      <option value="">Sem categoria</option>
      {grupos.map((grupo) => {
        const doGrupo = categorias.filter((c) => c.grupo_dre === grupo);
        if (!doGrupo.length) return null;
        return (
          <optgroup key={grupo} label={NOMES_GRUPO_DRE[grupo]}>
            {doGrupo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

export function LinhaTransacao({
  transacao,
  categorias,
}: {
  transacao: Transacao;
  categorias: Categoria[];
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar(campos: { categoria_id?: string | null; ignorar?: boolean }) {
    iniciar(async () => {
      const resultado = await atualizarTransacao(transacao.id, campos);
      setErro(resultado.ok ? null : (resultado.erro ?? "Falha ao salvar."));
    });
  }

  const conta = transacao.contas_bancarias;

  return (
    <tr className={`border-t border-slate-100 align-top ${transacao.ignorar ? "bg-slate-50 text-slate-500" : ""}`}>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm">{formatarData(transacao.data)}</td>
      <td className="px-3 py-2.5">
        <p className="text-sm text-slate-900">
          {transacao.descricao}
          {transacao.status === "PENDING" && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">pendente</span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {conta?.conexoes?.conector_nome} · {conta?.nome}
        </p>
        {erro && <p role="alert" className="mt-1 text-xs text-rose-700">{erro}</p>}
      </td>
      <td className="px-3 py-2.5">
        <SeletorCategoria
          categorias={categorias}
          valor={transacao.categoria_id ?? ""}
          desabilitado={pendente}
          rotulo={`Categoria de ${transacao.descricao}`}
          onChange={(id) => salvar({ categoria_id: id || null })}
        />
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={transacao.ignorar}
          disabled={pendente}
          onChange={(e) => salvar({ ignorar: e.target.checked })}
          aria-label={`Ignorar nos relatórios: ${transacao.descricao}`}
          className="h-4 w-4 rounded border-slate-300"
        />
      </td>
      <td
        className={`tabular whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium ${
          transacao.valor >= 0 ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        {formatarMoeda(transacao.valor)}
      </td>
    </tr>
  );
}
