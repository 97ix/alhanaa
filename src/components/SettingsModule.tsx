import { useState, useEffect } from 'react';
import { Save, User, Globe, Download, Upload, Trash2, Key, Plus, Edit2, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { geminiKeyManager } from '../lib/geminiKeyManager';
import { getDb, closeDb } from '../lib/db';
import { save, open } from '@tauri-apps/plugin-dialog';
import { copyFile } from '@tauri-apps/plugin-fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { Modal } from './Modal';

export const SettingsModule = ({ currentUser, onUserUpdate }: { currentUser?: any, onUserUpdate?: () => void }) => {
  const [pharmacyName, setPharmacyName] = useState("صيدلية الهناء");
  const [address, setAddress] = useState("بغداد، العراق");
  const [phone, setPhone] = useState("07701234567");
  const [taxRate, setTaxRate] = useState("15");
  const [userName, setUserName] = useState("د. أنس ثورن");
  const [userRole, setUserRole] = useState("صيدلي رئيسي");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiApiKeys, setGeminiApiKeys] = useState<string[]>([]);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [resetError, setResetError] = useState("");
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userFormData, setUserFormData] = useState({ name: "", role: "cashier", pin: "" });

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

  const fetchUsersList = async () => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>("SELECT * FROM users ORDER BY name ASC");
      setUsers(result);
    } catch (e) {
      console.error(e);
    }
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
            if (s.key === 'gemini_api_keys') {
              try {
                const parsed: string[] = JSON.parse(s.value || '[]');
                setGeminiApiKeys(Array.isArray(parsed) ? parsed : []);
              } catch (_) { setGeminiApiKeys([]); }
            }
        });
        await fetchUsersList();
    };
    fetchSettings();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.pin.trim()) {
      showNotification("يرجى إدخال اسم المستخدم ورمز PIN", "error");
      return;
    }
    if (!/^\d+$/.test(userFormData.pin)) {
      showNotification("رمز PIN يجب أن يتكون من أرقام فقط", "error");
      return;
    }
    const db = await getDb();
    try {
      if (editingUser) {
        const otherAdmins = users.filter(u => u.role === 'admin' && u.id !== editingUser.id);
        if (editingUser.role === 'admin' && userFormData.role === 'cashier' && otherAdmins.length === 0) {
          showNotification("لا يمكن تغيير دور المسؤول الوحيد في النظام", "error");
          return;
        }
        await db.execute(
          "UPDATE users SET name = $1, role = $2, pin = $3 WHERE id = $4",
          [userFormData.name.trim(), userFormData.role, userFormData.pin, editingUser.id]
        );
        showNotification("تم تحديث بيانات المستخدم بنجاح!", "success");
      } else {
        await db.execute(
          "INSERT INTO users (name, role, pin) VALUES ($1, $2, $3)",
          [userFormData.name.trim(), userFormData.role, userFormData.pin]
        );
        showNotification("تمت إضافة المستخدم الجديد بنجاح!", "success");
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserFormData({ name: "", role: "cashier", pin: "" });
      await fetchUsersList();
      if (onUserUpdate) onUserUpdate();
    } catch (err: any) {
      console.error(err);
      showNotification("فشل حفظ المستخدم: قد يكون الاسم مستخدماً بالفعل", "error");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;
    
    if (userToDelete.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        showNotification("لا يمكن حذف المسؤول الوحيد في النظام. يجب أن يتوفر مسؤول واحد على الأقل.", "error");
        return;
      }
    }

    if (currentUser && currentUser.id === userId) {
      showNotification("لا يمكنك حذف حسابك الحالي الذي تستخدمه لتسجيل الدخول", "error");
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.name}" نهائياً؟`)) return;

    const db = await getDb();
    try {
      await db.execute("DELETE FROM users WHERE id = $1", [userId]);
      showNotification("تم حذف المستخدم بنجاح", "success");
      await fetchUsersList();
      if (onUserUpdate) onUserUpdate();
    } catch (err) {
      console.error(err);
      showNotification("فشل في حذف المستخدم", "error");
    }
  };

  const handleSave = async () => {
    const db = await getDb();
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'tax_rate'", [taxRate]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'pharmacy_name'", [pharmacyName]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'pharmacy_address'", [address]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'pharmacy_phone'", [phone]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'user_name'", [userName]);
    await db.execute("UPDATE app_settings SET value = $1 WHERE key = 'user_role'", [userRole]);
    // Save primary key (backward compat) + full key pool
    const primaryKey = geminiApiKeys[0] || geminiApiKey;
    await db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gemini_api_key', $1)", [primaryKey]);
    await db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gemini_api_keys', $1)", [JSON.stringify(geminiApiKeys)]);
    // Reload the key manager singleton so changes take effect immediately
    await geminiKeyManager.load();
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleBackup = async () => {
    try {
      await closeDb();
      const dataDir = await appConfigDir();
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
        const dataDir = await appConfigDir();
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

  if (currentUser?.role !== 'admin') {
    return (
      <div className="fade-in card" style={{ padding: '40px', textAlign: 'center', margin: '40px auto', maxWidth: '600px' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '16px', fontWeight: 800 }}>عذراً، الوصول غير مصرح به</h2>
        <p style={{ color: 'var(--text-muted)' }}>لا تملك صلاحيات كافية للوصول إلى صفحة الإعدادات. هذه الصفحة مخصصة للمسؤولين فقط.</p>
      </div>
    );
  }

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
              <User size={20} color="var(--secondary)" /> إدارة مستخدمي النظام
            </h3>
            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem' }}
              onClick={() => {
                setEditingUser(null);
                setUserFormData({ name: "", role: "cashier", pin: "" });
                setIsUserModalOpen(true);
              }}
            >
              <Plus size={16} /> إضافة مستخدم
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>الاسم الكامل</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>الدور الوظيفي</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>رمز PIN</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800, textAlign: 'center', width: '120px' }}>خيارات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: 'transparent' }}>
                  <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                        {u.name.charAt(0)}
                      </div>
                      <span>{u.name}</span>
                      {currentUser && currentUser.id === u.id && (
                        <span className="badge badge-primary" style={{ fontSize: '8px', padding: '1px 6px', marginRight: '6px' }}>أنت</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>
                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                      {u.role === 'admin' ? 'صيدلي رئيسي' : 'مساعد صيدلي'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.85rem', fontFamily: 'monospace', letterSpacing: '2px' }}>
                    ••••
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        type="button" 
                        className="btn-icon" 
                        title="تعديل" 
                        style={{ color: 'var(--secondary)' }}
                        onClick={() => {
                          setEditingUser(u);
                          setUserFormData({ name: u.name, role: u.role, pin: u.pin });
                          setIsUserModalOpen(true);
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        type="button" 
                        className="btn-icon" 
                        title="حذف" 
                        style={{ color: 'var(--error)' }}
                        onClick={() => handleDeleteUser(u.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
            <Key size={20} color="var(--primary)" /> إعدادات الذكاء الاصطناعي (Gemini API)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-slate)', marginBottom: '24px' }}>
            أضف حتى <strong>10 مفاتيح API</strong>. عند نفاد حصة أي مفتاح (رمز 429)، يتحول التطبيق تلقائياً للمفتاح التالي دون الحاجة للتدخل اليدوي.
          </p>

          {/* Key Pool List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {geminiApiKeys.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '0.875rem' }}>
                لا توجد مفاتيح مضافة بعد. أضف مفتاحاً واحداً على الأقل لتفعيل الذكاء الاصطناعي.
              </div>
            )}
            {geminiApiKeys.map((key, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: idx === 0 ? 'rgba(13, 148, 136, 0.06)' : '#f8fafc',
                border: idx === 0 ? '1px solid rgba(13, 148, 136, 0.3)' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '10px 16px'
              }}>
                {/* Index badge */}
                <span style={{
                  minWidth: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: idx === 0 ? 'var(--primary)' : '#e2e8f0',
                  color: idx === 0 ? 'white' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 800
                }}>{idx + 1}</span>

                {/* Masked key */}
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {key.slice(0, 8)}{'•'.repeat(Math.max(0, key.length - 12))}{key.slice(-4)}
                </span>

                {/* Active badge */}
                {idx === 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(13,148,136,0.1)', padding: '3px 8px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
                    <CheckCircle2 size={12} /> الكود الرئيسي
                  </span>
                )}

                {/* Move to end (rotate down) */}
                {geminiApiKeys.length > 1 && idx === 0 && (
                  <button
                    title="نقل لآخر القائمة"
                    onClick={() => setGeminiApiKeys(prev => [...prev.slice(1), prev[0]])}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px', display: 'flex' }}
                  ><RotateCcw size={15} /></button>
                )}

                {/* Delete */}
                <button
                  title="حذف المفتاح"
                  onClick={() => setGeminiApiKeys(prev => prev.filter((_, i) => i !== idx))}
                  style={{ background: 'rgba(239,68,68,0.08)', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                ><X size={15} /></button>
              </div>
            ))}
          </div>

          {/* Add new key row */}
          {geminiApiKeys.length < 10 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="password"
                placeholder="AIzaSy... (أدخل مفتاح Gemini API جديد)"
                className="input"
                style={{ flex: 1, background: '#f2f4f6', border: 'none', height: '48px', fontFamily: 'monospace' }}
                value={newKeyInput}
                onChange={e => setNewKeyInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newKeyInput.trim()) {
                    setGeminiApiKeys(prev => [...prev, newKeyInput.trim()]);
                    setNewKeyInput('');
                  }
                }}
              />
              <button
                className="btn btn-primary"
                style={{ height: '48px', padding: '0 20px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  if (!newKeyInput.trim()) return;
                  setGeminiApiKeys(prev => [...prev, newKeyInput.trim()]);
                  setNewKeyInput('');
                }}
              >
                <Plus size={18} /> إضافة مفتاح
              </button>
            </div>
          )}
          {geminiApiKeys.length >= 10 && (
            <p style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>✓ وصلت للحد الأقصى (10 مفاتيح)</p>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px' }}>
            * المفتاح رقم 1 هو الكود النشط. عند نفاد حصته يتحول التطبيق تلقائياً للتالي. يمكنك إعادة ترتيب الأولوية بالضغط على زر الدوران ↺.
          </p>
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

      <Modal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setEditingUser(null);
          setUserFormData({ name: "", role: "cashier", pin: "" });
        }}
        title={editingUser ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد"}
      >
        <form onSubmit={handleSaveUser} style={{ display: 'grid', gap: '20px', direction: 'rtl' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>الاسم الكامل</label>
            <input 
              className="input" 
              style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={userFormData.name} 
              onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
              placeholder="مثال: أحمد علي"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>الدور الوظيفي</label>
            <select 
              className="input" 
              style={{ width: '100%', height: '48px', background: '#f2f4f6', border: 'none' }}
              value={userFormData.role} 
              onChange={e => setUserFormData({ ...userFormData, role: e.target.value })}
              required
            >
              <option value="cashier">مساعد صيدلي (كاشير)</option>
              <option value="admin">صيدلي رئيسي (مسؤول)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>رمز PIN (أرقام فقط)</label>
            <input 
              type="password"
              className="input" 
              style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={userFormData.pin} 
              onChange={e => setUserFormData({ ...userFormData, pin: e.target.value })}
              placeholder="رمز مرور رقمي يتكون من 4 إلى 6 أرقام"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ height: '48px', padding: '0 24px', fontWeight: 700 }}
            >
              حفظ
            </button>
            <button 
              type="button" 
              className="btn" 
              style={{ height: '48px', padding: '0 24px', background: '#f2f4f6', fontWeight: 700 }}
              onClick={() => {
                setIsUserModalOpen(false);
                setEditingUser(null);
                setUserFormData({ name: "", role: "cashier", pin: "" });
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

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
