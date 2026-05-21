import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, User as UserIcon, CheckCircle, Camera } from 'lucide-react';
import { getDb } from '../lib/db';
import { Medicine } from '../types';
import { CameraScanner } from './CameraScanner';

interface CartItem {
  medicine: Medicine;
  quantity: number;
  lineTotal: number; // The calculated price across multiple batches
}

interface POSProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  customerName: string;
  setCustomerName: React.Dispatch<React.SetStateAction<string>>;
}

export const POSModule = ({ cart, setCart, customerName, setCustomerName }: POSProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(15);
  const [discount, setDiscount] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [amountPaid, setAmountPaid] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const paymentMethod = (selectedCustomerId || customerName.trim()) ? 'credit' : 'cash';

  useEffect(() => {
    const fetchTax = async () => {
        const db = await getDb();
        const result = await db.select<any[]>("SELECT value FROM app_settings WHERE key = 'tax_rate'");
        if (result.length > 0) {
            setTaxRate(parseFloat(result[0].value));
        }
        const custs = await db.select<any[]>("SELECT id, name, phone FROM customers ORDER BY name ASC");
        setCustomers(custs);
    };
    fetchTax();
  }, []);


  const searchMedicines = async (query: string) => {
    if (!query) {
      setMedicines([]);
      return;
    }
    const db = await getDb();
    const result = await db.select<Medicine[]>(
      `SELECT m.*, 
       COALESCE((SELECT NULLIF(mb.selling_price, 0) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.price) as price,
       COALESCE((SELECT mb.expiry_date FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.expiry_date) as expiry_date
       FROM medicines m 
       WHERE (m.name LIKE $1 OR m.scientific_name LIKE $1 OR m.barcode LIKE $1) AND m.stock > 0 LIMIT 5`,
      [`%${query}%`]
    );
    setMedicines(result);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const rawVal = e.currentTarget.value.trim();
    if (e.key === 'Enter' && rawVal) {
      const db = await getDb();
      // Try exact barcode match first
      const result = await db.select<Medicine[]>(
        `SELECT m.*, 
         COALESCE((SELECT NULLIF(mb.selling_price, 0) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.price) as price,
         COALESCE((SELECT mb.expiry_date FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.expiry_date) as expiry_date
         FROM medicines m 
         WHERE (m.barcode = $1 OR m.name = $1 OR m.scientific_name = $1) AND m.stock > 0 LIMIT 1`,
        [rawVal]
      );
      
      if (result.length > 0) {
        addToCart(result[0]);
        setSearchQuery("");
        setMedicines([]);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMedicines(searchQuery);
    }, 150); // 150ms debounce to prevent SQLite lockups & input lag from fast barcode scanners
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const calculateLineTotal = async (medicineId: number, qty: number, basePrice: number) => {
    const db = await getDb();
    const batches = await db.select<any[]>(
      "SELECT quantity, selling_price FROM medicine_batches WHERE medicine_id = $1 AND quantity > 0 ORDER BY expiry_date ASC",
      [medicineId]
    );

    let remaining = qty;
    let total = 0;
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      total += take * (b.selling_price || basePrice);
      remaining -= take;
    }
    
    // If there's still remaining (somehow stock summary > batches qty), use base price
    if (remaining > 0) total += remaining * basePrice;
    return total;
  };

  const addToCart = async (med: Medicine) => {
    const existing = cart.find(item => item.medicine.id === med.id);
    const newQty = existing ? existing.quantity + 1 : 1;
    
    if (newQty > med.stock) return;

    const newTotal = await calculateLineTotal(med.id, newQty, med.price);

    if (existing) {
      setCart(cart.map(item => 
        item.medicine.id === med.id ? { ...item, quantity: newQty, lineTotal: newTotal } : item
      ));
    } else {
      setCart([...cart, { medicine: med, quantity: 1, lineTotal: newTotal }]);
    }
    setSearchQuery("");
  };

  const updateQuantity = async (id: number, delta: number) => {
    const item = cart.find(i => i.medicine.id === id);
    if (!item) return;

    const newQty = Math.max(1, Math.min(item.medicine.stock, item.quantity + delta));
    const newTotal = await calculateLineTotal(id, newQty, item.medicine.price);

    setCart(cart.map(i => 
      i.medicine.id === id ? { ...i, quantity: newQty, lineTotal: newTotal } : i
    ));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.medicine.id !== id));
  };

  const totalSubtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  
  const totalTaxAmount = cart.reduce((sum, item) => {
    const rate = (item.medicine.tax_rate !== null && item.medicine.tax_rate !== undefined) 
      ? item.medicine.tax_rate 
      : taxRate;
    return sum + (item.lineTotal * (rate / (100 + rate)));
  }, 0);

  const finalTotal = Math.max(0, totalSubtotal - discount);

  useEffect(() => {
    if (paymentMethod === 'cash') {
      setAmountPaid(finalTotal);
    } else if (paymentMethod === 'credit') {
      setAmountPaid(0);
    }
  }, [paymentMethod, finalTotal]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    const db = await getDb();
    
    let effectiveCustomerId = selectedCustomerId;
    
    // Auto-create customer if name provided but not selected
    if (!effectiveCustomerId && customerName.trim()) {
      const existing = customers.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
      if (existing) {
        effectiveCustomerId = existing.id;
      } else {
        const newCustRes = await db.execute(
          "INSERT INTO customers (name, phone, email, balance) VALUES ($1, $2, $3, $4)",
          [customerName.trim(), '', '', 0]
        );
        effectiveCustomerId = newCustRes.lastInsertId ?? null;
      }
    }

    // 1. Create Sale entry
    const saleResult = await db.execute(
      "INSERT INTO sales (customer_id, customer_name, total_amount, discount, tax_amount, payment_method, amount_paid, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [effectiveCustomerId, customerName || 'عميل نقدي', finalTotal, discount, totalTaxAmount, paymentMethod, amountPaid, 'completed']
    );
    const saleId = saleResult.lastInsertId ?? 0;

    // 2. Handle Customer Balance if Credit or partial payment
    if (effectiveCustomerId) {
      const debtAmount = finalTotal - amountPaid;
      if (debtAmount !== 0) {
        await db.execute("UPDATE customers SET balance = balance + $1 WHERE id = $2", [debtAmount, effectiveCustomerId]);
        await db.execute(
          "INSERT INTO customer_transactions (customer_id, type, amount, description) VALUES ($1, $2, $3, $4)",
          [effectiveCustomerId, debtAmount > 0 ? 'debt' : 'payment', Math.abs(debtAmount), `فاتورة مبيعات #${saleId}`]
        );
      }
    }

    // 3. Add Sale Items and Update Stock (FEFO with Precise Price & Cost Tracking)
    for (const item of cart) {
      let remainingToDeduct = item.quantity;
      const batches = await db.select<any[]>(
        "SELECT * FROM medicine_batches WHERE medicine_id = $1 AND quantity > 0 ORDER BY expiry_date ASC",
        [item.medicine.id]
      );

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const deductFromThisBatch = Math.min(batch.quantity, remainingToDeduct);
        
        // Record the sale item with the ACTUAL selling and purchase price of this specific batch
        await db.execute(
          "INSERT INTO sale_items (sale_id, medicine_id, quantity, unit_price, purchase_price) VALUES ($1, $2, $3, $4, $5)",
          [saleId, item.medicine.id, deductFromThisBatch, batch.selling_price || item.medicine.price, batch.purchase_price]
        );

        await db.execute("UPDATE medicine_batches SET quantity = quantity - $1 WHERE id = $2", [deductFromThisBatch, batch.id]);
        remainingToDeduct -= deductFromThisBatch;
      }
      
      await db.execute("UPDATE medicines SET stock = stock - $1 WHERE id = $2", [item.quantity, item.medicine.id]);
    }

    setIsSuccess(true);
    setCart([]);
    setCustomerName("");
    setDiscount(0);
    setSelectedCustomerId(null);
    setAmountPaid(0);
    setTimeout(() => setIsSuccess(false), 3000);
  };

  const handleCheckoutRef = useRef(handleCheckout);
  useEffect(() => {
    handleCheckoutRef.current = handleCheckout;
  }, [handleCheckout]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        handleCheckoutRef.current();
        return;
      }

      // Automatically focus search input when user types any alphanumeric/symbol character outside forms
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
      
      if (!isInput && searchInputRef.current) {
        // Alphanumeric characters, digits, common symbols (single character keys, not hotkeys)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', height: 'calc(100vh - 120px)' }}>
      {/* Left Column: Search and Product Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ marginBottom: '20px', fontWeight: 800 }}>نقطة البيع</h2>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-slate)' }} />
            <input 
              ref={searchInputRef}
              className="search-input" 
              placeholder="ابحث عن الدواء بالاسم أو الباركود..." 
              style={{ width: '100%', paddingRight: '44px', height: '56px', fontSize: '1rem', background: '#f2f4f6' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button 
              className="btn-icon" 
              onClick={() => setIsCameraOpen(true)}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'var(--primary)', color: 'white', borderRadius: '12px' }}
            >
              <Camera size={20} />
            </button>
            
            {isCameraOpen && (
              <CameraScanner 
                onScan={async (barcode) => {
                  const cleanBarcode = barcode.trim();
                  const db = await getDb();
                  const result = await db.select<Medicine[]>(
                    "SELECT * FROM medicines WHERE barcode = $1 AND stock > 0 LIMIT 1",
                    [cleanBarcode]
                  );
                  if (result.length > 0) {
                    addToCart(result[0]);
                  }
                  setIsCameraOpen(false);
                }}
                onClose={() => setIsCameraOpen(false)}
              />
            )}
            
            {medicines.length > 0 && searchQuery && (
              <div className="card" style={{ position: 'absolute', top: '64px', left: 0, right: 0, zIndex: 100, padding: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', borderRadius: '16px' }}>
                {medicines.map(med => (
                  <div key={med.id} className="card result-item" style={{ 
                    padding: '16px', 
                    cursor: 'pointer', 
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    transition: 'all 0.2s'
                  }} onClick={() => addToCart(med)}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>{med.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{med.scientific_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        صلاحية الوجبة: <span style={{ fontWeight: 700, color: '#e11d48' }}>{med.expiry_date}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{med.price.toLocaleString()} د.ع</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>المتوفر: {med.stock} قطعة</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="table-header">
            <h3 style={{ fontWeight: 800 }}>القائمة الحالية</h3>
          </div>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-slate)' }}>
              <ShoppingCart size={48} style={{ marginBottom: '16px', opacity: 0.1, margin: '0 auto' }} />
              <p style={{ fontWeight: 600 }}>السلة فارغة. ابدأ بإضافة الأدوية.</p>
            </div>
          ) : (
            <table style={{ background: 'transparent' }}>
              <thead>
                <tr>
                  <th>الدواء</th>
                  <th>السعر</th>
                  <th>الكمية</th>
                  <th>المجموع</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.medicine.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.medicine.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-slate)' }}>{item.medicine.barcode}</div>
                    </td>
                    <td>{item.medicine.price.toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button 
                          className="btn-icon" 
                          style={{ 
                            width: '36px', 
                            height: '36px', 
                            background: '#f1f5f9', 
                            borderRadius: '50%',
                            color: 'var(--text-slate)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            border: '1px solid #e2e8f0'
                          }} 
                          onClick={() => updateQuantity(item.medicine.id, -1)}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#e2e8f0';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Minus size={16} strokeWidth={3} />
                        </button>
                        
                        <span style={{ 
                          fontWeight: 900, 
                          fontSize: '1.1rem',
                          minWidth: '24px',
                          textAlign: 'center',
                          color: 'var(--text-main)',
                          fontFamily: 'monospace' // For stable width
                        }}>
                          {item.quantity}
                        </span>
                        
                        <button 
                          className="btn-icon" 
                          style={{ 
                            width: '36px', 
                            height: '36px', 
                            background: 'var(--primary)', 
                            borderRadius: '50%', 
                            color: 'white',
                            border: 'none',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }} 
                          onClick={() => updateQuantity(item.medicine.id, 1)}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.opacity = '0.9';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          <Plus size={16} strokeWidth={3} />
                        </button>
                      </div>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--primary)', textAlign: 'left' }}>
                      <div>{item.lineTotal.toLocaleString()} د.ع</div>
                      {item.quantity > 1 && (item.lineTotal / item.quantity).toFixed(0) !== item.medicine.price.toString() && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--secondary)', opacity: 0.8 }}>* سعر مختلط (وجبات متعددة)</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => removeFromCart(item.medicine.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <UserIcon size={18} /> تفاصيل العميل
          </h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select 
              className="input" 
              style={{ flex: 1, borderRadius: '12px', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={selectedCustomerId || ""}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                setSelectedCustomerId(id || null);
                const c = customers.find(cust => cust.id === id);
                if (c) setCustomerName(c.name);
              }}
            >
              <option value="">اختر مريض مسجل...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
          <input 
            className="input" 
            placeholder="اسم العميل (نقدي)..." 
            style={{ width: '100%', borderRadius: '12px', background: '#f2f4f6', border: 'none', height: '48px', marginBottom: '16px' }}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', padding: '12px', borderRadius: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: paymentMethod === 'credit' ? 'var(--secondary)' : 'var(--primary)' }}>
              {paymentMethod === 'credit' ? '📦 طريقة الدفع: آجل (Credit)' : '💵 طريقة الدفع: نقدي (Cash)'}
            </span>
          </div>

          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
             المبلغ المدفوع (د.ع)
          </h3>
          <input 
            type="number"
            className="input" 
            style={{ width: '100%', borderRadius: '12px', background: '#f2f4f6', border: 'none', height: '48px', marginBottom: '16px' }}
            value={amountPaid}
            onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
          />

          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
             خصم خاص (د.ع)
          </h3>
          <input 
            type="number"
            className="input" 
            placeholder="قيمة الخصم..." 
            style={{ width: '100%', borderRadius: '12px', background: '#f2f4f6', border: 'none', height: '48px', marginBottom: '16px' }}
            value={discount || ""}
            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
          />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            {[250, 500, 1000].map(val => (
              <button 
                key={val} 
                className="btn" 
                style={{ 
                  background: 'var(--primary)', 
                  border: '2px solid white', 
                  color: 'white', 
                  justifyContent: 'center', 
                  fontSize: '0.8125rem', 
                  fontWeight: 800, 
                  padding: '10px',
                  borderRadius: '99px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
                onClick={() => setDiscount(val)}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = 'white';
                }}
              >
                {val}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[2000, 3000, 5000].map(val => (
              <button 
                key={val} 
                className="btn" 
                style={{ 
                  background: 'var(--primary)', 
                  border: '2px solid white', 
                  color: 'white', 
                  justifyContent: 'center', 
                  fontSize: '0.8125rem', 
                  fontWeight: 800, 
                  padding: '10px',
                  borderRadius: '99px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
                onClick={() => setDiscount(val)}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = 'white';
                }}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ flex: 1, background: 'var(--primary)', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '32px', fontWeight: 800 }}>ملخص الفاتورة</h3>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ opacity: 0.8 }}>المجموع الفرعي</span>
              <span style={{ fontWeight: 600 }}>{totalSubtotal.toLocaleString('en-US')} د.ع</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ opacity: 0.8 }}>إجمالي الضريبة</span>
              <span style={{ fontWeight: 600 }}>{totalTaxAmount.toLocaleString('en-US')} د.ع</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: '#ffecb3' }}>
              <span style={{ opacity: 0.9 }}>الخصم المطبق</span>
              <span style={{ fontWeight: 700 }}>- {discount.toLocaleString('en-US')} د.ع</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '24px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>الإجمالي الكلي</span>
              <span style={{ fontWeight: 800, fontSize: '1.5rem' }}>{finalTotal.toLocaleString('en-US')} د.ع</span>
            </div>
          </div>

          <button 
            className="btn" 
            style={{ width: '100%', height: '64px', fontSize: '1.25rem', justifyContent: 'center', background: 'white', color: 'var(--primary)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}
            disabled={cart.length === 0}
            onClick={handleCheckout}
          >
            إتمام عملية البيع (F3)
          </button>

          {isSuccess && (
            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              background: 'rgba(255,255,255,0.1)', 
              color: 'white', 
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              animation: 'fadeIn 0.3s',
              fontWeight: 700
            }}>
              <CheckCircle size={20} /> تم إرسال الطلب بنجاح!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
