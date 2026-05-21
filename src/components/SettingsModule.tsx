import { useState, useEffect } from 'react';
import { Save, User, Globe, Download, Upload, Trash2, Key } from 'lucide-react';
import { getDb, closeDb } from '../lib/db';
import { save, open } from '@tauri-apps/plugin-dialog';
import { copyFile } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

export const SettingsModule = () => {
  const [pharmacyName, setPharmacyName] = useState("صيدلية الهناء");
  const [address, setAddress] = useState("بغداد، العراق");
  const [phone, setPhone] = useState("07701234567");
  const [taxRate, setTaxRate] = useState("15");
  const [userName, setUserName] = useState("د. أنس ثورن");
  const [userRole, setUserRole] = useState("صيدلي رئيسي");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [resetError, setResetError] = useState("");
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  useEffect(() => {
    const fetchSettings = async () => {
        const db = await getDb();
        const results = await db.select<any[]>("SELECT * FROM app_settings");
        results.forEach(s => {
            if (s.key === 'tax_rate') setTaxRate(s.value);
            if (s.key === 'pharmacy_name') setPharmacyName(s.value);
            if (s.key === 'pharmacy_address') setAddress(s.value);
            if (s.key === 'pharmacy_phone') setPhone(s.value);
            if (s.key === 'user_name') setUserName(s.value);
            if (s.key === 'user_role') setUserRole(s.value);
            if (s.key === 'gemini_api_key') setGeminiApiKey(s.value || "");
        });
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    const db = await getDb();
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'tax_rate'", [taxRate]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'pharmacy_name'", [pharmacyName]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'pharmacy_address'", [address]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'pharmacy_phone'", [phone]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'user_name'", [userName]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'user_role'", [userRole]);
    await db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gemini_api_key', $1)", [geminiApiKey]);
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleBackup = async () => {
    try {
      await closeDb();
      const dataDir = await appLocalDataDir();
      const dbPath = await join(dataDir, 'pharmacy.db');
      
      const destination = await save({
        filters: [{ name: 'Database', extensions: ['db'] }],
        defaultPath: 'pharmacy_backup.db'
      });

      if (destination) {
        await copyFile(dbPath, destination);
        showNotification("تم إنشاء النسخة الاحتياطية بنجاح وحفظ الملف!", "success");
      }
      await getDb();
    } catch (err) {
      console.error(err);
      showNotification("فشل في إنشاء النسخة الاحتياطية. تأكد من أن قاعدة البيانات ليست قيد الاستخدام المكثف.", "error");
      await getDb();
    }
  };

  const handleRestoreClick = () => {
    setIsRestoreModalOpen(true);
  };

  const confirmRestoreData = async () => {
    setIsRestoreModalOpen(false);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Database', extensions: ['db'] }]
      });

      if (selected && !Array.isArray(selected)) {
        await closeDb();
        const dataDir = await appLocalDataDir();
        const dbPath = await join(dataDir, 'pharmacy.db');
        await copyFile(selected, dbPath);
        
        showNotification("تمت استعادة النسخة الاحتياطية وتحديث النظام بنجاح!", "success");
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      showNotification("فشل في استعادة البيانات أو تم إلغاء العملية.", "error");
      await getDb();
    }
  };

  const handleResetClick = () => {
    setResetConfirmInput("");
    setResetError("");
    setIsResetModalOpen(true);
  };

  const confirmResetData = async () => {
    if (resetConfirmInput !== "تصفير") {
      setResetError("الكلمة غير مطابقة. يرجى كتابة 'تصفير' بشكل صحيح.");
      return;
    }

    try {
      const db = await getDb();
      
      // Delete in correct order of foreign keys
      await db.execute("DELETE FROM sale_items");
      await db.execute("DELETE FROM sales");
      await db.execute("DELETE FROM customer_transactions");
      await db.execute("DELETE FROM customers");
      await db.execute("DELETE FROM supplier_transactions");
      await db.execute("DELETE FROM suppliers");
      await db.execute("DELETE FROM medicine_writeoffs");
      await db.execute("DELETE FROM medicine_batches");
      await db.execute("DELETE FROM medicines");
      await db.execute("DELETE FROM categories");
      await db.execute("DELETE FROM expenses");
      await db.execute("DELETE FROM app_settings");
      await db.execute("DELETE FROM sqlite_sequence");

      // Re-populate default values
      await db.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('tax_rate', '15')");
      await db.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('pharmacy_name', 'صيدلية الهناء')");
      await db.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('pharmacy_address', 'بغداد، العراق')");
      await db.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('pharmacy_phone', '07701234567')");
      await db.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_name', 'د. أنس ثورن')");
      await db.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_role', 'صيدلي رئيسي')");
      await db.execute("INSERT INTO categories (name) VALUES ('Antibiotics'), ('Painkillers'), ('Vitamins'), ('First Aid'), ('General')");

      setIsResetModalOpen(false);
      showNotification("تم تصفير جميع البيانات بنجاح وإعادة النظام إلى حالة المصنع الافتراضية.", "success");
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Error resetting data:", err);
      setResetError("فشل في تصفير البيانات: " + JSON.stringify(err));
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>الإعدادات</h2>
        <p style={{ color: 'var(--text-muted)' }}>تخصيص النظام وإعدادات الحساب</p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
            <Globe size={20} color="var(--primary)" /> معلومات الصيدلية
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>اسم الصيدلية</label>
              <input 
                className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
                value={pharmacyName} onChange={e => setPharmacyName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>العنوان</label>
              <input 
                className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
                value={address} onChange={e => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>رقم الهاتف</label>
              <input 
                className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
                value={phone} onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>نسبة الضريبة (%)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="number"
                  className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
                  value={taxRate} onChange={e => setTaxRate(e.target.value)}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--primary)' }}>%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
            <User size={20} color="var(--secondary)" /> الملف الشخصي للمستخدم
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>
                {userName.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 700, fontSize: '0.8rem' }}>اسم الصيدلي</label>
                <input 
                  className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '40px' }}
                  value={userName} onChange={e => setUserName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 700, fontSize: '0.8rem' }}>الدور الوظيفي</label>
              <input 
                className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '40px' }}
                value={userRole} onChange={e => setUserRole(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
            <Key size={20} color="var(--primary)" /> إعدادات الذكاء الاصطناعي (Gemini API)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>مفتاح Gemini API Key</label>
              <input 
                type="password"
                placeholder="AIzaSy..." 
                className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px', fontFamily: 'monospace' }}
                value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                * يُستخدم هذا المفتاح لتحليل صور قوائم الأدوية والفواتير آلياً باستخدام نموذج Gemini Flash. يتم حفظ المفتاح محلياً على جهازك فقط بشكل آمن.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
              <Download size={20} color="var(--primary)" /> النسخ الاحتياطي
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px' }}>قم بحفظ نسخة من كافة البيانات والعمليات في ملف خارجي.</p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleBackup}>إنشاء نسخة احتياطية</button>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
              <Upload size={20} color="var(--secondary)" /> استعادة البيانات
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px' }}>استرجع البيانات من ملف نسخة احتياطية سابق (سيمسح البيانات الحالية).</p>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', background: '#f2f4f6' }} onClick={handleRestoreClick}>استعادة نسخة سابقة</button>
          </div>
          <div className="card" style={{ borderColor: '#fee2e2', background: '#fff5f5' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800, color: '#dc2626' }}>
              <Trash2 size={20} color="#dc2626" /> تصفير البيانات
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#991b1b', marginBottom: '20px' }}>احذف كافة المبيعات، الأدوية، العملاء، والعمليات وعُد لضبط المصنع الافتراضي.</p>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', background: '#dc2626', color: 'white' }} onClick={handleResetClick}>تصفير كافة البيانات</button>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button className="btn btn-primary" style={{ height: '56px', padding: '0 48px', fontSize: '1.1rem' }} onClick={handleSave}>
            <Save size={20} /> {isSaved ? "تم الحفظ بنجاح!" : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {isResetModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
          padding: '20px'
        }}>
          <div className="card" style={{
            maxWidth: '450px',
            width: '100%',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '32px',
            textAlign: 'center',
            border: '1px solid #fee2e2'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Trash2 size={28} />
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
              تصفير قاعدة البيانات بالكامل
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
              تحذير: سيتم مسح كافة الأدوية، المبيعات، العملاء، والعمليات الحالية بشكل نهائي. لا يمكن التراجع عن هذا الإجراء أبداً.
            </p>

            <div style={{ textAlign: 'right', marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>
                لتأكيد الحذف، اكتب كلمة <strong style={{ color: '#dc2626' }}>تصفير</strong> أدناه:
              </label>
              <input
                type="text"
                className="input"
                style={{
                  width: '100%',
                  height: '44px',
                  background: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '0 12px',
                  fontSize: '1rem',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#dc2626'
                }}
                placeholder="اكتب تصفير هنا"
                value={resetConfirmInput}
                onChange={e => {
                  setResetConfirmInput(e.target.value);
                  setResetError("");
                }}
              />
              {resetError && (
                <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '6px', fontWeight: 600 }}>{resetError}</p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                className="btn"
                style={{
                  height: '44px',
                  justifyContent: 'center',
                  background: resetConfirmInput === "تصفير" ? '#dc2626' : '#f3f4f6',
                  color: resetConfirmInput === "تصفير" ? 'white' : '#9ca3af',
                  cursor: resetConfirmInput === "تصفير" ? 'pointer' : 'not-allowed',
                  fontWeight: 700
                }}
                disabled={resetConfirmInput !== "تصفير"}
                onClick={confirmResetData}
              >
                تأكيد التصفير
              </button>
              <button
                className="btn"
                style={{
                  height: '44px',
                  justifyContent: 'center',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  fontWeight: 700
                }}
                onClick={() => setIsResetModalOpen(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {isRestoreModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
          padding: '20px'
        }}>
          <div className="card" style={{
            maxWidth: '450px',
            width: '100%',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '32px',
            textAlign: 'center',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#dbeafe',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Upload size={28} />
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
              استعادة النسخة الاحتياطية
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
              تحذير: سيتم استبدال البيانات الحالية بالكامل بالنسخة الاحتياطية التي ستختارها. لا يمكن التراجع عن هذا الإجراء.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                className="btn btn-primary"
                style={{
                  height: '44px',
                  justifyContent: 'center',
                  fontWeight: 700
                }}
                onClick={confirmRestoreData}
              >
                اختيار الملف والاستعادة
              </button>
              <button
                className="btn"
                style={{
                  height: '44px',
                  justifyContent: 'center',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  fontWeight: 700
                }}
                onClick={() => setIsRestoreModalOpen(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: notification.type === 'success' ? '#10b981' : notification.type === 'error' ? '#ef4444' : '#3b82f6',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 10000,
          fontWeight: 700,
          direction: 'rtl',
          animation: 'slide-in 0.3s ease-out'
        }}>
          <span style={{ fontSize: '1.2rem' }}>
            {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span>{notification.message}</span>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
