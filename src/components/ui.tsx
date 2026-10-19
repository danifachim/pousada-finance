import type { ReactNode } from "react";

export function Cabecalho({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-2xl text-sm text-slate-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({
  titulo,
  children,
  className = "",
}: {
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      {titulo && <h2 className="mb-3 text-sm font-semibold text-slate-900">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "positivo" | "negativo";
}) {
  const cor =
    tom === "positivo" ? "text-emerald-700" : tom === "negativo" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={`tabular mt-2 text-2xl font-semibold ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

export function Aviso({
  tipo = "info",
  children,
}: {
  tipo?: "info" | "alerta" | "erro";
  children: ReactNode;
}) {
  const estilos = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    alerta: "border-amber-200 bg-amber-50 text-amber-900",
    erro: "border-rose-200 bg-rose-50 text-rose-900",
  }[tipo];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${estilos}`}>{children}</div>;
}

export function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export const classeBotao =
  "inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60";

export const classeBotaoSecundario =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";

export const classeCampo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900";
