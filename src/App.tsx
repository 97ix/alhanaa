import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  Bell,
  Search,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  Activity,
  Truck,
  CheckCircle
} from "lucide-react";
import "./App.css";
import { initDb, getDb } from "./lib/db";
import { InventoryModule } from "./components/InventoryModule";
import { ReportsModule } from "./components/ReportsModule";
import { SuppliersModule } from "./components/SuppliersModule";
import { SettingsModule } from "./components/SettingsModule";
import { CustomersModule } from "./components/CustomersModule";
import { OrdersModule } from "./components/OrdersModule";

const Dashboard = ({ onNavigate }: { onNavigate: (tab: string, filter?: string) => void }) => {
  const [stats, setStats] = useState({
    todaySales: 0,
    prescriptionCount: 0,
    expiredCount: 0,
    lowStockCount: 0,
    patientCount: 0
  });

  const fetchStats = async () => {
    try {
      const db = await getDb();
      const patientResult = await db.select<any[]>("SELECT COUNT(*) as count FROM customers");
      const salesResult = await db.select<any[]>("SELECT SUM(total_amount) as total FROM sales WHERE date(created_at) = date('now')");
      const stockResult = await db.select<any[]>("SELECT COUNT(*) as count FROM medicines WHERE stock <= IFNULL(min_stock_level, 5)");
      const expiredResult = await db.select<any[]>("SELECT COUNT(*) as count FROM medicines WHERE date(expiry_date) < date('now', '+30 days')");
      const countResult = await db.select<any[]>("SELECT COUNT(*) as count FROM sales WHERE date(created_at) = date('now')");

      setStats(prev => ({
        ...prev,
        todaySales: salesResult[0]?.total || 0,
        prescriptionCount: countResult[0]?.count || 0,
        expiredCount: expiredResult[0]?.count || 0,
        lowStockCount: stockResult[0]?.count || 0,
        patientCount: patientResult[0]?.count || 0
      }));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="fade-in">
      {/* Header Title Section */}
      <section style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>نظرة عامة سريرية</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>أداء الصيدلية والرؤى التشغيلية في الوقت الفعلي.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ background: 'var(--sidebar-bg)', padding: '8px 16px', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-slate)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </section>
      
      {/* Bento Grid Metrics */}
      <section className="dashboard-grid">
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(0, 100, 85, 0.1)', color: 'var(--primary)' }}>
              <TrendingUp size={24} />
            </div>
            <span className="badge badge-primary">+12.5%</span>
          </div>
          <div>
            <p className="val-label">مبيعات اليوم</p>
            <h3 className="val-amount">{stats.todaySales.toLocaleString('en-US')} <span style={{ fontSize: '1rem' }}>د.ع</span></h3>
          </div>
        </div>

        <div className="metric-card secondary">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(48, 94, 163, 0.1)', color: 'var(--secondary)' }}>
              <Activity size={24} />
            </div>
            <span className="badge badge-secondary">نشط</span>
          </div>
          <div>
            <p className="val-label">طلبات معلقة</p>
            <h3 className="val-amount">{stats.prescriptionCount}</h3>
          </div>
        </div>

        <div className="metric-card error" onClick={() => onNavigate('inventory', 'low_stock')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(220, 38, 38, 0.1)', color: 'var(--error)' }}>
              <AlertTriangle size={24} />
            </div>
            <span className="badge badge-error">عاجل</span>
          </div>
          <div>
            <p className="val-label">نواقص المخزون</p>
            <h3 className="val-amount">{stats.lowStockCount}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(0, 98, 105, 0.1)', color: 'var(--tertiary)' }}>
              <UserPlus size={24} />
            </div>
            <span className="badge" style={{ background: 'rgba(0, 98, 105, 0.1)', color: 'var(--tertiary)' }}>+4 اليوم</span>
          </div>
          <div>
            <p className="val-label">مرضى جدد</p>
            <h3 className="val-amount">{stats.patientCount}</h3>
          </div>
        </div>
      </section>

      {/* Charts & Tasks Section */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '32px' }}>
        <div className="table-container" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>اليقظة السريرية</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>تنبيهات الصلاحية (خلال 30 يوم)</p>
            </div>
          </div>
           {stats.expiredCount > 0 ? (
              <div style={{ padding: '24px', background: '#fff1f2', borderRadius: '16px', border: '1px solid #fecdd3', color: '#e11d48' }}>
                 <p style={{ fontWeight: 700 }}>يوجد {stats.expiredCount} عناصر أوشكت صلاحيتها على الانتهاء!</p>
                 <button className="btn" onClick={() => onNavigate('inventory', 'expired')} style={{ marginTop: '16px', background: '#e11d48', color: 'white' }}>عرض القائمة الحرجة</button>
              </div>
           ) : (
             <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                <CheckCircle size={32} color="var(--primary)" style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-slate)' }}>كل الأدوية صالحة وبحالة ممتازة.</p>
             </div>
           )}
        </div>

        <div className="metric-card" style={{ background: 'var(--primary)', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', bottom: -20, left: -20, opacity: 0.1 }}>
            <Package size={160} />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>المخزون الآلي</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.6 }}>حددت خوارزمية الدقة السريرية {stats.lowStockCount} عناصر تخصصية تتطلب إعادة الطلب للحفاظ على معدل تلبية بنسبة 99٪.</p>
            <button className="btn" onClick={() => onNavigate('inventory', 'low_stock')} style={{ background: 'white', color: 'var(--primary)', width: '100%', marginTop: '32px', justifyContent: 'center' }}>مراجعة القائمة الذكية</button>
          </div>
        </div>
      </section>
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [inventoryFilter, setInventoryFilter] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [posCart, setPosCart] = useState<any[]>([]);
  const [posCustomerName, setPosCustomerName] = useState("");
  const [dbReady, setDbReady] = useState(false);
  const [userState, setUserState] = useState({ name: "د. أنس ثورن", role: "صيدلي رئيسي" });

  useEffect(() => {
    initDb().then(async () => {
      setDbReady(true);
      const db = await getDb();
      const settings = await db.select<any[]>("SELECT * FROM app_settings WHERE key IN ('user_name', 'user_role')");
      const newState = { ...userState };
      settings.forEach(s => {
        if (s.key === 'user_name') newState.name = s.value;
        if (s.key === 'user_role') newState.role = s.value;
      });
      setUserState(newState);
    }).catch(console.error);
  }, []);

  const handleNavigate = (tab: string, filter?: string) => {
    setActiveTab(tab);
    if (filter) setInventoryFilter(filter);
    else setInventoryFilter("");
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch) return;
    
    const query = globalSearch.toLowerCase();
    if (query.includes("مخزون") || query.includes("دواء") || query.includes("علاج")) {
      setActiveTab("inventory");
    } else if (query.includes("مريض") || query.includes("عميل")) {
      setActiveTab("customers");
    } else if (query.includes("مورد") || query.includes("مذخر")) {
      setActiveTab("suppliers");
    } else if (query.includes("تقرير") || query.includes("حساب")) {
      setActiveTab("reports");
    } else if (query.includes("طلب") || query.includes("بيع")) {
      setActiveTab("pos");
    } else {
      // Default to inventory search if nothing else matches
      setActiveTab("inventory");
    }
  };

  const renderContent = () => {
    switch(activeTab) {
      case "dashboard": return <Dashboard onNavigate={handleNavigate} />;
      case "inventory": return <InventoryModule initialFilter={inventoryFilter} initialSearch={globalSearch} />;
      case "customers": return <CustomersModule initialSearch={globalSearch} />;
      case "suppliers": return <SuppliersModule initialSearch={globalSearch} />;
      case "pos": return (
        <OrdersModule 
          posProps={{
            cart: posCart, 
            setCart: setPosCart, 
            customerName: posCustomerName, 
            setCustomerName: setPosCustomerName 
          }}
        />
      );
      case "reports": return <ReportsModule />;
      case "settings": return <SettingsModule />;
      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  if (!dbReady) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>...جاري التحميل</div>;

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">+</div>
          <div>
            <h1 className="brand-name">صيدلية الهناء</h1>
            <p className="brand-sub">الدقة السريرية</p>
          </div>
        </div>
        
        <nav style={{ flex: 1 }}>
          <div className={`sidebar-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
            <LayoutDashboard size={20} />
            لوحة التحكم
          </div>
          <div className={`sidebar-item ${activeTab === "inventory" ? "active" : ""}`} onClick={() => { setActiveTab("inventory"); setInventoryFilter(""); }}>
            <Package size={20} />
            المخزون
          </div>
          <div className={`sidebar-item ${activeTab === "suppliers" ? "active" : ""}`} onClick={() => setActiveTab("suppliers")}>
            <Truck size={20} />
            الموردين والمذاخر
          </div>
          <div className={`sidebar-item ${activeTab === "pos" ? "active" : ""}`} onClick={() => setActiveTab("pos")}>
            <ShoppingCart size={20} />
            الطلبات
          </div>
          <div className={`sidebar-item ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
            <TrendingUp size={20} />
            التقارير المالية
          </div>
          <div className={`sidebar-item ${activeTab === "customers" ? "active" : ""}`} onClick={() => setActiveTab("customers")}>
            <Users size={20} />
            المرضى
          </div>
        </nav>

        <div className={`sidebar-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")} style={{ borderTop: '1px solid var(--border)', marginTop: '24px', paddingTop: '24px' }}>
          <Settings size={20} />
          الإعدادات
        </div>
        
      </aside>

      <main className="main-content">
        <header className="header">
          <form className="search-container" onSubmit={handleGlobalSearch}>
            <Search className="search-icon" size={18} />
            <input 
              className="search-input" 
              placeholder="ابحث في النظام (أدوية، مرضى، فواتير...)" 
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </form>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-icon" style={{ position: 'relative' }}>
                <Bell size={20} color="var(--text-slate)" />
                <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: 'var(--error)', borderRadius: '50%' }}></span>
              </button>
              <button className="btn-icon"><HelpCircle size={20} color="var(--text-slate)" /></button>
            </div>
            <div style={{ width: 1, height: 24, background: 'var(--outline-variant)', opacity: 0.3 }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{userState.name}</p>
                <p style={{ fontSize: '0.625rem', color: 'var(--text-slate)', fontWeight: 600 }}>{userState.role}</p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {userState.name.split(' ').map(n => n[0]).join('')}
              </div>
            </div>
          </div>
        </header>

        <section className="scroll-area">
          <div className="container-max">
            {renderContent()}
          </div>
        </section>
      </main>

    </>
  );
}

export default App;
