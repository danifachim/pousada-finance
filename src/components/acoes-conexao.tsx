"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { classeBotaoSecundario } from "@/components/ui";

type Props = {
  /** Sem itemId: atualiza todas as conexões. */
  itemId?: string;
  nome?: string;
  permitirRemover?: boolean;
};

export function AcoesConexao({ itemId, nome, permitirRemover = false }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<"atualizar" | "remover" | null>(null);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  async function atualizar() {
    setOcupado("atualizar");
    setMensagem(null);
    try {
      const resposta = await fetch("/api/pluggy/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, atualizarNoBanco: true }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error ?? "Falha ao atualizar.");

      const novas = (dados.resultados as { transacoesNovas: number }[]).reduce(
        (total, r) => total + r.transacoesNovas,
        0,
      );
      const avisos = (dados.avisos as string[]).join(" ");
      setMensagem({
        texto: `Atualizado: ${novas} transações novas. Pedimos ao banco dados mais recentes; se algo mudar, aparece aqui em alguns minutos. ${avisos}`.trim(),
        erro: false,
      });
      router.refresh();
    } catch (erro) {
      setMensagem({ texto: erro instanceof Error ? erro.message : "Falha ao atualizar.", erro: true });
    } finally {
      setOcupado(null);
    }
  }

  async function remover() {
    const confirmado = window.confirm(
      `Remover a conexão${nome ? ` com ${nome}` : ""}?\n\nIsso apaga também as contas e TODAS as transações dela aqui no sistema (incluindo categorias que você já definiu). Para só renovar a autorização, use “Reconectar”.`,
    );
    if (!confirmado || !itemId) return;

    setOcupado("remover");
    setMensagem(null);
    try {
      const resposta = await fetch(`/api/pluggy/items?itemId=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error ?? "Falha ao remover.");
      router.refresh();
    } catch (erro) {
      setMensagem({ texto: erro instanceof Error ? erro.message : "Falha ao remover.", erro: true });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={atualizar} disabled={ocupado !== null} className={classeBotaoSecundario}>
          {ocupado === "atualizar" ? "Atualizando…" : itemId ? "Atualizar" : "Atualizar tudo"}
        </button>
        {permitirRemover && (
          <button
            type="button"
            onClick={remover}
            disabled={ocupado !== null}
            className={`${classeBotaoSecundario} text-rose-700`}
          >
            {ocupado === "remover" ? "Removendo…" : "Remover"}
          </button>
        )}
      </div>
      {mensagem && (
        <p
          role={mensagem.erro ? "alert" : "status"}
          className={`mt-2 max-w-md text-sm ${mensagem.erro ? "text-rose-700" : "text-slate-600"}`}
        >
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
