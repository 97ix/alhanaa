import { useState, useEffect } from 'react';
import { triggerToast } from '../lib/toast';
import { 
  Users, 
  Plus, 
  Phone, 
  Mail, 
  History, 
  CreditCard, 
  Truck, 
  Clock,
  ChevronLeft,
  Share2,
  MapPin,
  CheckCircle,
  Edit2,
  Trash2,
  Search
} from 'lucide-react';
import { getDb } from '../lib/db';
import { Modal } from './Modal';

export const SuppliersModule = ({ initialSearch = "", currentUser }: { initialSearch?: string, currentUser?: any }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    phone: "",
    email: ""
  });

  const fetchSuppliers = async () => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>("SELECT * FROM suppliers ORDER BY created_at DESC");
      setSuppliers(result);
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    }
  };

  const fetchActivities = async () => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT t.*, s.name as supplier_name 
        FROM supplier_transactions t 
        JOIN suppliers s ON t.supplier_id = s.id 
        ORDER BY t.created_at DESC LIMIT 5
      `);
      setActivities(result);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchActivities();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const db = await getDb();
      if (editingSupplier) {
        await db.execute(
          "UPDATE suppliers SET name = $1, location = $2, phone = $3, email = $4 WHERE id = $5",
          [formData.name, formData.location, formData.phone, formData.email, editingSupplier.id]
        );
      } else {
        await db.execute(
          "INSERT INTO suppliers (name, location, phone, email, balance) VALUES ($1, $2, $3, $4, 0)",
          [formData.name, formData.location, formData.phone, formData.email]
        );
      }
      
      setIsSuccess(true);
      triggerToast(editingSupplier ? "تم تحديث بيانات المورد بنجاح!" : "تم إضافة المورد الجديد بنجاح!", "success");
      setTimeout(() => {
        setIsSuccess(false);
        setIsModalOpen(false);
        setEditingSupplier(null);
        setFormData({ name: "", location: "", phone: "", email: "" });
        fetchSuppliers();
      }, 1000);
    } catch (err) {
      console.error("Failed to save supplier:", err);
      triggerToast("حدث خطأ أثناء حفظ بيانات المورد", "error");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await (window as any).confirmDialog("هل أنت متأكد من حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.");
    if (!confirmed) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM suppliers WHERE id = $1", [id]);
      triggerToast("تم حذف المورد بنجاح!", "success");
      fetchSuppliers();
    } catch (err) {
      console.error("Failed to delete supplier:", err);
      triggerToast("حدث خطأ أثناء حذف المورد", "error");
    }
  };

  const startEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      location: supplier.location,
      phone: supplier.phone,
      email: supplier.email
    });
    setIsModalOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('.').slice(0, 3);
  };

  const totalDebt = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

  return (
    <div className="fade-in">
      {/* Header Section */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>إدارة الموردين والمذاخر</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>تتبع الحسابات، المديونيات، وحركات التوريد الخاصة بالصيدلية</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 28px' }} onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> إضافة مورد جديد
        </button>
      </div>

      {/* Bento Grid Stats */}
      <div className="dashboard-grid" style={{ marginBottom: '40px' }}>
        <div className="metric-card" style={{ border: 'none', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-slate)', fontWeight: 500 }}>إجمالي المديونية</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(0, 100, 85, 0.1)', color: 'var(--primary)' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>{totalDebt.toLocaleString('en-US')}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-slate)', fontWeight: 700 }}>د.ع</span>
          </div>
        </div>

        <div className="metric-card" style={{ border: 'none', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-slate)', fontWeight: 500 }}>الموردين النشطين</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(0, 98, 105, 0.1)', color: 'var(--tertiary)' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>{suppliers.length}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-slate)', fontWeight: 700 }}>مورد</span>
          </div>
        </div>

        <div className="metric-card" style={{ border: 'none', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-slate)', fontWeight: 500 }}>طلبات هذا الشهر</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(48, 94, 163, 0.1)', color: 'var(--secondary)' }}>
              <Truck size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>{activities.filter(a => a.type === 'receiving').length}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-slate)', fontWeight: 700 }}>شحنة</span>
          </div>
        </div>

        <div className="metric-card" style={{ border: 'none', background: 'var(--card-bg)', borderBottom: '4px solid var(--error)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-slate)', fontWeight: 500 }}>مدفوعات مستحقة</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(186, 26, 26, 0.1)', color: 'var(--error)' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>{(totalDebt * 0.2).toLocaleString('en-US')}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-slate)', fontWeight: 700 }}>د.ع</span>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <Search size={20} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-slate)', opacity: 0.6 }} />
          <input 
            className="input" 
            placeholder="البحث عن مورد، موقع، أو رقم هاتف..." 
            style={{ width: '100%', paddingRight: '48px', height: '56px', fontSize: '1rem', background: '#f2f4f6', border: '1px solid transparent', borderRadius: '16px' }} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3 style={{ fontWeight: 800, fontSize: '1.125rem' }}>قائمة المذاخر والموردين</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-icon" onClick={() => fetchSuppliers()} title="تحديث القائمة"><History size={18} /></button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ background: 'transparent' }}>
            <thead>
              <tr>
                <th>المورد / المذخر</th>
                <th>معلومات الاتصال</th>
                <th>آخر معاملة</th>
                <th style={{ textAlign: 'left' }}>الرصيد / الديون</th>
                <th>الحالة</th>
                <th style={{ width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.location?.toLowerCase().includes(searchQuery.toLowerCase()) || s.phone?.includes(searchQuery)).map(sup => (
                <tr key={sup.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', background: 'rgba(0, 100, 85, 0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 800, fontSize: '0.875rem' }}>
                        {getInitials(sup.name)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>{sup.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-slate)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={10} /> {sup.location}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Phone size={14} color="var(--text-slate)" /> {sup.phone}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} color="var(--text-slate)" /> {sup.email}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {sup.created_at ? new Date(sup.created_at).toLocaleDateString('en-US') : '-'}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <p style={{ fontWeight: 800, color: sup.balance > 0 ? 'var(--error)' : 'var(--primary)' }}>
                      {(sup.balance || 0).toLocaleString('en-US')} د.ع
                    </p>
                    <p style={{ fontSize: '10px', color: sup.balance > 0 ? 'var(--error)' : 'var(--primary)', fontWeight: 600 }}>
                      {sup.balance > 0 ? "مديونية متأخرة" : "حساب مصفى"}
                    </p>
                  </td>
                  <td>
                    <span className={`badge ${sup.status === 'active' ? 'badge-primary' : 'badge-secondary'}`}>
                       <span className="badge-dot" style={{ background: sup.status === 'active' ? 'var(--primary)' : 'var(--text-slate)' }}></span>
                       {sup.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {currentUser?.role === 'admin' && (
                        <>
                          <button className="btn-icon" style={{ color: 'var(--secondary)' }} onClick={() => startEdit(sup)}><Edit2 size={16} /></button>
                          <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleDelete(sup.id)}><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-slate)' }}>
                    لا يوجد موردين مسجلين بعد. ابدأ بإضافة مورد جديد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Sidebars */}
      <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div style={{ background: 'var(--primary)', padding: '40px', borderRadius: '24px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 100, 85, 0.25)' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '500px' }}>
            <h4 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '16px', fontFamily: 'var(--font-headline)' }}>هل تحتاج لإضافة مورد خارجي؟</h4>
            <p style={{ opacity: 0.8, lineHeight: 1.8, marginBottom: '32px' }}>بإمكانك ربط نظام "صيدلية الهناء" مباشرة مع أنظمة الموردين المعتمدين لتلقي الفواتير آلياً وتحديث المخزون فورياً دون الحاجة للإدخال اليدوي.</p>
            <button className="btn" style={{ background: 'white', color: 'var(--primary)', padding: '12px 32px', fontWeight: 800 }}>
              طلب ربط تقني <ChevronLeft size={20} style={{ marginRight: '8px' }} />
            </button>
          </div>
          <div style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', opacity: 0.05 }}>
             <Share2 size={240} />
          </div>
        </div>

        <div className="card" style={{ background: 'var(--sidebar-bg)', border: '1px solid white' }}>
           <h4 style={{ fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <History size={18} color="var(--primary)" /> آخر النشاطات
           </h4>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
             {activities.map(act => (
               <div key={act.id} style={{ borderRight: '2px solid var(--border)', paddingRight: '24px', position: 'relative' }}>
                  <div style={{ position: 'absolute', right: '-9px', top: '0', width: '16px', height: '16px', borderRadius: '50%', background: 'white', border: `3px solid ${act.type === 'payment' ? 'var(--primary)' : 'var(--secondary)'}` }}></div>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{act.type === 'payment' ? 'تسديد فاتورة' : 'استلام شحنة'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {act.description || `تمت العملية بنجاح لصالح ${act.supplier_name}`}
                  </p>
                  <span style={{ fontSize: '10px', color: 'var(--text-slate)', marginTop: '8px', display: 'block' }}>
                    {new Date(act.created_at).toLocaleString('en-US')}
                  </span>
               </div>
             ))}
             {activities.length === 0 && (
               <p style={{ fontSize: '0.8125rem', color: 'var(--text-slate)', textAlign: 'center', padding: '20px' }}>لا توجد نشاطات مؤخراً</p>
             )}
           </div>
        </div>
      </div>

      {/* Add/Edit Supplier Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingSupplier(null); setFormData({ name: "", location: "", phone: "", email: "" }); }} title={editingSupplier ? "تعديل بيانات المورد" : "إضافة مورد جديد للقائمة"}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>اسم المورد / المذخر</label>
            <input 
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="مثال: مذخر الأمل الدوائي"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>العنوان / الموقع</label>
            <input 
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}
              placeholder="بغداد، الكرادة"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>رقم الهاتف</label>
              <input 
                className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="0770..."
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>البريد الإلكتروني</label>
              <input 
                type="email" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="info@example.com"
              />
            </div>
          </div>
          
          <button className="btn btn-primary" style={{ marginTop: '12px', height: '56px', justifyContent: 'center', fontSize: '1.1rem' }} disabled={isSuccess}>
            {isSuccess ? <><CheckCircle size={20} /> تم حفظ البيانات</> : (editingSupplier ? "تحديث المورد" : "إضافة المورد")}
          </button>
        </form>
      </Modal>
    </div>
  );
};
