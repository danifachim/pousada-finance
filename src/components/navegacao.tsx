"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Painel" },
  { href: "/extrato", rotulo: "Extrato" },
  { href: "/fluxo-de-caixa", rotulo: "Fluxo de caixa" },
  { href: "/contas", rotulo: "A pagar e a receber" },
  { href: "/dre", rotulo: "DRE" },
  { href: "/categorias", rotulo: "Categorias" },
  { href: "/conexoes", rotulo: "Conexões" },
];

export function Navegacao() {
  const caminho = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Principal">
      {ITENS.map((item) => {
        const ativo = item.href === "/" ? caminho === "/" : caminho.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              ativo ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
