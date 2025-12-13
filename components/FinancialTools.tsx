import React, { useState } from 'react';
import { Calculator, TrendingUp, Clock, DollarSign, Percent, Briefcase } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const FinancialTools = () => {
  const [activeTab, setActiveTab] = useState<'compound' | 'loan' | 'salary' | 'fire'>('compound');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Ferramentas Financeiras</h2>
           <p className="text-slate-500 text-sm">Calculadoras e simuladores para auxiliar suas decisões.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto max-w-full">
           <button onClick={() => setActiveTab('compound')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'compound' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>Juros Compostos</button>
           <button onClick={() => setActiveTab('loan')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'loan' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>Financiamento</button>
           <button onClick={() => setActiveTab('salary')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'salary' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>Salário Líquido</button>
           <button onClick={() => setActiveTab('fire')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'fire' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>Independência (FIRE)</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
        {activeTab === 'compound' && <CompoundInterestCalculator />}
        {activeTab === 'loan' && <LoanCalculator />}
        {activeTab === 'salary' && <SalaryCalculator />}
        {activeTab === 'fire' && <FireCalculator />}
      </div>
    </div>
  );
};

// --- Sub Components ---

const CompoundInterestCalculator = () => {
  const [principal, setPrincipal] = useState(1000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(10);

  const calculateData = () => {
    const data = [];
    let currentBalance = principal;
    const monthlyRate = rate / 100 / 12;
    
    for (let i = 0; i <= years; i++) {
      data.push({
        year: `Ano ${i}`,
        balance: Math.round(currentBalance),
        invested: principal + (monthly * 12 * i)
      });
      // Calculate next year
      for(let m=0; m<12; m++) {
        currentBalance = currentBalance * (1 + monthlyRate) + monthly;
      }
    }
    return data;
  };

  const data = calculateData();
  const finalAmount = data[data.length-1].balance;
  const totalInvested = data[data.length-1].invested;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Valor Inicial</label>
          <input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Aporte Mensal</label>
          <input type="number" value={monthly} onChange={e => setMonthly(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Taxa de Juros (% ao ano)</label>
          <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Período (Anos)</label>
          <input type="number" value={years} onChange={e => setYears(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col">
        <div className="grid grid-cols-2 gap-4 mb-6">
           <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
             <p className="text-xs text-emerald-600 font-bold uppercase">Valor Final</p>
             <p className="text-2xl font-bold text-emerald-700">R$ {finalAmount.toLocaleString('pt-BR')}</p>
           </div>
           <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
             <p className="text-xs text-indigo-600 font-bold uppercase">Total Juros Ganhos</p>
             <p className="text-2xl font-bold text-indigo-700">R$ {(finalAmount - totalInvested).toLocaleString('pt-BR')}</p>
           </div>
        </div>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(val) => `R$${val/1000}k`} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Area type="monotone" dataKey="balance" stroke="#10B981" fillOpacity={1} fill="url(#colorBalance)" name="Total Acumulado" />
              <Area type="monotone" dataKey="invested" stroke="#6366F1" fill="none" strokeDasharray="5 5" name="Total Investido" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const LoanCalculator = () => {
  const [amount, setAmount] = useState(50000);
  const [rate, setRate] = useState(1.5);
  const [months, setMonths] = useState(48);

  // PMT formula: P * (r * (1+r)^n) / ((1+r)^n - 1)
  const calculatePMT = () => {
    const r = rate / 100; // Monthly rate
    if (r === 0) return amount / months;
    const pmt = amount * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    return pmt;
  };

  const pmt = calculatePMT();
  const totalPayment = pmt * months;
  const totalInterest = totalPayment - amount;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Valor do Empréstimo</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Taxa Mensal (%)</label>
          <input type="number" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Prazo (Meses)</label>
          <input type="number" value={months} onChange={e => setMonths(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
         <div>
            <p className="text-slate-500 text-sm mb-1">Parcela Mensal</p>
            <p className="text-3xl font-bold text-slate-800">R$ {pmt.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
         </div>
         <div>
            <p className="text-slate-500 text-sm mb-1">Total a Pagar</p>
            <p className="text-3xl font-bold text-rose-600">R$ {totalPayment.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
         </div>
         <div>
            <p className="text-slate-500 text-sm mb-1">Juros Totais</p>
            <p className="text-3xl font-bold text-amber-500">R$ {totalInterest.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
         </div>
      </div>
      
      <div className="text-center text-sm text-slate-500">
        *Cálculo baseado na Tabela Price. Não inclui IOF e taxas administrativas.
      </div>
    </div>
  );
};

const SalaryCalculator = () => {
  const [gross, setGross] = useState(5000);
  const [dependents, setDependents] = useState(0);

  // Very simplified BR Tax Logic (Mock 2024/2025)
  const calculateNet = () => {
    let inss = 0;
    if (gross <= 1412) inss = gross * 0.075;
    else if (gross <= 2666) inss = gross * 0.09 - 21.18;
    else if (gross <= 4000) inss = gross * 0.12 - 101.18;
    else inss = gross * 0.14 - 181.18;
    if (inss > 908.85) inss = 908.85; // Teto

    const baseIRRF = gross - inss - (dependents * 189.59);
    let irrf = 0;
    if (baseIRRF <= 2259) irrf = 0;
    else if (baseIRRF <= 2826) irrf = baseIRRF * 0.075 - 169.44;
    else if (baseIRRF <= 3751) irrf = baseIRRF * 0.15 - 381.44;
    else if (baseIRRF <= 4664) irrf = baseIRRF * 0.225 - 662.77;
    else irrf = baseIRRF * 0.275 - 896;
    
    if (irrf < 0) irrf = 0;

    return {
      inss,
      irrf,
      net: gross - inss - irrf
    };
  };

  const result = calculateNet();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Salário Bruto</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
            <input type="number" value={gross} onChange={e => setGross(Number(e.target.value))} className="w-full pl-9 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Dependentes</label>
           <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
            <input type="number" value={dependents} onChange={e => setDependents(Number(e.target.value))} className="w-full pl-9 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
           </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between p-4 bg-slate-50 rounded-xl">
           <span className="text-slate-600">INSS (Previdência)</span>
           <span className="font-bold text-rose-500">- R$ {result.inss.toFixed(2)}</span>
        </div>
        <div className="flex justify-between p-4 bg-slate-50 rounded-xl">
           <span className="text-slate-600">IRRF (Imposto de Renda)</span>
           <span className="font-bold text-rose-500">- R$ {result.irrf.toFixed(2)}</span>
        </div>
        <div className="flex justify-between p-6 bg-indigo-600 text-white rounded-xl shadow-lg mt-4">
           <span className="font-bold text-lg">Salário Líquido Estimado</span>
           <span className="font-bold text-2xl">R$ {result.net.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

const FireCalculator = () => {
  const [monthlySpend, setMonthlySpend] = useState(4000);
  const [currentNetWorth, setCurrentNetWorth] = useState(50000);
  const [monthlySave, setMonthlySave] = useState(1500);
  const [safeWithdrawal, setSafeWithdrawal] = useState(4); // 4% rule

  const annualSpend = monthlySpend * 12;
  const fireNumber = annualSpend / (safeWithdrawal / 100);
  
  // Simple projection of years needed
  // Very simplified: assuming 5% real return (above inflation)
  const realReturn = 0.05; 
  let yearsToFire = 0;
  let tempWorth = currentNetWorth;
  if (monthlySave > 0) {
     while (tempWorth < fireNumber && yearsToFire < 80) {
        tempWorth = tempWorth * (1 + realReturn) + (monthlySave * 12);
        yearsToFire++;
     }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Gasto Mensal Desejado</label>
            <input type="number" value={monthlySpend} onChange={e => setMonthlySpend(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Patrimônio Atual</label>
            <input type="number" value={currentNetWorth} onChange={e => setCurrentNetWorth(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Aporte Mensal</label>
            <input type="number" value={monthlySave} onChange={e => setMonthlySave(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Taxa de Retirada Segura (%)</label>
            <input type="number" step="0.1" value={safeWithdrawal} onChange={e => setSafeWithdrawal(Number(e.target.value))} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
       </div>
       
       <div className="flex flex-col justify-center space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
             <p className="text-slate-400 text-sm font-bold uppercase mb-2">Seu Número FIRE</p>
             <h3 className="text-4xl font-bold text-emerald-400">R$ {fireNumber.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</h3>
             <p className="text-slate-500 text-xs mt-2">O montante necessário para viver de renda.</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
             <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg">
                   {yearsToFire}
                </div>
                <div>
                  <h4 className="font-bold text-indigo-900 text-lg">Anos Estimados</h4>
                  <p className="text-indigo-700 text-sm">Tempo até sua liberdade financeira (considerando retorno real de 5% a.a.)</p>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}
