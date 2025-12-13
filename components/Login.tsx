import React, { useState } from "react";
import { Lock, ArrowRight, Wallet, Loader2, LogIn, UserPlus } from "lucide-react";
import { api } from "../services/api";
import { FinanceDataset, User } from "../types";

interface LoginProps {
  onLogin: (session: { user: User; token: string; data: FinanceDataset }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("demo@financas.com");
  const [password, setPassword] = useState("123456");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const auth =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(name || email.split("@")[0], email, password);

      const data = await api.fetchData();
      onLogin({ user: auth.user, token: auth.token, data });
    } catch (err: any) {
      setError(err?.message || "Falha na autenticacao");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center mb-4 backdrop-blur-sm">
            <Wallet className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Financas Pro AI</h1>
          <p className="text-indigo-100 text-sm mt-2">Sua gestao financeira inteligente</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Como quer ser chamado"
                  required={mode === "register"}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="******"
                  required
                />
              </div>
            </div>

            {error && <p className="text-rose-500 text-sm text-center font-medium bg-rose-50 p-2 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Aguarde...
                </>
              ) : mode === "login" ? (
                <>
                  Entrar na Conta
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <>
                  Criar Conta
                  <UserPlus className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center space-y-3">
            <p className="text-slate-500 text-sm">
              Acesso rapido: <span className="font-semibold text-slate-700">demo@financas.com / 123456</span>
            </p>
            <button
              className="w-full border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? (
                <>
                  <UserPlus className="w-4 h-4" /> Criar conta nova
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Ja tenho conta
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
