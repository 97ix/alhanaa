import { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, CheckCircle, Trash2, ShieldAlert } from 'lucide-react';
import { getDb } from '../lib/db';
import { Modal } from './Modal';

export const ExpiryModule = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'expired' | 'critical' | 'warning' | 'safe'>('all');
  const [isWriteoffOpen, setIsWriteoffOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [writeoffQty, setWriteoffQty] = useState(0);
  const [writeoffReason, setWriteoffReason] = useState('Expired');
  
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchBatches = async () => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT mb.id, mb.medicine_id, mb.quantity, mb.expiry_date, mb.purchase_price, mb.selling_price,
               m.name as medicine_name, m.scientific_name, c.name as category_name
        FROM medicine_batches mb
        INNER JOIN medicines m ON mb.medicine_id = m.id
        LEFT JOIN categories c ON m.category_id = c.id
        WHERE mb.quantity > 0
        ORDER BY mb.expiry_date ASC
      `);
      
      const processed = result.map(b => {
        const expDate = new Date(b.expiry_date);
        const today = new Date();
        // Reset time parts for accurate day diff
        expDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status: 'expired' | 'critical' | 'warning' | 'safe' = 'safe';
        if (diffDays < 0) status = 'expired';
        else if (diffDays < 90) status = 'critical';
        else if (diffDays < 180) status = 'warning';
        
        return { ...b, daysLeft: diffDays, status };
      });
      
      setBatches(processed);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleWriteoffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    if (writeoffQty <= 0 || writeoffQty > selectedBatch.quantity) {
      showNotification("يرجى إدخال كمية صحيحة لا تتجاوز الكمية المتاحة في الوجبة", "error");
      return;
    }

    try {
      const db = await getDb();
      
      // 1. Record write-off
      await db.execute(
        "INSERT INTO medicine_writeoffs (medicine_id, batch_id, quantity, reason) VALUES ($1, $2, $3, $4)",
        [selectedBatch.medicine_id, selectedBatch.id, writeoffQty, writeoffReason]
      );
      
      // 2. Deduct batch stock
      await db.execute(
        "UPDATE medicine_batches SET quantity = quantity - $1 WHERE id = $2",
        [writeoffQty, selectedBatch.id]
      );
      
      // 3. Deduct total stock in medicines table
      await db.execute(
        "UPDATE medicines SET stock = stock - $1 WHERE id = $2",
        [writeoffQty, selectedBatch.medicine_id]
      );

      setIsWriteoffOpen(false);
      setSelectedBatch(null);
      showNotification("تم تسجيل إتلاف وجبة الدواء وتحديث المخزون بنجاح!");
      await fetchBatches();
    } catch (err) {
      console.error(err);
      showNotification("فشل تسجيل عملية الإتلاف", "error");
    }
  };

  // Filter calculations
  const expiredCount = batches.filter(b => b.status === 'expired').length;
  const criticalCount = batches.filter(b => b.status === 'critical').length;
  const warningCount = batches.filter(b => b.status === 'warning').length;
  const safeCount = batches.filter(b => b.status === 'safe').length;

  const filteredBatches = batches.filter(b => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  return (
    <div className="fade-in" style={{ direction: 'rtl' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>تنبيهات صلاحية الأدوية</h2>
        <p style={{ color: 'var(--text-muted)' }}>مراقبة تواريخ انتهاء صلاحية الأدوية وإدارة الإتلاف والوجبات الحرجة.</p>
      </div>

      {/* Expiry KPI Dashboard */}
      <section className="dashboard-grid" style={{ marginBottom: '32px' }}>
        <div 
          className={`metric-card ${filter === 'expired' ? 'active' : ''}`}
          style={{ cursor: 'pointer', border: filter === 'expired' ? '2px solid var(--error)' : '1px solid var(--border)', background: 'var(--error-container)' }}
          onClick={() => setFilter('expired')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--error)' }}>
              <ShieldAlert size={24} />
            </div>
            <span className="badge badge-error">منتهية</span>
          </div>
          <div>
            <p className="val-label" style={{ color: 'var(--error)' }}>منتهية الصلاحية</p>
            <h3 className="val-amount" style={{ color: 'var(--error)' }}>{expiredCount} <span style={{ fontSize: '1rem', fontWeight: 500 }}>وجبة</span></h3>
          </div>
        </div>

        <div 
          className={`metric-card ${filter === 'critical' ? 'active' : ''}`}
          style={{ cursor: 'pointer', border: filter === 'critical' ? '2px solid var(--warning)' : '1px solid var(--border)', background: 'var(--warning-container)' }}
          onClick={() => setFilter('critical')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
              <AlertTriangle size={24} />
            </div>
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>&lt; 90 يوم</span>
          </div>
          <div>
            <p className="val-label" style={{ color: 'var(--warning)' }}>حرجة (قريبة جداً)</p>
            <h3 className="val-amount" style={{ color: 'var(--warning)' }}>{criticalCount} <span style={{ fontSize: '1rem', fontWeight: 500 }}>وجبة</span></h3>
          </div>
        </div>

        <div 
          className={`metric-card ${filter === 'warning' ? 'active' : ''}`}
          style={{ cursor: 'pointer', border: filter === 'warning' ? '2px solid var(--warning)' : '1px solid var(--border)', background: 'var(--warning-container)' }}
          onClick={() => setFilter('warning')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(234, 179, 8, 0.15)', color: 'var(--warning)' }}>
              <Calendar size={24} />
            </div>
            <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: 'var(--warning)' }}>&lt; 180 يوم</span>
          </div>
          <div>
            <p className="val-label" style={{ color: 'var(--warning)' }}>تنبيه صلاحية</p>
            <h3 className="val-amount" style={{ color: 'var(--warning)' }}>{warningCount} <span style={{ fontSize: '1rem', fontWeight: 500 }}>وجبة</span></h3>
          </div>
        </div>

        <div 
          className={`metric-card ${filter === 'safe' ? 'active' : ''}`}
          style={{ cursor: 'pointer', border: filter === 'safe' ? '2px solid var(--primary)' : '1px solid var(--border)', background: 'var(--success-container)' }}
          onClick={() => setFilter('safe')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)' }}>
              <CheckCircle size={24} />
            </div>
            <span className="badge badge-primary">آمنة</span>
          </div>
          <div>
            <p className="val-label" style={{ color: 'var(--primary)' }}>وجبات صالحة وآمنة</p>
            <h3 className="val-amount" style={{ color: 'var(--primary)' }}>{safeCount} <span style={{ fontSize: '1rem', fontWeight: 500 }}>وجبة</span></h3>
          </div>
        </div>
      </section>

      {/* Filter Reset Button */}
      {filter !== 'all' && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-start' }}>
          <button 
            className="btn" 
            style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
            onClick={() => setFilter('all')}
          >
            عرض جميع الوجبات ({batches.length})
          </button>
        </div>
      )}

      {/* Batches Table */}
      <div className="table-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800 }}>اسم الدواء</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800 }}>الاسم العلمي</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800 }}>الفئة</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800, textAlign: 'center' }}>الكمية بالوجبة</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800, textAlign: 'center' }}>تاريخ انتهاء الصلاحية</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800, textAlign: 'center' }}>الأيام المتبقية</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800, textAlign: 'center' }}>الحالة</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-slate)', fontWeight: 800, textAlign: 'center', width: '100px' }}>خيارات</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '16px', fontSize: '0.9rem', fontWeight: 800 }}>{b.medicine_name}</td>
                <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{b.scientific_name || '-'}</td>
                <td style={{ padding: '16px', fontSize: '0.85rem' }}>{b.category_name || '-'}</td>
                <td style={{ padding: '16px', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>{b.quantity} قطعة</td>
                <td style={{ padding: '16px', fontSize: '0.85rem', textAlign: 'center', fontFamily: 'monospace' }}>{b.expiry_date}</td>
                <td style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}>
                  {b.daysLeft < 0 ? (
                    <span style={{ color: '#dc2626' }}>منتهي الصلاحية ({Math.abs(b.daysLeft)} يوم)</span>
                  ) : b.daysLeft === 0 ? (
                    <span style={{ color: '#ea580c' }}>تنتهي اليوم!</span>
                  ) : (
                    <span>{b.daysLeft} يوم</span>
                  )}
                </td>
                <td style={{ padding: '16px', textAlign: 'center' }}>
                  <span className={`badge ${
                    b.status === 'expired' ? 'badge-error' :
                    b.status === 'critical' ? 'badge-secondary' :
                    b.status === 'warning' ? 'badge-primary' : 'badge-success'
                  }`} style={{
                    background: b.status === 'critical' ? 'var(--warning-container)' : b.status === 'warning' ? 'var(--warning-container)' : undefined,
                    color: b.status === 'critical' ? 'var(--warning)' : b.status === 'warning' ? 'var(--warning)' : undefined,
                  }}>
                    {b.status === 'expired' ? 'منتهي الصلاحية' :
                     b.status === 'critical' ? 'حرج جداً' :
                     b.status === 'warning' ? 'تنبيه' : 'آمن وصالح'}
                  </span>
                </td>
                <td style={{ padding: '16px', textAlign: 'center' }}>
                  <button 
                    className="btn btn-primary"
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      background: 'rgba(220, 38, 38, 0.08)', 
                      color: '#dc2626',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}
                    onClick={() => {
                      setSelectedBatch(b);
                      setWriteoffQty(b.quantity);
                      setIsWriteoffOpen(true);
                    }}
                  >
                    <Trash2 size={12} /> إتلاف الوجبة
                  </button>
                </td>
              </tr>
            ))}
            {filteredBatches.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-slate)' }}>
                  لا توجد وجبات أدوية مطابقة للفلتر المحدد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Write-off Modal */}
      {selectedBatch && (
        <Modal
          isOpen={isWriteoffOpen}
          onClose={() => {
            setIsWriteoffOpen(false);
            setSelectedBatch(null);
          }}
          title="تسجيل إتلاف واستبعاد وجبة دواء"
        >
          <form onSubmit={handleWriteoffSubmit} style={{ display: 'grid', gap: '20px' }}>
            <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>{selectedBatch.medicine_name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>الاسم العلمي: {selectedBatch.scientific_name || '-'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                كمية الوجبة المتاحة: <strong>{selectedBatch.quantity} قطعة</strong> | تاريخ الانتهاء: <strong>{selectedBatch.expiry_date}</strong>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>الكمية المستبعدة للإتلاف</label>
              <input
                type="number"
                min="1"
                max={selectedBatch.quantity}
                className="input"
                style={{ width: '100%', background: 'var(--bg)', border: 'none', height: '48px' }}
                value={writeoffQty}
                onChange={e => setWriteoffQty(Math.min(selectedBatch.quantity, Math.max(1, parseInt(e.target.value) || 0)))}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>سبب الاستبعاد</label>
              <select
                className="input"
                style={{ width: '100%', height: '48px', background: 'var(--bg)', border: 'none' }}
                value={writeoffReason}
                onChange={e => setWriteoffReason(e.target.value)}
                required
              >
                <option value="Expired">منتهي الصلاحية</option>
                <option value="Damaged">تالف أو مكسور</option>
                <option value="Lost">مفقود</option>
                <option value="Other">أخرى</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ height: '48px', padding: '0 24px', background: '#dc2626', fontWeight: 700 }}
              >
                تأكيد الإتلاف
              </button>
              <button 
                type="button" 
                className="btn" 
                style={{ height: '48px', padding: '0 24px', background: 'var(--bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 700 }}
                onClick={() => {
                  setIsWriteoffOpen(false);
                  setSelectedBatch(null);
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: notification.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 10000,
          fontWeight: 700,
          direction: 'rtl'
        }}>
          <span style={{ fontSize: '1.2rem' }}>
            {notification.type === 'success' ? '✅' : '❌'}
          </span>
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};
