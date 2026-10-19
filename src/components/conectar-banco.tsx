"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { classeBotao, classeBotaoSecundario } from "@/components/ui";

// O widget mexe no `window`, então só carrega no navegador.
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((modulo) => modulo.PluggyConnect),
  { ssr: false },
);

type Props = {
  /** Se informado, reconecta/renova essa conexão em vez de criar uma nova. */
  itemId?: string;
  rotulo: string;
  secundario?: boolean;
};

export function ConectarBanco({ itemId, rotulo, secundario = false }: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  async function abrirWidget() {
    setCarregando(true);
    setMensagem(null);
    try {
      const resposta = await fetch("/api/pluggy/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error ?? "Não foi possível iniciar a conexão.");
      setToken(dados.accessToken);
    } catch (erro) {
      setMensagem({
        texto: erro instanceof Error ? erro.message : "Não foi possível iniciar a conexão.",
        erro: true,
      });
    } finally {
      setCarregando(false);
    }
  }

  async function aoConcluir(dados: { item: { id: string } }) {
    setToken(null);
    setMensagem({ texto: "Importando os dados do banco…", erro: false });
    try {
      const resposta = await fetch("/api/pluggy/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: dados.item.id }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.error ?? "Falha ao importar os dados.");

      setMensagem({
        texto:
          resultado.contas > 0
            ? `Conexão feita: ${resultado.contas} conta(s) e ${resultado.transacoesNovas} transações novas importadas.`
            : "Conexão feita. O banco ainda está liberando os dados; eles aparecem aqui quando o Pluggy terminar a coleta (use “Atualizar” em alguns minutos).",
        erro: false,
      });
      router.refresh();
    } catch (erro) {
      setMensagem({
        texto: erro instanceof Error ? erro.message : "Falha ao importar os dados.",
        erro: true,
      });
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={abrirWidget}
        disabled={carregando}
        className={secundario ? classeBotaoSecundario : classeBotao}
      >
        {carregando ? "Abrindo…" : rotulo}
      </button>

      {mensagem && (
        <p
          role={mensagem.erro ? "alert" : "status"}
          className={`mt-2 max-w-md text-sm ${mensagem.erro ? "text-rose-700" : "text-slate-600"}`}
        >
          {mensagem.texto}
        </p>
      )}

      {token && (
        <PluggyConnect
          connectToken={token}
          updateItem={itemId}
          language="pt"
          includeSandbox={process.env.NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX === "true"}
          onSuccess={aoConcluir}
          onError={(erro) => {
            setToken(null);
            setMensagem({ texto: erro.message || "Não foi possível concluir a conexão.", erro: true });
          }}
          onClose={() => setToken(null)}
        />
      )}
    </div>
  );
}
