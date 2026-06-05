import { useState, useEffect } from 'react';
import { ShoppingCart, History, Eye } from 'lucide-react';
import { POSModule } from './POSModule';
import { getDb } from '../lib/db';
import { Modal } from './Modal';

export const OrdersModule = ({ posProps }: any) => {
  const [activeSubTab, setActiveSubTab] = useState<'new' | 'history'>('new');
  const [sales, setSales] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [preDiscountTotal, setPreDiscountTotal] = useState(0);

  const fetchSales = async () => {
    const db = await getDb();
    let query = `
      SELECT s.*, IFNULL(c.name, s.customer_name) as customer_name
      FROM sales s 
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE 1=1
    `;

    if (filter === 'today') query += " AND date(s.created_at) = date('now') ";
    else if (filter === 'week') query += " AND date(s.created_at) >= date('now', '-7 days') ";
    else if (filter === 'month') query += " AND date(s.created_at) >= date('now', 'start of month') ";

    query += " ORDER BY s.created_at DESC ";
    const result = await db.select<any[]>(query);
    setSales(result);
  };

  useEffect(() => {
    if (activeSubTab === 'history') fetchSales();
  }, [activeSubTab, filter]);

  const handleViewSale = async (sale: any) => {
    const db = await getDb();
    const items = await db.select<any[]>(`
      SELECT si.*, m.name as medicine_name, IFNULL(m.tax_rate, 0) as medicine_tax_rate
      FROM sale_items si 
      JOIN medicines m ON si.medicine_id = m.id 
      WHERE si.sale_id = $1
    `, [sale.id]);
    
    let totalValue = 0;
    items.forEach(item => {
      totalValue += (item.unit_price * item.quantity);
    });
    
    // Group sale items by medicine_id and unit_price to display them consolidated
    const groupedItemsMap: Record<string, any> = {};
    items.forEach(item => {
      const key = `${item.medicine_id}-${item.unit_price}`;
      if (groupedItemsMap[key]) {
        groupedItemsMap[key].quantity += item.quantity;
        groupedItemsMap[key].rawItems.push({ id: item.id, quantity: item.quantity });
      } else {
        groupedItemsMap[key] = {
          ...item,
          rawItems: [{ id: item.id, quantity: item.quantity }]
        };
      }
    });
    const groupedItems = Object.values(groupedItemsMap);
    
    setPreDiscountTotal(totalValue);
    setSaleItems(groupedItems);
    setSelectedSale(sale);
    setSelectedItemIds([]); 
    
    const qtys: Record<string, number> = {};
    groupedItems.forEach(i => {
      const key = `${i.medicine_id}-${i.unit_price}`;
      qtys[key] = i.quantity;
    });
    setReturnQuantities(qtys);
    setIsModalOpen(true);
  };

  const toggleAllItems = () => {
    if (selectedItemIds.length === saleItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(saleItems.map(i => `${i.medicine_id}-${i.unit_price}`));
    }
  };

  const toggleItem = (key: string) => {
    setSelectedItemIds(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const updateReturnQty = (key: string, delta: number, max: number) => {
    setReturnQuantities(prev => ({
      ...prev,
      [key]: Math.max(1, Math.min(max, (prev[key] || 1) + delta))
    }));
  };

  const getLivePreview = () => {
    if (!selectedSale || preDiscountTotal === 0) return 0;
    let liveRefund = 0;
    const payRatio = selectedSale.total_amount / preDiscountTotal;
    selectedItemIds.forEach(key => {
      const item = saleItems.find(i => `${i.medicine_id}-${i.unit_price}` === key);
      const qty = returnQuantities[key] || 0;
      if (item) {
        liveRefund += (item.unit_price * qty) * payRatio;
      }
    });
    return liveRefund;
  };

  const processReturn = async () => {
    if (!selectedSale || selectedItemIds.length === 0) return;
    if (!confirm(`سيتم استرجاع الكميات المحددة. هل أنت متأكد؟`)) return;

    const db = await getDb();
    let actualRefundToUser = 0;
    const payRatio = preDiscountTotal > 0 ? selectedSale.total_amount / preDiscountTotal : 1;

    for (const key of selectedItemIds) {
      const item = saleItems.find(i => `${i.medicine_id}-${i.unit_price}` === key);
      if (!item) continue;

      let qtyToReturn = returnQuantities[key] || 0;
      const sortedRawItems = [...item.rawItems].sort((a, b) => b.id - a.id);

      for (const rawItem of sortedRawItems) {
        if (qtyToReturn <= 0) break;
        const returnFromThis = Math.min(rawItem.quantity, qtyToReturn);
        
        await db.execute(
          "UPDATE medicines SET stock = stock + $1 WHERE id = $2",
          [returnFromThis, item.medicine_id]
        );
        
        const itemValueWithTax = (item.unit_price * returnFromThis);
        actualRefundToUser += (itemValueWithTax * payRatio);
        
        if (returnFromThis >= rawItem.quantity) {
          await db.execute("DELETE FROM sale_items WHERE id = $1", [rawItem.id]);
        } else {
          await db.execute("UPDATE sale_items SET quantity = quantity - $1 WHERE id = $2", [returnFromThis, rawItem.id]);
        }
        qtyToReturn -= returnFromThis;
      }
    }

    // Calculate debt reduction and cash refund
    let debtReduction = 0;
    let cashRefund = 0;
    
    if (selectedSale.customer_id) {
      const originalSaleDebt = Math.max(0, selectedSale.total_amount - (selectedSale.amount_paid || 0));
      if (originalSaleDebt > 0) {
        debtReduction = Math.min(originalSaleDebt, actualRefundToUser);
        cashRefund = actualRefundToUser - debtReduction;
      } else {
        cashRefund = actualRefundToUser;
      }
      
      if (debtReduction > 0) {
        // Decrease customer balance (which represents outstanding debt)
        await db.execute(
          "UPDATE customers SET balance = balance - $1 WHERE id = $2",
          [debtReduction, selectedSale.customer_id]
        );
        // Record the transaction on the customer's account
        await db.execute(
          "INSERT INTO customer_transactions (customer_id, type, amount, description) VALUES ($1, $2, $3, $4)",
          [selectedSale.customer_id, 'payment', debtReduction, `إرجاع مبيعات (تخفيض دين) لفاتورة #${selectedSale.id}`]
        );
      }
    } else {
      cashRefund = actualRefundToUser;
    }

    const remainingItemsRaw = await db.select<any[]>("SELECT * FROM sale_items WHERE sale_id = $1", [selectedSale.id]);
    
    if (remainingItemsRaw.length === 0) {
      await db.execute(
        "UPDATE sales SET status = 'returned', total_amount = 0, tax_amount = 0, discount = 0, amount_paid = 0 WHERE id = $1", 
        [selectedSale.id]
      );
    } else {
      const newTotal = Math.max(0, selectedSale.total_amount - actualRefundToUser);
      const newDiscount = selectedSale.total_amount > 0 
        ? selectedSale.discount * (newTotal / selectedSale.total_amount) 
        : 0;
      const newAmountPaid = Math.max(0, (selectedSale.amount_paid || 0) - cashRefund);
      
      await db.execute(
        "UPDATE sales SET total_amount = $1, status = 'partial_returned', discount = $2, amount_paid = $3 WHERE id = $4", 
        [newTotal, newDiscount, newAmountPaid, selectedSale.id]
      );
    }

    setIsModalOpen(false);
    fetchSales();
    alert("تم إجراء التعديلات واسترجاع الضريبة وتحديث حساب العميل / المبالغ المحددة.");
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: '#f1f5f9', padding: '6px', borderRadius: '16px', width: 'fit-content' }}>
        <button 
          onClick={() => setActiveSubTab('new')}
          className={`btn ${activeSubTab === 'new' ? 'btn-primary' : ''}`}
          style={{ 
            background: activeSubTab === 'new' ? 'var(--primary)' : 'transparent', 
            color: activeSubTab === 'new' ? 'white' : 'var(--text-slate)',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700
          }}
        >
          <ShoppingCart size={18} /> إنشاء طلب جديد
        </button>
        <button 
          onClick={() => setActiveSubTab('history')}
          className={`btn ${activeSubTab === 'history' ? 'btn-primary' : ''}`}
          style={{ 
            background: activeSubTab === 'history' ? 'var(--primary)' : 'transparent', 
            color: activeSubTab === 'history' ? 'white' : 'var(--text-slate)',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700
          }}
        >
          <History size={18} /> سجل المبيعات والطلبات
        </button>
      </div>

      {activeSubTab === 'new' ? (
        <POSModule {...posProps} />
      ) : (
        <div className="card fade-in" style={{ padding: 0 }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>سجل المبيعات</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>مراجعة وتعديل الفواتير السابقة</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="input" 
                  style={{ height: '44px', background: '#f2f4f6', border: 'none', borderRadius: '12px', padding: '0 16px', fontWeight: 600 }}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">كل الأوقات</option>
                  <option value="today">اليوم</option>
                  <option value="week">آخر 7 أيام</option>
                  <option value="month">هذا الشهر</option>
                </select>
                <button className="btn btn-primary" onClick={fetchSales}>تحديث</button>
            </div>
          </div>
          <table style={{ margin: '0' }}>
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>التاريخ والوقت</th>
                <th>اسم المريض / العميل</th>
                <th>المجموع الكلي</th>
                <th>حالة الفاتورة</th>
                <th style={{ textAlign: 'center' }}>التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {sales.length > 0 ? sales.map(sale => (
                <tr key={sale.id} onClick={() => handleViewSale(sale)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 700 }}>#{sale.id}</td>
                  <td style={{ fontSize: '0.875rem' }}>{new Date(sale.created_at).toLocaleString('en-US')}</td>
                  <td style={{ fontWeight: 600 }}>{sale.customer_name || 'عميل نقدي'}</td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{sale.total_amount.toLocaleString()} د.ع</td>
                  <td>
                    {sale.status === 'returned' ? (
                      <span className="badge badge-error">مسترجع كلياً</span>
                    ) : sale.status === 'partial_returned' ? (
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>مسترجع جزئي</span>
                    ) : (
                      <span className="badge badge-success">مدفوعة ومكتملة</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn-eye-modern"><Eye size={20} /></button>
                  </td>
                </tr>
              )) : (
                <tr>
                   <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>لا توجد فواتير مسجلة حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`تفاصيل فاتورة #${selectedSale?.id}`}>
            {selectedSale && (
              <div style={{ padding: '8px' }}>
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>مباع لـ:</p>
                    <p style={{ fontWeight: 800 }}>{selectedSale.customer_name}</p>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>التاريخ:</p>
                    <p style={{ fontWeight: 800 }}>{new Date(selectedSale.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.9rem', opacity: 0.7 }}>الأدوية والمباعة:</h4>
                    <button onClick={toggleAllItems} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                      {selectedItemIds.length === saleItems.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </button>
                  </div>
                  
                  {saleItems.map((item: any) => {
                    const key = `${item.medicine_id}-${item.unit_price}`;
                    const isSelected = selectedItemIds.includes(key);
                    return (
                      <div key={key} onClick={() => toggleItem(key)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: isSelected ? 'rgba(13, 148, 136, 0.05)' : 'transparent', borderRadius: '12px', marginBottom: '4px', cursor: 'pointer' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${isSelected ? 'var(--primary)' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--primary)' : 'white' }}>
                          {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'white' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.medicine_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            المباع: {item.quantity} × {item.unit_price.toLocaleString()} د.ع
                          </div>
                          {isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                              <span style={{ fontSize: '0.75rem' }}>الكمية المراد إرجاعها:</span>
                              <button onClick={() => updateReturnQty(key, -1, item.quantity)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}>-</button>
                              <span style={{ fontWeight: 800 }}>{returnQuantities[key] || 1}</span>
                              <button onClick={() => updateReturnQty(key, 1, item.quantity)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}>+</button>
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, textAlign: 'left' }}>
                          <div style={{ fontSize: '0.85rem' }}>
                            {(item.unit_price * item.quantity).toLocaleString()} د.ع
                          </div>
                          {isSelected && (
                            <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '4px' }}>
                              صافي الاسترجاع: - {Math.round((item.unit_price * (selectedSale.total_amount / preDiscountTotal)) * (returnQuantities[key] || 0)).toLocaleString()} د.ع
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ marginTop: '16px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>المجموع الكلي (قبل الخصم):</span>
                      <span>{Math.round(preDiscountTotal).toLocaleString()} د.ع</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>إجمالي الخصم بالفاتورة:</span>
                      <span style={{ color: '#94a3b8' }}>- {selectedSale.discount?.toLocaleString()} د.ع</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', marginTop: '8px', color: 'var(--primary)' }}>
                      <span>المبلغ الفعلي المدفوع:</span>
                      <span>{selectedSale.total_amount.toLocaleString()} د.ع</span>
                    </div>
                    
                    {getLivePreview() > 0 && (
                      <div style={{ marginTop: '20px', padding: '12px', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48', fontWeight: 700, fontSize: '0.85rem' }}>
                          <span>مبلغ الاسترجاع المستحق:</span>
                          <span>- {Math.round(getLivePreview()).toLocaleString()} د.ع</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, marginTop: '8px', borderTop: '1px solid rgba(225,29,72,0.1)', paddingTop: '8px' }}>
                          <span>الرصيد المتبقي:</span>
                          <span>{Math.max(0, Math.round(selectedSale.total_amount - getLivePreview())).toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedSale.status !== 'returned' && (
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', height: '56px', justifyContent: 'center', background: selectedItemIds.length > 0 ? '#e11d48' : '#cbd5e1', borderRadius: '14px', fontWeight: 800 }}
                    disabled={selectedItemIds.length === 0}
                    onClick={processReturn}
                  >
                    تأكيد إرجاع العناصر المحددة ({selectedItemIds.length})
                  </button>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}
    </div>
  );
};
