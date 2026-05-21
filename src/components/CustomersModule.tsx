import { useState, useEffect } from 'react';
import { Search, Plus, Phone, Mail, Calendar, Edit2, Trash2 } from 'lucide-react';
import { getDb } from '../lib/db';
import { Customer } from '../types';
import { Modal } from './Modal';

export const CustomersModule = ({ initialSearch = "" }: { initialSearch?: string }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const fetchCustomers = async () => {
    const db = await getDb();
    const result = await db.select<Customer[]>("SELECT * FROM customers ORDER BY created_at DESC");
    setCustomers(result);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, phone: customer.phone, email: customer.email });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDb();
    if (editingCustomer) {
      await db.execute(
        "UPDATE customers SET name = $1, phone = $2, email = $3 WHERE id = $4",
        [formData.name, formData.phone, formData.email, editingCustomer.id]
      );
    } else {
      await db.execute(
        "INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3)",
        [formData.name, formData.phone, formData.email]
      );
    }
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "" });
    fetchCustomers();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;
    
    const db = await getDb();
    await db.execute("UPDATE customers SET balance = balance - $1 WHERE id = $2", [paymentAmount, selectedCustomer.id]);
    await db.execute(
      "INSERT INTO customer_transactions (customer_id, type, amount, description) VALUES ($1, $2, $3, $4)",
      [selectedCustomer.id, 'payment', paymentAmount, 'تسديد يدوي من المريض']
    );
    
    setIsPaymentModalOpen(false);
    setSelectedCustomer(null);
    setPaymentAmount(0);
    fetchCustomers();
    alert("تم تسجيل التسديد وتحديث الرصيد بنجاح");
  };

  const viewHistory = async (customer: Customer) => {
    const db = await getDb();
    const result = await db.select<any[]>(
      "SELECT * FROM customer_transactions WHERE customer_id = $1 ORDER BY created_at DESC",
      [customer.id]
    );
    setTransactions(result);
    setSelectedCustomer(customer);
    setIsHistoryModalOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>سجل المرضى</h2>
          <p style={{ color: 'var(--text-muted)' }}>إدارة ملفات المرضى وتاريخهم الطبي</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingCustomer(null); setFormData({ name: "", phone: "", email: "" }); setIsModalOpen(true); }}>
          <Plus size={20} /> إضافة مريض جديد
        </button>
      </div>

      <div className="card" style={{ marginBottom: '32px', padding: '24px' }}>
        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <Search size={20} style={{ 
            position: 'absolute', 
            right: '16px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-slate)',
            opacity: 0.6
          }} />
          <input 
            className="input" 
            placeholder="البحث عن المرضى بالاسم أو رقم الهاتف..." 
            style={{ 
              width: '100%', 
              paddingRight: '48px', 
              height: '56px', 
              fontSize: '1rem', 
              background: '#f2f4f6',
              border: '1px solid transparent',
              borderRadius: '16px'
            }} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="card" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                {customer.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{customer.name}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>مريض منذ: {new Date(customer.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-slate)' }}>
                <Phone size={14} /> {customer.phone}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-slate)' }}>
                <Mail size={14} /> {customer.email || 'لا يوجد بريد'}
              </div>
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: customer.balance > 0 ? 'rgba(186, 26, 26, 0.05)' : 'rgba(13, 148, 136, 0.05)', 
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>الرصيد المتبقي:</p>
                  <p style={{ fontWeight: 800, color: customer.balance > 0 ? 'var(--error)' : 'var(--primary)', fontSize: '1.1rem' }}>
                    {customer.balance?.toLocaleString() || 0} د.ع
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    className="btn-icon" 
                    title="تسديد" 
                    style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '32px', borderRadius: '8px', boxShadow: 'none', border: 'none' }}
                    onClick={() => { setSelectedCustomer(customer); setIsPaymentModalOpen(true); }}
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    className="btn-icon" 
                    title="السجل" 
                    style={{ background: 'var(--secondary)', color: 'white', width: '32px', height: '32px', borderRadius: '8px', boxShadow: 'none', border: 'none' }}
                    onClick={() => viewHistory(customer)}
                  >
                    <Calendar size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button 
                className="btn" 
                style={{ flex: 1, background: '#f2f4f6', height: '40px', fontSize: '0.875rem', justifyContent: 'center' }}
                onClick={() => handleEdit(customer)}
              >
                <Edit2 size={16} /> تعديل
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'rgba(186, 26, 26, 0.05)', color: 'var(--error)', height: '40px', fontSize: '0.875rem', justifyContent: 'center' }}
                onClick={async () => {
                  if(confirm("هل أنت متأكد من حذف سجل المريض؟")) {
                    const db = await getDb();
                    await db.execute("DELETE FROM customers WHERE id = $1", [customer.id]);
                    fetchCustomers();
                  }
                }}
              >
                <Trash2 size={16} /> حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCustomer ? "تعديل بيانات مريض" : "إضافة مريض جديد"}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>الاسم الكامل</label>
            <input 
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>رقم الهاتف</label>
            <input 
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>البريد الإلكتروني (اختياري)</label>
            <input 
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
            <button className="btn btn-primary" style={{ flex: 1, height: '56px', justifyContent: 'center' }}>
              {editingCustomer ? "تحديث البيانات" : "حفظ سجل المريض"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        title={`تسديد مبلغ للمريض: ${selectedCustomer?.name}`}
      >
        <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>المبلغ المدفوع (د.ع)</label>
            <input 
              type="number"
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
              value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <button className="btn btn-primary" style={{ height: '56px', justifyContent: 'center' }}>
            تأكيد التسديد وتحديث الرصيد
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
        title={`سجل المعاملات: ${selectedCustomer?.name}`}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>المبلغ</th>
                <th>الوصف</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${t.type === 'debt' ? 'badge-error' : 'badge-primary'}`}>
                      {t.type === 'debt' ? 'دين (شراء)' : 'تسديد'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{t.amount.toLocaleString()}</td>
                  <td style={{ fontSize: '0.75rem' }}>{t.description}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>لا توجد معاملات مسجلة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};
