import React, { useMemo, useState } from "react";
import { Goal } from "../types";
import { Target, Trophy, Plus, Pencil, Trash2, Calendar, Wallet } from "lucide-react";

interface GoalsProps {
  goals: Goal[];
  onAdd: (goal: Omit<Goal, "id">) => Promise<void> | void;
  onUpdate: (goal: Goal) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const Goals: React.FC<GoalsProps> = ({ goals, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Goal, "id">>({
    title: "",
    target: 0,
    current: 0,
    deadline: "",
    category: "Geral",
  });

  const totals = useMemo(() => {
    const target = goals.reduce((acc, g) => acc + (Number(g.target) || 0), 0);
    const current = goals.reduce((acc, g) => acc + (Number(g.current) || 0), 0);
    const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    return { target, current, progress };
  }, [goals]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", target: 0, current: 0, deadline: "", category: "Geral" });
    setIsModalOpen(true);
    setFeedback(null);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setForm({
      title: goal.title,
      target: goal.target,
      current: goal.current,
      deadline: goal.deadline || "",
      category: goal.category || "Geral",
    });
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      if (editing) {
        await onUpdate({ ...editing, ...form });
        setFeedback("Meta atualizada");
      } else {
        await onAdd(form);
        setFeedback("Meta criada");
      }
      setIsModalOpen(false);
    } catch (error: any) {
      setFeedback(error?.message || "Erro ao salvar meta");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja excluir esta meta?")) return;
    try {
      await onDelete(id);
    } catch (error: any) {
      setFeedback(error?.message || "Erro ao excluir meta");
    }
  };

  const handleQuickUpdate = async (goal: Goal, delta: number) => {
    const updated = { ...goal, current: Math.max(0, goal.current + delta) };
    try {
      await onUpdate(updated);
      setFeedback("Progresso atualizado");
    } catch (error: any) {
      setFeedback(error?.message || "Erro ao atualizar meta");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Metas Financeiras</h2>
          <p className="text-slate-500 text-sm">Crie, edite e acompanhe suas metas em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <Wallet className="text-indigo-600" size={18} />
            <div>
              <p className="text-[11px] text-slate-500">Total guardado</p>
              <p className="font-semibold text-slate-800">{currency.format(totals.current)}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <Trophy className="text-emerald-600" size={18} />
            <div>
              <p className="text-[11px] text-slate-500">Progresso geral</p>
              <p className="font-semibold text-slate-800">{totals.progress.toFixed(0)}%</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200"
          >
            <Plus size={18} />
            Nova Meta
          </button>
        </div>
      </div>

      {feedback && <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">{feedback}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
          return (
            <div key={goal.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Trophy size={64} className="text-slate-800" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-3 rounded-xl bg-slate-50">
                      <Target className="w-6 h-6 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{goal.title}</h3>
                      <p className="text-xs text-slate-500">{goal.category || "Geral"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(goal)} className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                      title="Remover meta"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>
                    {currency.format(goal.current)} de {currency.format(goal.target)}
                  </span>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded-full font-semibold">{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-indigo-500 transition-all duration-700 ease-out" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{goal.deadline ? new Date(goal.deadline).toLocaleDateString("pt-BR") : "Sem prazo"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Wallet size={12} />
                    <button
                      onClick={() => handleQuickUpdate(goal, goal.target * 0.05 || 100)}
                      className="underline text-indigo-600 hover:text-indigo-800"
                      title="Adicionar um pouco de progresso rapido"
                    >
                      Somar +5%
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={openCreate}
          className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors h-full min-h-[200px]"
        >
          <Target size={32} className="mb-2" />
          <span className="font-medium">Criar Nova Meta</span>
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">{editing ? "Editar Meta" : "Nova Meta"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titulo</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Reserva de emergencia"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor alvo</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ja guardado</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.current}
                    onChange={(e) => setForm({ ...form, current: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prazo (opcional)</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Ex: Lazer, Casa, Estudos"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? "Salvando..." : editing ? "Atualizar meta" : "Criar meta"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
