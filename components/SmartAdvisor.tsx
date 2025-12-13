import React, { useState, useRef, useEffect } from 'react';
import { Transaction, Investment, AIPreferences } from '../types';
import { askFinancialAdvisor } from '../services/openaiService';
import { Send, Bot, User, Sparkles, Settings, ShieldCheck, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SmartAdvisorProps {
  transactions: Transaction[];
  investments: Investment[];
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export const SmartAdvisor: React.FC<SmartAdvisorProps> = ({ transactions, investments }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Ola! Sou seu assistente financeiro com GPT-5 Nano. Escolha no icone de engrenagem quais dados deseja compartilhar.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Privacy State
  const [preferences, setPreferences] = useState<AIPreferences>({
    shareBalance: true,
    shareTransactions: true,
    shareInvestments: true
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askFinancialAdvisor(userMessage, transactions, investments, preferences);
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Erro ao conectar. Verifique sua chave API.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-indigo-600 w-5 h-5" />
          <h2 className="font-bold text-slate-800">Advisor GPT-5</h2>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          title="Configuracoes de Privacidade"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {msg.role === 'ai' ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
              msg.role === 'ai' 
                ? 'bg-white text-slate-700 rounded-tl-none border border-slate-100' 
                : 'bg-indigo-600 text-white rounded-tr-none'
            }`}>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center animate-pulse"><Bot size={18} /></div>
             <div className="bg-white p-4 rounded-2xl border border-slate-100"><span className="text-slate-400 text-xs">Pensando...</span></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Pergunte sobre suas financas..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl shadow-lg shadow-indigo-200"
        >
          <Send size={20} />
        </button>
      </div>

      {/* Privacy Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-400" />
                <span className="font-bold">Privacidade de Dados</span>
              </div>
              <button onClick={() => setIsSettingsOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 mb-4">
                Controle exatamente o que o GPT pode analisar para gerar suas respostas.
              </p>
              
              <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Compartilhar Saldo Total</span>
                <input 
                  type="checkbox" 
                  checked={preferences.shareBalance}
                  onChange={(e) => setPreferences({...preferences, shareBalance: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Ler Transacoes Detalhadas</span>
                <input 
                  type="checkbox" 
                  checked={preferences.shareTransactions}
                  onChange={(e) => setPreferences({...preferences, shareTransactions: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Analisar Investimentos</span>
                <input 
                  type="checkbox" 
                  checked={preferences.shareInvestments}
                  onChange={(e) => setPreferences({...preferences, shareInvestments: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                />
              </label>

              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg mt-2"
              >
                Salvar Preferencias
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
