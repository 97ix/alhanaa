import { useState, useEffect } from 'react';
import { getDb } from '../lib/db';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
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
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: 800 }}>
                 🏆 الأكثر مبيعاً (كمية)
              </h3>
              <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(241, 107, 72, 0.05)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="value" name="الكمية" fill="var(--secondary)" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
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
