import { useState, useEffect } from 'react';
import { triggerToast } from '../lib/toast';
import { Plus, Trash2 } from 'lucide-react';
import { getDb } from '../lib/db';
import { Modal } from './Modal';

export const ExpensesModule = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ category: "Rent", amount: 0, description: "" });

  const fetchExpenses = async () => {
    const db = await getDb();
    const result = await db.select<any[]>("SELECT * FROM expenses ORDER BY created_at DESC");
    setExpenses(result);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDb();
    await db.execute(
      "INSERT INTO expenses (category, amount, description) VALUES ($1, $2, $3)",
      [formData.category, formData.amount, formData.description]
    );
    triggerToast("تم تسجيل المصروف بنجاح!", "success");
    setIsModalOpen(false);
    setFormData({ category: "Rent", amount: 0, description: "" });
    fetchExpenses();
  };

  const deleteExpense = async (id: number) => {
    const confirmed = await (window as any).confirmDialog("هل أنت متأكد من حذف هذا المصروف؟");
    if (!confirmed) return;
    const db = await getDb();
    await db.execute("DELETE FROM expenses WHERE id = $1", [id]);
    triggerToast("تم حذف المصروف بنجاح!", "success");
    fetchExpenses();
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>المصاريف التشغيلية</h3>
          <p style={{ color: 'var(--text-muted)' }}>تتبع تكاليف التشغيل، الإيجارات، والرواتب</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> إضافة مصروف جديد
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الفئة</th>
              <th>الوصف</th>
              <th>المبلغ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => (
              <tr key={exp.id}>
                <td>{new Date(exp.created_at).toLocaleDateString()}</td>
                <td>
                  <span className="badge" style={{ background: 'var(--tab-bg)', color: 'var(--text-slate)' }}>
                    {exp.category === 'Rent' ? 'إيجار' : 
                     exp.category === 'Salary' ? 'رواتب' : 
                     exp.category === 'Bills' ? 'فواتير' : 'أخرى'}
                  </span>
                </td>
                <td>{exp.description}</td>
                <td style={{ fontWeight: 800, color: 'var(--error)' }}>{exp.amount.toLocaleString()} د.ع</td>
                <td>
                  <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => deleteExpense(exp.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>لا توجد مصاريف مسجلة</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إضافة مصروف جديد">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>نوع المصروف</label>
            <select 
              className="input" style={{ width: '100%', height: '48px', background: '#f2f4f6', border: 'none' }}
              value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="Rent">إيجار</option>
              <option value="Salary">رواتب</option>
              <option value="Bills">فواتير (كهرباء/ماء)</option>
              <option value="Other">أخرى</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>المبلغ (د.ع)</label>
            <input 
              type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
              value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>الوصف / الملاحظات</label>
            <input 
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <button className="btn btn-primary" style={{ height: '56px', justifyContent: 'center' }}>
            حفظ المصروف
          </button>
        </form>
      </Modal>
    </div>
  );
};
