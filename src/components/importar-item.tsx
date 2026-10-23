"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { classeBotaoSecundario } from "@/components/ui";

const PADRAO_ITEM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Importa uma conexão criada fora do sistema (no painel do Pluggy, via Meu
 * Pluggy) colando o Item ID. Útil quando a conta do Pluggy não permite criar
 * conexões pelo widget (ex.: TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED).
 */
export function ImportarItem() {
  const router = useRouter();
  const [itemId, setItemId] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  async function importar(evento: React.FormEvent) {
    evento.preventDefault();
    const id = itemId.trim();
    if (!PADRAO_ITEM_ID.test(id)) {
      setMensagem({
        texto: "Esse código não parece um Item ID. Ele tem o formato 1a2b3c4d-1234-5678-9abc-1234567890ab.",
        erro: true,
      });
      return;
    }

    setOcupado(true);
    setMensagem({ texto: "Importando contas e transações…", erro: false });
    try {
      const resposta = await fetch("/api/pluggy/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: id }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error ?? "Falha ao importar.");

      setMensagem({
        texto:
          `Importado: ${dados.contas} conta(s) e ${dados.transacoesNovas} transações novas.` +
          (dados.webhookAtivo
            ? " As próximas atualizações chegam sozinhas."
            : " A atualização automática não pôde ser ligada; use “Atualizar” de vez em quando."),
        erro: false,
      });
      setItemId("");
      router.refresh();
    } catch (erro) {
      setMensagem({ texto: erro instanceof Error ? erro.message : "Falha ao importar.", erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={importar}>
      <label htmlFor="item-id" className="text-sm font-medium text-slate-900">
        Importar conexão pelo Item ID
      </label>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Para contas ligadas no Meu Pluggy: no painel do Pluggy, crie a conexão escolhendo
        “MeuPluggy” e copie o <strong>Item ID</strong> dela. Cole aqui uma conexão por vez.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          id="item-id"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          placeholder="1a2b3c4d-1234-5678-9abc-1234567890ab"
          autoComplete="off"
          spellCheck={false}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
        />
        <button type="submit" disabled={ocupado || !itemId.trim()} className={classeBotaoSecundario}>
          {ocupado ? "Importando…" : "Importar"}
        </button>
      </div>
      {mensagem && (
        <p
          role={mensagem.erro ? "alert" : "status"}
          className={`mt-2 max-w-2xl text-sm ${mensagem.erro ? "text-rose-700" : "text-slate-600"}`}
        >
          {mensagem.texto}
        </p>
      )}
    </form>
  );
}
