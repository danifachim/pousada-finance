export type GrupoDre =
  | "receita_bruta"
  | "deducoes"
  | "custos"
  | "despesas_operacionais"
  | "despesas_financeiras"
  | "outras"
  | "fora_dre";

export const NOMES_GRUPO_DRE: Record<GrupoDre, string> = {
  receita_bruta: "Receita bruta",
  deducoes: "Deduções (impostos e taxas sobre vendas)",
  custos: "Custos diretos",
  despesas_operacionais: "Despesas operacionais",
  despesas_financeiras: "Despesas financeiras",
  outras: "Outras receitas e despesas",
  fora_dre: "Fora da DRE (retiradas, empréstimos, aportes)",
};

export type Categoria = {
  id: string;
  nome: string;
  grupo_dre: GrupoDre;
};

export type Conexao = {
  item_id: string;
  conector_nome: string;
  conector_logo: string | null;
  status: string;
  erro: string | null;
  ultima_atualizacao: string | null;
  consentimento_expira_em: string | null;
};

export type ContaBancaria = {
  id: string;
  item_id: string;
  tipo: "BANK" | "CREDIT";
  subtipo: string | null;
  nome: string;
  numero: string | null;
  saldo: number;
  moeda: string;
  limite_credito: number | null;
  limite_disponivel: number | null;
  fatura_vencimento: string | null;
  fatura_valor_minimo: number | null;
  conexoes: { conector_nome: string } | null;
};

export type Transacao = {
  id: string;
  conta_id: string;
  data: string;
  descricao: string;
  valor: number;
  status: string;
  categoria_pluggy: string | null;
  categoria_id: string | null;
  ignorar: boolean;
  observacao: string | null;
  contas_bancarias: { nome: string; conexoes: { conector_nome: string } | null } | null;
};

export type Lancamento = {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  contraparte: string | null;
  valor: number;
  vencimento: string;
  status: "aberto" | "pago" | "cancelado";
  categoria_id: string | null;
  pago_em: string | null;
  transacao_id: string | null;
  observacao: string | null;
};

export type ResumoMensal = {
  mes: string;
  categoria_id: string | null;
  entradas: number;
  saidas: number;
  qtd: number;
};

export type RegraCategoria = {
  id: string;
  termo: string;
  categoria_id: string;
  ignorar: boolean;
};
