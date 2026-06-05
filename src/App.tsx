import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  Activity,
  Truck,
  CheckCircle,
  LogOut,
  KeyRound,
  Calendar,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import { initDb, getDb } from "./lib/db";
import { InventoryModule } from "./components/InventoryModule";
import { ReportsModule } from "./components/ReportsModule";
import { SuppliersModule } from "./components/SuppliersModule";
import { SettingsModule } from "./components/SettingsModule";
import { CustomersModule } from "./components/CustomersModule";
import { OrdersModule } from "./components/OrdersModule";
import { ExpiryModule } from "./components/ExpiryModule";

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
              <div style={{ padding: '24px', background: 'var(--error-container)', borderRadius: '16px', border: '1.5px solid var(--border-color)', color: 'var(--error)' }}>
                 <p style={{ fontWeight: 700 }}>يوجد {stats.expiredCount} عناصر أوشكت صلاحيتها على الانتهاء!</p>
                 <button className="btn" onClick={() => onNavigate('inventory', 'expired')} style={{ marginTop: '16px', background: 'var(--error)', color: 'white' }}>عرض القائمة الحرجة</button>
              </div>
           ) : (
             <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
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
            <h3 className="text-white-force" style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>المخزون الآلي</h3>
            <p className="text-white-force" style={{ fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.6 }}>حددت خوارزمية الدقة السريرية {stats.lowStockCount} عناصر تخصصية تتطلب إعادة الطلب للحفاظ على معدل تلبية بنسبة 99٪.</p>
            <button className="btn" onClick={() => onNavigate('inventory', 'low_stock')} style={{ background: 'white', color: 'var(--primary)', width: '100%', marginTop: '32px', justifyContent: 'center' }}>مراجعة القائمة الذكية</button>
          </div>
        </div>
      </section>
    </div>
  );
};

const LockScreen = ({ users, onUnlock }: { users: any[], onUnlock: (user: any) => void }) => {
  // Find the admin user (صيدلي رئيسي) in the list to make them the default selection
  const getInitialUserId = () => {
    const admin = users.find(u => u.role === 'admin');
    return admin ? admin.id : (users[0]?.id || 0);
  };

  const [selectedUserId, setSelectedUserId] = useState<number>(getInitialUserId());
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (users.length > 0) {
      const admin = users.find(u => u.role === 'admin');
      setSelectedUserId(admin ? admin.id : users[0].id);
    }
  }, [users]);

  const selectedUser = users.find(u => u.id === selectedUserId);

  const handleKeyPress = (digit: string) => {
    setErrorMsg("");
    if (pin.length < (selectedUser?.pin?.length || 4)) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  const handleSubmit = () => {
    if (!selectedUser) return;
    if (pin === selectedUser.pin) {
      onUnlock(selectedUser);
    } else {
      setShake(true);
      setErrorMsg("رمز PIN غير صحيح");
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  };

  useEffect(() => {
    if (selectedUser && pin.length === selectedUser.pin.length) {
      if (pin === selectedUser.pin) {
        onUnlock(selectedUser);
      } else {
        setShake(true);
        setErrorMsg("رمز PIN غير صحيح");
        setPin("");
        setTimeout(() => setShake(false), 500);
      }
    }
  }, [pin, selectedUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, selectedUserId, users]);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, var(--login-bg-start) 0%, var(--login-bg-end) 100%)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-headline)',
      direction: 'rtl',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 99999,
      overflow: 'hidden'
    }}>
      {/* Decorative gradient glowing spots in background */}
      <div style={{
        position: 'absolute',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(20, 184, 166, 0.2) 0%, rgba(20, 184, 166, 0) 70%)',
        top: '10%',
        right: '15%',
        zIndex: 1,
        filter: 'blur(40px)'
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(37, 99, 235, 0) 70%)',
        bottom: '10%',
        left: '15%',
        zIndex: 1,
        filter: 'blur(50px)'
      }} />

      <motion.div 
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '430px',
          borderRadius: '32px',
          padding: '48px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10,
          border: '1px solid var(--login-glass-border)',
          boxShadow: 'var(--login-glass-shadow)'
        }}
      >
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '22px',
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: '0 8px 20px rgba(15, 118, 110, 0.3)'
        }}>
          <KeyRound size={30} color="white" />
        </div>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', textAlign: 'center' }}>صيدلية الهناء</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '32px', textAlign: 'center' }}>يرجى اختيار المستخدم وإدخال رمز PIN للدخول</p>

        <div style={{ width: '100%', marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-slate)', marginBottom: '8px' }}>المستخدم</label>
          <select 
            style={{
              width: '100%',
              height: '52px',
              background: 'var(--bg)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '16px',
              color: 'var(--text-main)',
              padding: '0 16px',
              fontWeight: 700,
              fontSize: '1rem',
              outline: 'none',
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(parseInt(e.target.value));
              setErrorMsg("");
              setPin("");
            }}
          >
            {users.map(u => (
              <option key={u.id} value={u.id} style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                {u.name} ({u.role === 'admin' ? 'صيدلي رئيسي' : 'مساعد صيدلي'})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px', margin: '16px 0 36px' }}>
          {[...Array(selectedUser?.pin?.length || 4)].map((_, i) => (
            <div 
              key={i} 
              className={`lock-screen-pin-dot ${i < pin.length ? 'filled' : ''}`} 
            />
          ))}
        </div>

        {errorMsg && (
          <p style={{ color: 'var(--error)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '24px' }}>{errorMsg}</p>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px 24px',
          width: '100%',
          maxWidth: '300px',
          marginBottom: '8px'
        }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="lock-screen-btn"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.925rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              outline: 'none'
            }}
          >
            مسح
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="lock-screen-btn"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.925rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              outline: 'none'
            }}
          >
            حذف
          </button>
        </div>
      </motion.div>
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [inventoryFilter, setInventoryFilter] = useState("");
  const globalSearch = "";
  const [posCart, setPosCart] = useState<any[]>([]);
  const [posCustomerName, setPosCustomerName] = useState("");
  const [dbReady, setDbReady] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Added Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Added Toast Notifications State
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const newToast = {
        id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        message: detail.message,
        type: detail.type || 'success'
      };
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 4000);
    };
    window.addEventListener('app-toast', handleToastEvent);
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, []);

  // Added custom Confirm Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{ message: string; onConfirm: () => void; resolve: (val: boolean) => void } | null>(null);

  useEffect(() => {
    (window as any).confirmDialog = (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmConfig({
          message,
          onConfirm: () => {
            setConfirmConfig(null);
            resolve(true);
          },
          resolve: (val) => {
            setConfirmConfig(null);
            resolve(val);
          }
        });
      });
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>("SELECT * FROM users ORDER BY name ASC");
      setUsersList(result);
      // Auto update current user if their details changed in users table
      setCurrentUser((prev: any) => {
        if (!prev) return null;
        const updated = result.find(u => u.id === prev.id);
        return updated || null;
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    initDb().then(async () => {
      setDbReady(true);
      await fetchUsers();
    }).catch(console.error);
  }, []);

  // Block right-click globally in the application
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  const handleNavigate = (tab: string, filter?: string) => {
    setActiveTab(tab);
    if (filter) setInventoryFilter(filter);
    else setInventoryFilter("");
  };



  const renderContent = () => {
    switch(activeTab) {
      case "dashboard": return <Dashboard onNavigate={handleNavigate} />;
      case "inventory": return <InventoryModule initialFilter={inventoryFilter} initialSearch={globalSearch} currentUser={currentUser} />;
      case "customers": return <CustomersModule initialSearch={globalSearch} currentUser={currentUser} />;
      case "suppliers": return <SuppliersModule initialSearch={globalSearch} currentUser={currentUser} />;
      case "pos": return (
        <OrdersModule 
          posProps={{
            cart: posCart, 
            setCart: setPosCart, 
            customerName: posCustomerName, 
            setCustomerName: setPosCustomerName,
            currentUser: currentUser
          }}
        />
      );
      case "reports": return <ReportsModule />;
      case "expiry": return <ExpiryModule />;
      case "settings": return <SettingsModule currentUser={currentUser} onUserUpdate={fetchUsers} />;
      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  if (!dbReady) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>...جاري التحميل</div>;

  if (currentUser === null) {
    return <LockScreen users={usersList} onUnlock={(user) => setCurrentUser(user)} />;
  }

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
        
        <nav style={{ flex: 1, position: 'relative' }}>
          <div 
            className={`sidebar-item ${activeTab === "dashboard" ? "active" : ""}`} 
            onClick={() => setActiveTab("dashboard")}
          >
            {activeTab === "dashboard" && (
              <motion.div 
                layoutId="activeIndicator" 
                className="sidebar-active-indicator" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <LayoutDashboard size={20} style={{ position: 'relative', zIndex: 2 }} />
            <span style={{ position: 'relative', zIndex: 2 }}>لوحة التحكم</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === "inventory" ? "active" : ""}`} 
            onClick={() => { setActiveTab("inventory"); setInventoryFilter(""); }}
          >
            {activeTab === "inventory" && (
              <motion.div 
                layoutId="activeIndicator" 
                className="sidebar-active-indicator" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Package size={20} style={{ position: 'relative', zIndex: 2 }} />
            <span style={{ position: 'relative', zIndex: 2 }}>المخزون</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === "suppliers" ? "active" : ""}`} 
            onClick={() => setActiveTab("suppliers")}
          >
            {activeTab === "suppliers" && (
              <motion.div 
                layoutId="activeIndicator" 
                className="sidebar-active-indicator" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Truck size={20} style={{ position: 'relative', zIndex: 2 }} />
            <span style={{ position: 'relative', zIndex: 2 }}>الموردين والمذاخر</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === "pos" ? "active" : ""}`} 
            onClick={() => setActiveTab("pos")}
          >
            {activeTab === "pos" && (
              <motion.div 
                layoutId="activeIndicator" 
                className="sidebar-active-indicator" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <ShoppingCart size={20} style={{ position: 'relative', zIndex: 2 }} />
            <span style={{ position: 'relative', zIndex: 2 }}>الطلبات</span>
          </div>

          {currentUser.role === 'admin' && (
            <div 
              className={`sidebar-item ${activeTab === "reports" ? "active" : ""}`} 
              onClick={() => setActiveTab("reports")}
            >
              {activeTab === "reports" && (
                <motion.div 
                  layoutId="activeIndicator" 
                  className="sidebar-active-indicator" 
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <TrendingUp size={20} style={{ position: 'relative', zIndex: 2 }} />
              <span style={{ position: 'relative', zIndex: 2 }}>التقارير المالية</span>
            </div>
          )}

          {currentUser.role === 'admin' && (
            <div 
              className={`sidebar-item ${activeTab === "expiry" ? "active" : ""}`} 
              onClick={() => setActiveTab("expiry")}
            >
              {activeTab === "expiry" && (
                <motion.div 
                  layoutId="activeIndicator" 
                  className="sidebar-active-indicator" 
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Calendar size={20} style={{ position: 'relative', zIndex: 2 }} />
              <span style={{ position: 'relative', zIndex: 2 }}>صلاحية الأدوية</span>
            </div>
          )}

          <div 
            className={`sidebar-item ${activeTab === "customers" ? "active" : ""}`} 
            onClick={() => setActiveTab("customers")}
          >
            {activeTab === "customers" && (
              <motion.div 
                layoutId="activeIndicator" 
                className="sidebar-active-indicator" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Users size={20} style={{ position: 'relative', zIndex: 2 }} />
            <span style={{ position: 'relative', zIndex: 2 }}>المرضى</span>
          </div>
        </nav>

        {currentUser.role === 'admin' && (
          <div 
            className={`sidebar-item ${activeTab === "settings" ? "active" : ""}`} 
            onClick={() => setActiveTab("settings")} 
            style={{ borderTop: '1px solid var(--border)', marginTop: '24px', paddingTop: '24px' }}
          >
            {activeTab === "settings" && (
              <motion.div 
                layoutId="activeIndicator" 
                className="sidebar-active-indicator" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Settings size={20} style={{ position: 'relative', zIndex: 2 }} />
            <span style={{ position: 'relative', zIndex: 2 }}>الإعدادات</span>
          </div>
        )}

        <div 
          className="sidebar-item" 
          onClick={() => setCurrentUser(null)} 
          style={{ 
            color: 'var(--error)', 
            marginTop: currentUser.role === 'cashier' ? '24px' : '8px', 
            borderTop: currentUser.role === 'cashier' ? '1px solid var(--border)' : 'none',
            paddingTop: currentUser.role === 'cashier' ? '24px' : '12px'
          }}
        >
          <LogOut size={20} />
          تسجيل الخروج
        </div>
        
      </aside>

      <main className="main-content">
        <header className="header" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
          <div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
              className="btn-icon"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-main)',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)'
              }}
              title={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Profile Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{currentUser.name}</p>
                <p style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {currentUser.role === 'admin' ? 'صيدلي رئيسي' : 'مساعد صيدلي'}
                </p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, boxShadow: '0 4px 10px rgba(15, 118, 110, 0.15)' }}>
                {currentUser.name.split(' ').map((n: string) => n[0]).join('')}
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

      {/* Toast Notifications container */}
      <div 
        className="toast-container" 
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          left: '24px', 
          zIndex: 99999,
          pointerEvents: 'none'
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
              className={`toast toast-${t.type}`}
              style={{ pointerEvents: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                {t.type === 'success' && <CheckCircle size={18} />}
                {t.type === 'error' && <AlertTriangle size={18} />}
                {t.type === 'warning' && <AlertTriangle size={18} />}
                <span style={{ flex: 1 }}>{t.message}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Global Promise Confirm Modal */}
      <AnimatePresence>
        {confirmConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99998,
              backdropFilter: 'blur(8px)',
              padding: '20px'
            }}
            onClick={() => confirmConfig.resolve(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              style={{
                backgroundColor: 'var(--card-bg)',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '450px',
                padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(15, 118, 110, 0.25), 0 0 0 1px rgba(15, 118, 110, 0.05)',
                border: '1px solid var(--border-color)',
                direction: 'rtl',
                textAlign: 'right'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: 'var(--warning)' }}>
                <AlertTriangle size={48} strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', fontFamily: 'var(--font-headline)', textAlign: 'center' }}>
                تأكيد العملية
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px', textAlign: 'center' }}>
                {confirmConfig.message}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={confirmConfig.onConfirm}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px 24px', fontWeight: 700, borderRadius: '12px' }}
                >
                  نعم، استمر
                </button>
                <button
                  onClick={() => confirmConfig.resolve(false)}
                  className="btn"
                  style={{ 
                    flex: 1, 
                    padding: '12px 24px', 
                    fontWeight: 700, 
                    borderRadius: '12px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)'
                  }}
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
