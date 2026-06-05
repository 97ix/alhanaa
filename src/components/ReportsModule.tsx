import { useState, useEffect } from 'react';
import { getDb } from '../lib/db';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { ExpensesModule } from './ExpensesModule';
import { Wallet, BarChart2 } from 'lucide-react';

export const ReportsModule = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [filter] = useState('all');
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses'>('overview');

  const fetchSales = async () => {
    const db = await getDb();
    
    let query = `
      SELECT s.*, IFNULL(c.name, s.customer_name) as customer_name,
      (SELECT SUM(si.quantity * (si.unit_price - si.purchase_price)) 
       FROM sale_items si 
       WHERE si.sale_id = s.id) as profit
      FROM sales s 
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.status != 'returned'
    `;

    if (filter === 'today') query += " AND date(s.created_at) = date('now') ";
    else if (filter === 'week') query += " AND date(s.created_at) >= date('now', '-7 days') ";
    else if (filter === 'month') query += " AND date(s.created_at) >= date('now', 'start of month') ";

    query += " ORDER BY s.created_at DESC ";
    
    const result = await db.select<any[]>(query);
    setSales(result);

    // Fetch Analytics: Sales Trend (Last 15 days)
    const trend = await db.select<any[]>(`
      SELECT 
        strftime('%m/%d', s.created_at) as name,
        SUM(s.total_amount) as revenue,
        SUM((SELECT SUM(si.quantity * (si.unit_price - si.purchase_price)) FROM sale_items si WHERE si.sale_id = s.id)) as profit
      FROM sales s 
      WHERE s.status != 'returned'
      GROUP BY name 
      ORDER BY s.created_at ASC 
      LIMIT 15
    `);
    setAnalyticsData(trend);

    // Fetch Top 5 Products
    const top = await db.select<any[]>(`
      SELECT m.name, SUM(si.quantity) as value
      FROM sale_items si
      JOIN medicines m ON si.medicine_id = m.id
      GROUP BY m.id
      ORDER BY value DESC
      LIMIT 5
    `);
    setTopProducts(top);

    // Fetch Total Expenses
    const expensesRes = await db.select<any[]>("SELECT SUM(amount) as total FROM expenses");
    setTotalExpenses(expensesRes[0]?.total || 0);
  };

  useEffect(() => {
    fetchSales();
  }, [filter]);


  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>التقارير المالية</h2>
          <p style={{ color: 'var(--text-muted)' }}>سجل المبيعات والأداء</p>
        </div>
        <button className="btn btn-primary" onClick={fetchSales}>تحديث البيانات</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: '#f1f5f9', padding: '6px', borderRadius: '16px', width: 'fit-content' }}>
        <button 
          onClick={() => setActiveTab('overview')}
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : ''}`}
          style={{ 
            background: activeTab === 'overview' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'overview' ? 'white' : 'var(--text-slate)',
            border: 'none', padding: '10px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700
          }}
        >
          <BarChart2 size={18} /> نظرة عامة
        </button>
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`btn ${activeTab === 'expenses' ? 'btn-primary' : ''}`}
          style={{ 
            background: activeTab === 'expenses' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'expenses' ? 'white' : 'var(--text-slate)',
            border: 'none', padding: '10px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700
          }}
        >
          <Wallet size={18} /> المصاريف
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #0d9488 100%)', color: 'white' }}>
              <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>إجمالي المبيعات</p>
              <h3 style={{ fontSize: '1.75rem', marginTop: '8px', fontWeight: 800 }}>
                {sales.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()} <span style={{ fontSize: '0.9rem' }}>د.ع</span>
              </h3>
            </div>
            <div className="card" style={{ borderRight: '4px solid var(--secondary)', background: 'white' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>صافي الربح التقديري</p>
              <h3 style={{ fontSize: '1.75rem', marginTop: '8px', fontWeight: 800, color: 'var(--secondary)' }}>
                {(sales.reduce((sum, s) => sum + (s.profit || 0), 0) - totalExpenses).toLocaleString()} <span style={{ fontSize: '0.9rem' }}>د.ع</span>
              </h3>
              <p style={{ fontSize: '0.65rem', color: 'var(--error)', marginTop: '4px' }}>* بعد خصم {totalExpenses.toLocaleString()} مصاريف</p>
            </div>
            <div className="card" style={{ background: 'white' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>إجمالي المصاريف</p>
              <h3 style={{ fontSize: '1.75rem', marginTop: '8px', fontWeight: 800, color: 'var(--error)' }}>
                {totalExpenses.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>د.ع</span>
              </h3>
            </div>
            <div className="card" style={{ background: 'white' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>هامش الربح</p>
              <h3 style={{ fontSize: '1.75rem', marginTop: '8px', fontWeight: 800 }}>
                {sales.reduce((sum, s) => sum + s.total_amount, 0) > 0 
                  ? Math.round(((sales.reduce((sum, s) => sum + (s.profit || 0), 0) - totalExpenses) / sales.reduce((sum, s) => sum + s.total_amount, 0)) * 100)
                  : 0}%
              </h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 اتجاهات المبيعات والأرباح
              </h3>
              <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', direction: 'rtl' }}
                      itemStyle={{ fontSize: '0.85rem', fontWeight: 700 }}
                    />
                    <Legend iconType="circle" />
                    <Area type="monotone" name="الإيرادات" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" name="الأرباح (قبل المصاريف)" dataKey="profit" stroke="var(--secondary)" strokeWidth={3} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 800 }}>
                🏆 الأكثر مبيعاً (كمية)
              </h3>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {topProducts.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>لا توجد بيانات مبيعات بعد</p>
                ) : (() => {
                  const maxVal = topProducts[0]?.value || 1;
                  const rankConfig = [
                    { medal: '🥇', bg: 'linear-gradient(135deg,#fef9c3,#fde68a)', border: '#f59e0b', bar: 'linear-gradient(90deg,#f59e0b,#fbbf24)', badge: '#d97706' },
                    { medal: '🥈', bg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', border: '#94a3b8', bar: 'linear-gradient(90deg,#64748b,#94a3b8)', badge: '#475569' },
                    { medal: '🥉', bg: 'linear-gradient(135deg,#fff7ed,#fed7aa)', border: '#fb923c', bar: 'linear-gradient(90deg,#f97316,#fb923c)', badge: '#ea580c' },
                    { medal: '4', bg: '#f8fafc', border: '#e2e8f0', bar: 'linear-gradient(90deg,#0d9488,#14b8a6)', badge: '#0d9488' },
                    { medal: '5', bg: '#f8fafc', border: '#e2e8f0', bar: 'linear-gradient(90deg,#8b5cf6,#a78bfa)', badge: '#7c3aed' },
                  ];
                  return topProducts.map((p: any, idx: number) => {
                    const cfg = rankConfig[idx] || rankConfig[4];
                    const pct = Math.round((p.value / maxVal) * 100);
                    const isMedal = idx < 3;
                    return (
                      <div key={idx} style={{
                        display: 'flex', flexDirection: 'column', gap: '6px',
                        background: cfg.bg, border: `1.5px solid ${cfg.border}`,
                        borderRadius: '14px', padding: '10px 14px',
                        transition: 'transform 0.15s',
                        cursor: 'default',
                      }}
                        onMouseOver={e => (e.currentTarget.style.transform = 'translateX(-3px)')}
                        onMouseOut={e => (e.currentTarget.style.transform = 'translateX(0)')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: isMedal ? '1.25rem' : '0.72rem', fontWeight: 800,
                            minWidth: '26px', height: '26px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isMedal ? 'transparent' : cfg.badge,
                            color: isMedal ? undefined : 'white',
                            borderRadius: '7px',
                          }}>{cfg.medal}</span>
                          <span style={{ flex: 1, fontSize: '0.83rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'white', background: cfg.badge, padding: '3px 9px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
                            {Number(p.value).toLocaleString()} قطعة
                          </span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(0,0,0,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: cfg.bar, borderRadius: '99px', transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

          </div>
        </>
      ) : (
        <ExpensesModule />
      )}

    </div>
  );
};
