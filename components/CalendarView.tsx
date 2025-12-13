import React, { useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface CalendarViewProps {
  transactions: Transaction[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  
  const days = [];
  // Empty slots for previous month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getDailyTransactions = (day: number) => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      // Fix timezone offset issue for simple date comparison usually found in JS
      // Using string comparison for simplicity based on how dates are stored (YYYY-MM-DD)
      const tDateString = t.date; 
      const currentMonthString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return tDateString === currentMonthString;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 capitalize">
          {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ChevronLeft />
          </button>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day, idx) => {
            if (!day) return <div key={idx} className="bg-slate-50/50 min-h-[120px] border-b border-r border-slate-100"></div>;
            
            const dailyTxs = getDailyTransactions(day);
            const dailyTotal = dailyTxs.reduce((acc, t) => t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount, 0);

            return (
              <div key={idx} className="min-h-[120px] border-b border-r border-slate-100 p-2 relative hover:bg-slate-50 transition-colors group">
                <span className={`text-sm font-medium ${
                  day === new Date().getDate() && 
                  currentDate.getMonth() === new Date().getMonth() &&
                  currentDate.getFullYear() === new Date().getFullYear()
                    ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center' 
                    : 'text-slate-700'
                }`}>
                  {day}
                </span>

                <div className="mt-2 space-y-1">
                  {dailyTxs.slice(0, 3).map(t => (
                    <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${
                      t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {t.type === TransactionType.INCOME ? <ArrowUpCircle size={8}/> : <ArrowDownCircle size={8}/>}
                      {t.description}
                    </div>
                  ))}
                  {dailyTxs.length > 3 && (
                    <div className="text-[10px] text-slate-400 pl-1">
                      + {dailyTxs.length - 3} outros
                    </div>
                  )}
                </div>

                {dailyTxs.length > 0 && (
                   <div className={`absolute bottom-2 right-2 text-xs font-bold ${dailyTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {dailyTotal > 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyTotal)}
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
