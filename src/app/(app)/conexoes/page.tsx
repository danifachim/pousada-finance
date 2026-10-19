import { AcoesConexao } from "@/components/acoes-conexao";
import { ConectarBanco } from "@/components/conectar-banco";
import { Aviso, Cabecalho, Cartao, EstadoVazio } from "@/components/ui";
import { diasAte, formatarDataHora } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Conexao } from "@/lib/types";

const STATUS: Record<string, { texto: string; cor: string }> = {
  UPDATED: { texto: "Atualizado", cor: "bg-emerald-100 text-emerald-800" },
  UPDATING: { texto: "Atualizando…", cor: "bg-sky-100 text-sky-800" },
  MERGING: { texto: "Atualizando…", cor: "bg-sky-100 text-sky-800" },
  WAITING_USER_INPUT: { texto: "Aguardando informação sua", cor: "bg-amber-100 text-amber-800" },
  WAITING_USER_ACTION: { texto: "Aguardando autorização no app do banco", cor: "bg-amber-100 text-amber-800" },
  LOGIN_ERROR: { texto: "Erro de login: reconecte", cor: "bg-rose-100 text-rose-800" },
  OUTDATED: { texto: "Desatualizado", cor: "bg-amber-100 text-amber-800" },
};

export default async function PaginaConexoes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conexoes")
    .select(
      "item_id, conector_nome, conector_logo, status, erro, ultima_atualizacao, consentimento_expira_em",
    )
    .order("conector_nome");
  const conexoes = (data ?? []) as Conexao[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookAtivo = appUrl.startsWith("https://") && Boolean(process.env.PLUGGY_WEBHOOK_SECRET);

  return (
    <>
      <Cabecalho
        titulo="Conexões"
        descricao="Bancos conectados via Open Finance (Pluggy). Você autoriza o acesso no próprio banco, e o sistema só consulta; ele não movimenta dinheiro."
        acoes={
          <>
            <ConectarBanco rotulo="Conectar banco" />
            {conexoes.length > 0 && <AcoesConexao />}
          </>
        }
      />

      {!webhookAtivo && (
        <div className="mb-4">
          <Aviso tipo="alerta">
            <strong>Atualização automática desligada.</strong> Para o Pluggy avisar o sistema
            sozinho quando chegarem transações novas, publique o sistema (ex.: Vercel) e configure{" "}
            <code>NEXT_PUBLIC_APP_URL</code> com o endereço https e o{" "}
            <code>PLUGGY_WEBHOOK_SECRET</code>. Enquanto isso, use o botão “Atualizar”.
          </Aviso>
        </div>
      )}

      {conexoes.length === 0 ? (
        <EstadoVazio>
          Nenhum banco conectado ainda. Clique em <strong>Conectar banco</strong>, escolha a
          instituição e autorize o compartilhamento dos dados.
        </EstadoVazio>
      ) : (
        <div className="space-y-3">
          {conexoes.map((c) => {
            const status = STATUS[c.status] ?? { texto: c.status, cor: "bg-slate-100 text-slate-700" };
            const diasConsentimento = diasAte(c.consentimento_expira_em);
            const consentimentoPerto = diasConsentimento !== null && diasConsentimento <= 15;
            const precisaReconectar = c.status === "LOGIN_ERROR" || c.status === "OUTDATED" || consentimentoPerto;

            return (
              <Cartao key={c.item_id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {c.conector_logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.conector_logo} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-contain p-1" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{c.conector_nome}</p>
                      <p className="text-xs text-slate-500">
                        Última leitura: {formatarDataHora(c.ultima_atualizacao)}
                      </p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.cor}`}>
                        {status.texto}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="flex flex-wrap gap-2">
                      <ConectarBanco itemId={c.item_id} rotulo="Reconectar" secundario />
                    </div>
                    <AcoesConexao itemId={c.item_id} nome={c.conector_nome} permitirRemover />
                  </div>
                </div>

                {c.erro && <p className="mt-3 text-sm text-rose-700">{c.erro}</p>}
                {c.consentimento_expira_em && (
                  <p className={`mt-3 text-sm ${consentimentoPerto ? "text-amber-800" : "text-slate-500"}`}>
                    Consentimento do Open Finance vale até {formatarDataHora(c.consentimento_expira_em)}
                    {diasConsentimento !== null && diasConsentimento >= 0
                      ? ` (${diasConsentimento} dia${diasConsentimento === 1 ? "" : "s"})`
                      : " (vencido)"}
                    .{precisaReconectar && " Use “Reconectar” para renovar sem perder o histórico."}
                  </p>
                )}
              </Cartao>
            );
          })}
        </div>
      )}
    </>
  );
}
