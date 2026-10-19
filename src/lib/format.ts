const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarMoeda(valor: number | null | undefined): string {
  return brl.format(Number(valor ?? 0));
}

/** "2026-10-19" -> "19/10/2026" (sem passar por Date, para não deslocar o dia por fuso). */
export function formatarData(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const [a, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatarDataHora(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

const NOMES_MES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-10" ou "2026-10-01" -> "Outubro/2026" */
export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-");
  const nome = NOMES_MES[Number(m) - 1] ?? m;
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${ano}`;
}

/** "2026-10" ou "2026-10-01" -> "out/26" */
export function mesCurto(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${(NOMES_MES[Number(m) - 1] ?? m).slice(0, 3)}/${ano.slice(2)}`;
}

/** Hoje (fuso de São Paulo) como "YYYY-MM-DD". */
export function hojeYmd(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Mês atual como "YYYY-MM" (fuso de São Paulo). */
export function mesAtual(): string {
  return hojeYmd().slice(0, 7);
}

/** Soma (ou subtrai) meses de um "YYYY-MM". */
export function somarMeses(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  const ano = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${ano}-${String(novoMes).padStart(2, "0")}`;
}

/** Lista de meses de `de` até `ate` (inclusive), "YYYY-MM". */
export function intervaloDeMeses(de: string, ate: string): string[] {
  const lista: string[] = [];
  for (let m = de; m <= ate; m = somarMeses(m, 1)) lista.push(m);
  return lista;
}

/** Primeiro e último dia de um "YYYY-MM", como "YYYY-MM-DD". */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** Valida um parâmetro "YYYY-MM" vindo da URL; se for inválido, usa o padrão. */
export function mesValido(valor: string | undefined, padrao: string): string {
  return valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : padrao;
}

/** Converte "1.234,56", "1234,56" ou "1234.56" em número positivo com 2 casas; inválido => null. */
export function parseValorBr(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100) / 100;
  return n > 0 ? n : null;
}

/** Soma (ou subtrai) dias de uma data "YYYY-MM-DD". */
export function somarDias(ymd: string, dias: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + dias * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function dataValida(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && !Number.isNaN(Date.parse(`${ymd}T00:00:00Z`));
}

/** Quantos dias faltam até um instante ISO (negativo se já passou); null se não houver data. */
export function diasAte(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  return Math.ceil((new Date(isoString).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
