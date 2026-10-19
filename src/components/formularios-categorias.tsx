"use client";

import { useActionState } from "react";
import {
  aplicarRegras,
  criarCategoria,
  criarRegra,
  type EstadoForm,
} from "@/app/(app)/categorias/actions";
import { classeBotao, classeBotaoSecundario, classeCampo } from "@/components/ui";
import { NOMES_GRUPO_DRE, type Categoria, type GrupoDre } from "@/lib/types";

function Mensagem({ estado }: { estado: EstadoForm }) {
  if (estado?.erro) return <p role="alert" className="text-sm text-rose-700">{estado.erro}</p>;
  if (estado?.ok) return <p role="status" className="text-sm text-emerald-700">{estado.ok}</p>;
  return null;
}

export function FormNovaCategoria() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(criarCategoria, undefined);
  const grupos = Object.keys(NOMES_GRUPO_DRE) as GrupoDre[];

  return (
    <form action={acao} className="space-y-3">
      <label className="block text-xs font-medium text-slate-600">
        Nome
        <input name="nome" required maxLength={60} className={`${classeCampo} mt-1`} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Onde entra na DRE
        <select name="grupo_dre" required defaultValue="" className={`${classeCampo} mt-1`}>
          <option value="" disabled>Escolha…</option>
          {grupos.map((g) => (
            <option key={g} value={g}>{NOMES_GRUPO_DRE[g]}</option>
          ))}
        </select>
      </label>
      <button disabled={pendente} className={classeBotao}>{pendente ? "Criando…" : "Criar categoria"}</button>
      <Mensagem estado={estado} />
    </form>
  );
}

export function FormNovaRegra({ categorias }: { categorias: Categoria[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(criarRegra, undefined);

  return (
    <form action={acao} className="space-y-3">
      <label className="block text-xs font-medium text-slate-600">
        Quando a descrição contiver
        <input name="termo" required minLength={3} maxLength={80} placeholder="ex.: tarifa pacote" className={`${classeCampo} mt-1`} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Usar a categoria
        <select name="categoria_id" required defaultValue="" className={`${classeCampo} mt-1`}>
          <option value="" disabled>Escolha…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="ignorar" className="h-4 w-4 rounded border-slate-300" />
        Também ignorar nos relatórios (ex.: transferência entre minhas contas)
      </label>
      <button disabled={pendente} className={classeBotao}>{pendente ? "Criando…" : "Criar regra"}</button>
      <Mensagem estado={estado} />
    </form>
  );
}

export function BotaoAplicarRegras() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(() => aplicarRegras(), undefined);
  return (
    <form action={acao} className="space-y-2">
      <button disabled={pendente} className={classeBotaoSecundario}>
        {pendente ? "Aplicando…" : "Aplicar regras agora"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}
