import { FormularioLogin } from "./formulario";

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Financeiro</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Entre para ver as contas dos seus negócios.</p>
        <FormularioLogin />
      </div>
    </main>
  );
}
