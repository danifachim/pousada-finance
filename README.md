# Financeiro — controle dos meus negócios com Open Finance (Pluggy)

Sistema web para você e seu marido acompanharem as contas dos negócios. Os bancos são
conectados via **Pluggy (Open Finance)**: saldos e transações chegam sozinhos, e o sistema
organiza tudo em:

- **Painel**: saldos, faturas de cartão, entradas/saídas do mês, vencimentos e alertas.
- **Extrato**: todas as transações, com categoria editável e opção de ignorar.
- **Fluxo de caixa**: entradas e saídas dos últimos 12 meses, por categoria.
- **A pagar e a receber**: contas futuras, com sugestão automática de conciliação com o extrato.
- **DRE**: demonstrativo mensal (regime de caixa) a partir das categorias.
- **Categorias e regras**: regras que categorizam transações novas pela descrição.
- **Conexões**: conectar, atualizar, renovar o consentimento e remover bancos.

O sistema **só lê** os dados. Ele não faz pagamentos nem transferências.

Tecnologia: Next.js 16 (App Router) · Supabase (banco + login) · Pluggy SDK · Vercel (hospedagem).

---

## Passo a passo para colocar no ar

### 1. Pluggy (a ponte com os bancos)

1. Crie a conta em <https://dashboard.pluggy.ai> e uma **aplicação**.
2. Copie o **Client ID** e o **Client Secret**.
3. Confirme no seu plano se o **Open Finance** está habilitado (as conexões reais dependem disso).
4. Para testar sem conta real, use os bancos de teste do Pluggy (guia **Sandbox** em
   <https://docs.pluggy.ai>) e ligue `NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX=true`.

### 2. Supabase (banco de dados e login)

1. Crie um projeto em <https://supabase.com>.
2. Em **SQL Editor**, cole e rode o arquivo `supabase/migrations/0001_schema.sql`.
3. Ainda no SQL Editor, autorize os dois e-mails que vão usar o sistema:
   ```sql
   insert into public.usuarios_autorizados (email) values
     ('seu-email@exemplo.com'),
     ('email-do-seu-marido@exemplo.com');
   ```
4. Em **Authentication → Users → Add user**, crie os dois usuários (e-mail + senha), marcando
   “Auto confirm user”.
5. Em **Authentication → Sign In / Providers**, **desligue “Allow new users to sign up”**.
   Assim ninguém além de vocês consegue criar conta. Mesmo que conseguisse, a lista
   `usuarios_autorizados` impede o acesso aos dados.
6. Em **Project Settings → API**, copie a URL, a chave *publishable* e a chave *secret*.

### 3. Rodar no seu computador

```bash
cp .env.example .env.local   # preencha com as chaves acima
npm install
npm run dev                  # http://localhost:3000
```

Entre com um dos usuários, vá em **Conexões → Conectar banco** e autorize o acesso.
Localmente o webhook não funciona (o Pluggy precisa de uma URL pública); use o botão
**Atualizar** para puxar dados novos.

### 4. Publicar na Vercel (para acessar de qualquer lugar e receber atualização automática)

1. Suba o projeto para um repositório privado no GitHub e importe na Vercel
   (ou use `npx vercel`).
2. Cadastre as variáveis de ambiente do `.env.example` no projeto da Vercel.
   - `PLUGGY_WEBHOOK_SECRET`: gere com `openssl rand -hex 32`.
   - `NEXT_PUBLIC_APP_URL`: o endereço https do projeto (ex.: `https://financeiro-seunome.vercel.app`).
3. Publique de novo depois de definir `NEXT_PUBLIC_APP_URL`.

Com isso, cada conexão nova já nasce avisando o sistema (`/api/pluggy/webhook`) quando
chegam transações. Nada precisa ser cadastrado à mão no painel do Pluggy.

---

## Como funciona por dentro

```
Navegador ──(1) pede connect token──▶ /api/pluggy/connect-token ──▶ Pluggy
Navegador ◀────────── token (30 min) ─────────────────────────────────┘
Navegador: abre o widget do Pluggy, você autoriza no banco
Navegador ──(2) itemId──▶ /api/pluggy/items ──▶ busca contas + transações ──▶ Supabase
Pluggy ──(3) webhook──▶ /api/pluggy/webhook ──▶ atualiza contas e transações novas
```

- O **Client Secret do Pluggy e a chave secret do Supabase ficam só no servidor**. O navegador
  recebe apenas um *connect token* temporário.
- O webhook é público, mas exige o segredo `?token=` na URL e **nunca usa o corpo do aviso
  como dado**: ele só indica o que mudou, e os dados reais são buscados na API do Pluggy.
- As rotas que gravam dados confirmam que quem chama está logado **e** na lista de e-mails
  autorizados.
- No banco, cada tabela tem regras de acesso (RLS): só e-mails autorizados leem; transações só
  permitem mudar categoria, “ignorar” e observação; os dados do banco só o servidor grava.

### Estrutura

| Pasta | O que tem |
|---|---|
| `supabase/migrations/` | Esquema do banco, segurança e categorias iniciais |
| `src/lib/sync.ts` | Importação do Pluggy → banco, e tratamento dos webhooks |
| `src/app/api/pluggy/` | Rotas: connect-token, items, sync, webhook |
| `src/app/(app)/` | Telas (painel, extrato, fluxo de caixa, contas, DRE, categorias, conexões) |
| `src/proxy.ts` | Renova a sessão e redireciona quem não está logado |

---

## Pontos de atenção (leia antes de confiar nos números)

- **Pagamento de fatura de cartão aparece duas vezes** (saída na conta e crédito no cartão).
  O sistema marca como “ignorar” automaticamente o que parece pagamento de fatura (pela
  descrição), para não contar em dobro; as compras do cartão entram como despesa. Confira no
  Extrato (filtro “Só ignoradas”) e corrija se alguma descrição fugir do padrão. A mesma
  lógica serve para **transferências entre suas próprias contas**: marque como “ignorar”, ou
  crie uma regra com a opção “ignorar”.
- **A DRE é por regime de caixa** (o que entrou e saiu das contas), não por competência.
  Serve como visão gerencial; para fins contábeis/fiscais, confirme com seu contador.
- **Transações sem categoria** entram em “Outras receitas e despesas” na DRE. O painel avisa
  quantas faltam.
- **Open Finance pode demorar**: transações novas podem levar até 24 h para aparecer. Logo
  após conectar, o banco às vezes ainda não liberou as contas; use “Atualizar” depois de
  alguns minutos.
- **O consentimento vence.** O sistema avisa quando faltarem 15 dias ou menos; use
  **Reconectar** na tela de Conexões para renovar sem perder o histórico. **Remover** a
  conexão apaga as transações e categorias dela aqui.
- Contas **PJ** podem exigir passos extras em alguns bancos (por exemplo, usuário secundário
  no Santander PJ). A documentação do Pluggy tem tutoriais por instituição.
- O saldo e a fatura de cartão mostrados são os informados pelo banco no momento da última
  leitura (veja a data em Conexões).

## Próximos passos possíveis

- Lançamentos recorrentes (aluguel, folha) no “A pagar e a receber”.
- Separar os negócios por CNPJ, com visão consolidada.
- Conciliação automática por regra e importação de notas fiscais.
- Exportar DRE e extrato em planilha.

## Comandos úteis

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
npm run lint    # verificação de código
```
