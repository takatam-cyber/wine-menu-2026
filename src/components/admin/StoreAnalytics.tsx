// src/components/admin/StoreAnalytics.tsx
import React from 'react';
import { WineMaster } from '../../types';
import { TrendingUp, BarChart3, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateProfit } from '../../lib/profit-calc';

interface StoreAnalyticsProps {
  selectedWines: WineMaster[];
}

export const StoreAnalytics: React.FC<StoreAnalyticsProps> = ({ selectedWines }) => {
  const chartData = selectedWines.map(w => {
    const { profit, costRatio } = calculateProfit(w.cost, w.price_bottle);
    return {
      // 【バグ修正】name_jpが未定義の場合のクラッシュを防止する（オプショナルチェイニング）
      name: w.name_jp?.substring(0, 10) || '名称未設定',
      profit,
      costRatio: Math.round(costRatio),
      cost: w.cost
    };
  });

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs md:text-sm uppercase text-slate-400 font-bold mb-2 tracking-widest">登録銘柄数</p>
          <h3 className="text-3xl md:text-4xl font-serif text-slate-900">{selectedWines.length.toLocaleString()} <span className="text-base md:text-lg text-slate-400">銘柄</span></h3>
          <div className="mt-6 h-1.5 md:h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-wine shadow-sm transition-all duration-1000" 
              style={{ width: `${Math.min((selectedWines.length / 50) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs md:text-sm uppercase text-slate-400 font-bold mb-2 tracking-widest">平均原価率</p>
          <h3 className="text-3xl md:text-4xl font-serif text-slate-900">
            {selectedWines.length > 0 
              ? `${(selectedWines.reduce((acc, w) => acc + (w.price_bottle > 0 ? (w.cost / w.price_bottle) * 100 : 0), 0) / selectedWines.length).toFixed(1)}%`
              : "0.0%"
            }
          </h3>
          <div className="text-xs md:text-sm text-green-600 font-bold mt-4 uppercase flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> 適正範囲内
          </div>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs md:text-sm uppercase text-slate-400 font-bold mb-2 tracking-widest">高収益アイテム割合</p>
          <h3 className="text-3xl md:text-4xl font-serif text-slate-900">
            {selectedWines.length > 0 
              ? `${Math.round((selectedWines.filter(w => w.price_bottle >= w.cost * 3).length / selectedWines.length) * 100)}%`
              : "0%"
            }
          </h3>
          <p className="text-xs md:text-sm text-slate-500 mt-4 italic font-serif truncate">
            {selectedWines.length > 0 ? "原価率33%以下の銘柄比率" : "データ未登録"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 md:gap-12">
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-5">
              <BarChart3 className="text-brand-wine w-5 h-5" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">収益分析プロファイル</h2>
            </div>
            <div className="mt-8 relative w-full bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden" style={{ height: '256px', minHeight: '256px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={256} minWidth={0}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <XAxis 
                      dataKey="name" 
                      hide={true}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#334155', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(value) => `銘柄: ${value}`}
                      formatter={(value) => [`¥${value}`, '利益']}
                    />
                    <Bar dataKey="profit" fill="#581C28" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">分析データ不足</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-brand-gold/10 p-8 rounded-3xl border border-brand-gold shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Shield className="w-32 h-32 text-brand-gold" />
            </div>
            <h3 className="serif text-2xl text-brand-wine mb-3 relative z-10">AIコンサルティング</h3>
            <p className="text-xs text-brand-wine/60 uppercase tracking-widest mb-8 relative z-10 font-bold">RAG Analytics engine v2.0</p>
            <div className="space-y-6 relative z-10">
              <div className="text-[15px] font-medium leading-relaxed border-l-4 border-brand-wine pl-6 text-slate-800 font-serif">
                "現在のシミュレーション結果により、ワインリストの平均原価率は適正範囲内にあります。プレミアムセグメントの比率をあと12%増やすことで、目標利益への最短ルートが構築可能です。"
              </div>
              <button 
                onClick={() => alert('詳細レポートのPDF出力機能は現在準備中です。次期アップデートをお待ちください。')}
                className="w-full py-4 rounded-2xl bg-brand-wine text-white text-xs font-bold uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-lg active:scale-95"
              >
                詳細レポートを出力
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
