"use client";

import { useActionState, useRef } from "react";
import { criarLancamento, type EstadoForm } from "@/app/(app)/contas/actions";
import { classeBotao, classeCampo } from "@/components/ui";
import type { Categoria } from "@/lib/types";

export function FormLancamento({ categorias }: { categorias: Categoria[] }) {
  const formulario = useRef<HTMLFormElement>(null);

  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(async (anterior, dados) => {
    const resultado = await criarLancamento(anterior, dados);
    if (resultado?.ok) formulario.current?.reset();
    return resultado;
  }, undefined);

  return (
    <form ref={formulario} action={acao} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="text-xs font-medium text-slate-600">
        Tipo
        <select name="tipo" required defaultValue="pagar" className={`${classeCampo} mt-1`}>
          <option value="pagar">A pagar</option>
          <option value="receber">A receber</option>
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600 lg:col-span-2">
        Descrição
        <input name="descricao" required maxLength={120} className={`${classeCampo} mt-1`} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Valor (R$)
        <input name="valor" required inputMode="decimal" placeholder="1.250,90" className={`${classeCampo} mt-1`} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Vencimento
        <input type="date" name="vencimento" required className={`${classeCampo} mt-1`} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Fornecedor / cliente
        <input name="contraparte" maxLength={120} className={`${classeCampo} mt-1`} />
      </label>
      <label className="text-xs font-medium text-slate-600 lg:col-span-2">
        Categoria
        <select name="categoria_id" defaultValue="" className={`${classeCampo} mt-1`}>
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600 lg:col-span-2">
        Observação
        <input name="observacao" maxLength={300} className={`${classeCampo} mt-1`} />
      </label>
      <div className="flex items-end gap-3 lg:col-span-2">
        <button disabled={pendente} className={classeBotao}>{pendente ? "Salvando…" : "Adicionar"}</button>
        {estado?.erro && <p role="alert" className="text-sm text-rose-700">{estado.erro}</p>}
        {estado?.ok && <p role="status" className="text-sm text-emerald-700">{estado.ok}</p>}
      </div>
    </form>
  );
}
