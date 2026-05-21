import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, ScanBarcode, Camera, ShoppingCart } from 'lucide-react';
import { getDb } from '../lib/db';
import { Medicine, Category } from '../types';
import { Modal } from './Modal';
import { CameraScanner } from './CameraScanner';

// Sub-component for the Add/Edit form to isolate state updates
const MedicineForm = ({ 
  initialData, 
  categories, 
  onSubmit, 
  onCancel 
}: { 
  initialData: any, 
  categories: Category[], 
  onSubmit: (data: any) => void, 
  onCancel: () => void 
}) => {
  const [localData, setLocalData] = useState(initialData);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: string, value: any) => {
    setLocalData((prev: any) => {
      const next = { ...prev, [field]: value };
      
      // Dynamically recalculate price whenever purchase_price or tax_rate is adjusted
      if (field === 'purchase_price' || field === 'tax_rate') {
        const purchase = parseFloat(next.purchase_price) || 0;
        const tax = parseFloat(next.tax_rate) || 0;
        
        if (purchase > 0) {
            next.price = Math.round(purchase * (1 + tax / 100));
        }
      }
      
      return next;
    });
  };

  const focusBarcode = () => {
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(localData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>اسم الدواء التجاري</label>
          <input 
            className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
            value={localData.name} onChange={e => handleChange('name', e.target.value)}
            placeholder="مثال: Panadol"
          />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>الاسم العلمي</label>
          <input 
            className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
            value={localData.scientific_name || ""} onChange={e => handleChange('scientific_name', e.target.value)}
            placeholder="مثال: Paracetamol"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>فئة الدواء</label>
          <select 
            className="input" style={{ width: '100%', height: '48px', background: '#f2f4f6', border: 'none' }} required
            value={localData.category_id} onChange={e => handleChange('category_id', parseInt(e.target.value))}
          >
            <option value="">اختر الفئة...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>الباركود (Scan)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              ref={barcodeInputRef}
              className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={localData.barcode} onChange={e => handleChange('barcode', e.target.value)}
              placeholder="0000000000"
            />
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => setIsCameraOpen(true)} 
              style={{ 
                background: '#0d9488', 
                color: 'white', 
                borderRadius: '14px', 
                width: '48px', 
                height: '48px',
                border: 'none',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Camera size={22} />
            </button>
            <button 
              type="button" 
              className="btn-icon" 
              onClick={focusBarcode} 
              style={{ 
                background: 'var(--primary)', 
                color: 'white', 
                borderRadius: '14px', 
                width: '48px', 
                height: '48px',
                border: 'none',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
            >
              <ScanBarcode size={22} />
            </button>
          </div>
        </div>

        {isCameraOpen && (
          <CameraScanner 
            onScan={(barcode) => {
              handleChange('barcode', barcode.trim());
              setIsCameraOpen(false);
            }}
            onClose={() => setIsCameraOpen(false)}
          />
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>الكمية المتوفرة</label>
          <input 
            type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
            value={localData.stock} onChange={e => handleChange('stock', parseInt(e.target.value))}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>سعر الشراء (د.ع)</label>
          <input 
            type="number" step="1" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
            value={localData.purchase_price} onChange={e => handleChange('purchase_price', parseFloat(e.target.value))}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>سعر البيع (د.ع)</label>
          <input 
            type="number" step="1" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
            value={localData.price} onChange={e => handleChange('price', parseFloat(e.target.value))}
            placeholder="0 للاحساب التلقائي"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>حد الطلب (Alert)</label>
          <input 
            type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
            value={localData.min_stock_level} onChange={e => handleChange('min_stock_level', parseInt(e.target.value))}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>ضريبة خاصة (%)</label>
          <input 
            type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
            placeholder="اترك فارغاً للافتراضي"
            value={localData.tax_rate || ""} onChange={e => handleChange('tax_rate', e.target.value === "" ? null : parseFloat(e.target.value))}
          />
        </div>

        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>تاريخ انتهاء الصلاحية</label>
          <input 
            type="date" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} required
            value={localData.expiry_date} onChange={e => handleChange('expiry_date', e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
        <button className="btn btn-primary" style={{ flex: 2, height: '56px', justifyContent: 'center', fontSize: '1.1rem' }}>
          {initialData.id ? "تحديث البيانات" : "إضافة الدواء للمخزون"}
        </button>
        <button type="button" className="btn" style={{ flex: 1, background: '#f2f4f6', height: '56px', justifyContent: 'center' }} onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </form>
  );
};

const RestockForm = ({ medicines, onSubmit, onCancel, defaultTaxRate }: { medicines: Medicine[], onSubmit: (data: any) => void, onCancel: () => void, defaultTaxRate: number }) => {
  const [data, setData] = useState({ medicine_id: 0, quantity: 0, expiry_date: "", purchase_price: 0, selling_price: 0 });
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = medicines.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.barcode?.includes(searchTerm));

  const handlePurchasePriceChange = (val: number) => {
    const med = medicines.find(m => m.id === data.medicine_id);
    const taxRate = med?.tax_rate !== null && med?.tax_rate !== undefined ? med.tax_rate : defaultTaxRate;
    const suggestedPrice = Math.round(val * (1 + taxRate / 100));
    setData({ ...data, purchase_price: val, selling_price: suggestedPrice });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>ابحث عن الدواء</label>
        <input 
          className="input" style={{ width: '100%', marginBottom: '12px', background: '#f2f4f6', border: 'none', height: '48px' }} 
          placeholder="ابحث بالاسم أو الباركود..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        />
        <select 
          className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
          value={data.medicine_id} 
          onChange={e => {
            const id = parseInt(e.target.value);
            const med = medicines.find(m => m.id === id);
            setData({ ...data, medicine_id: id, purchase_price: med?.purchase_price || 0, selling_price: med?.price || 0 });
          }}
        >
          <option value={0}>اختر الدواء من القائمة...</option>
          {filtered.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.scientific_name}) 
              — السعر الحالي: {m.price.toLocaleString()} د.ع 
              — المخزون: {m.stock}
            </option>
          ))}
        </select>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>الكمية الجديدة</label>
          <input type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} value={data.quantity} onChange={e => setData({...data, quantity: parseInt(e.target.value)})} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>سعر الشراء الجديد (د.ع)</label>
          <input type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} value={data.purchase_price} onChange={e => handlePurchasePriceChange(parseFloat(e.target.value))} />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>سعر البيع لهذه الوجبة (د.ع)</label>
        <input type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} value={data.selling_price} onChange={e => setData({...data, selling_price: parseFloat(e.target.value)})} />
        <p style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '4px' }}>* السعر أعلاه تم احتسابه آلياً بناءً على ضريبة الصنف.</p>
      </div>
      
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '0.9rem' }}>تاريخ انتهاء الوجبة الجديدة</label>
        <input type="date" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }} value={data.expiry_date} onChange={e => setData({...data, expiry_date: e.target.value})} />
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
        <button 
          className="btn btn-primary" 
          style={{ flex: 1, justifyContent: 'center', height: '48px', borderRadius: '12px' }} 
          onClick={() => onSubmit(data)}
        >
          إضافة الوجبة وتحديث المخزون
        </button>
        <button 
          className="btn" 
          style={{ height: '48px', borderRadius: '12px' }}
          onClick={onCancel}
        >
           إلغاء
        </button>
      </div>
    </div>
  );
};

export const InventoryModule = ({ initialFilter = "", initialSearch = "" }: { initialFilter?: string, initialSearch?: string }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [appTaxRate, setAppTaxRate] = useState(30);
  const [isWriteoffOpen, setIsWriteoffOpen] = useState(false);
  const [writeoffData, setWriteoffData] = useState({ medicine_id: 0, batch_id: 0, quantity: 0, reason: "Expired" });
  const [batches, setBatches] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState(initialFilter);

  const fetchInventory = async () => {
    const db = await getDb();
    
    // Fetch settings
    const settings = await db.select<any[]>("SELECT value FROM app_settings WHERE key = 'tax_rate'");
    if (settings.length > 0) setAppTaxRate(parseFloat(settings[0].value));

    const result = await db.select<Medicine[]>(`
      SELECT m.*, c.name as category_name 
      FROM medicines m 
      LEFT JOIN categories c ON m.category_id = c.id
      ORDER BY m.created_at DESC
    `);
    setMedicines(result);
    
    const cats = await db.select<Category[]>("SELECT * FROM categories");
    setCategories(cats);
  };

  const fetchBatches = async (medId: number) => {
    const db = await getDb();
    const result = await db.select<any[]>("SELECT * FROM medicine_batches WHERE medicine_id = $1 AND quantity > 0", [medId]);
    setBatches(result);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    setActiveFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  const handleFormSubmit = async (formData: any) => {
    const db = await getDb();
    if (editingMedicine) {
      await db.execute(
        "UPDATE medicines SET name = $1, category_id = $2, stock = $3, price = $4, barcode = $5, expiry_date = $6, description = $7, tax_rate = $8, scientific_name = $9, min_stock_level = $10, purchase_price = $11 WHERE id = $12",
        [formData.name, formData.category_id, formData.stock, formData.price, formData.barcode, formData.expiry_date, formData.description, formData.tax_rate, formData.scientific_name, formData.min_stock_level, formData.purchase_price, editingMedicine.id]
      );
      // Optional: Update the oldest active batch if it's a simple edit? 
      // For now, simple editing updates the summary.
    } else {
      const result = await db.execute(
        "INSERT INTO medicines (name, category_id, stock, price, barcode, expiry_date, description, tax_rate, scientific_name, min_stock_level, purchase_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        [formData.name, formData.category_id, formData.stock, formData.price, formData.barcode, formData.expiry_date, formData.description, formData.tax_rate, formData.scientific_name, formData.min_stock_level, formData.purchase_price]
      );
      const medicineId = result.lastInsertId;
      
      // Create initial batch with full pricing data
      if (formData.stock > 0) {
        await db.execute(
          "INSERT INTO medicine_batches (medicine_id, quantity, expiry_date, purchase_price, selling_price) VALUES ($1, $2, $3, $4, $5)",
          [medicineId, formData.stock, formData.expiry_date, formData.purchase_price, formData.price]
        );
      }
    }
    setIsModalOpen(false);
    setEditingMedicine(null);
    fetchInventory();
  };

  const filteredMedicines = medicines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.scientific_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'expired') {
      const expiry = new Date(m.expiry_date);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return matchesSearch && expiry < thirtyDaysFromNow;
    }
    
    if (activeFilter === 'low_stock') {
      return matchesSearch && m.stock <= (m.min_stock_level || 5);
    }

    return matchesSearch;
  });

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>المخزون</h2>
          <p style={{ color: 'var(--text-muted)' }}>إدارة الأدوية والمستلزمات الطبية</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginRight: '12px' }}>
            <button 
              className={`btn ${activeFilter === '' ? 'btn-primary' : ''}`} 
              style={{ background: activeFilter === '' ? 'var(--primary)' : 'transparent', color: activeFilter === '' ? 'white' : 'var(--text-slate)', padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setActiveFilter('')}
            >الكل</button>
            <button 
              className={`btn ${activeFilter === 'low_stock' ? 'btn-primary' : ''}`} 
              style={{ background: activeFilter === 'low_stock' ? 'var(--primary)' : 'transparent', color: activeFilter === 'low_stock' ? 'white' : 'var(--text-slate)', padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setActiveFilter('low_stock')}
            >النواقص</button>
            <button 
              className={`btn ${activeFilter === 'expired' ? 'btn-primary' : ''}`} 
              style={{ background: activeFilter === 'expired' ? 'var(--primary)' : 'transparent', color: activeFilter === 'expired' ? 'white' : 'var(--text-slate)', padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setActiveFilter('expired')}
            >منتهية الصلاحية</button>
          </div>
          <button className="btn" style={{ background: 'var(--secondary)', color: 'white' }} onClick={() => setIsRestockOpen(true)}>
            <ShoppingCart size={20} /> إضافة وجبة لشحنة موجودة
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingMedicine(null); setIsModalOpen(true); }}>
            <Plus size={20} /> إضافة دواء جديد
          </button>
        </div>
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
            placeholder="ابحث عن دواء، رمز باركود، أو فئة معينة..." 
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>اسم الدواء</th>
              <th>الفئة</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>تاريخ الانتهاء</th>
              <th>الحالة</th>
              <th style={{ textAlign: 'center' }}>خيارات</th>
            </tr>
          </thead>
          <tbody>
            {filteredMedicines.map(med => (
              <tr key={med.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{med.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 500 }}>{med.scientific_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{med.barcode}</div>
                </td>
                <td>{med.category_name}</td>
                <td style={{ fontWeight: 600 }}>{med.stock}</td>
                <td>{med.price.toLocaleString('en-US')} د.ع</td>
                <td>{med.expiry_date}</td>
                <td>
                  <span className={`badge ${med.stock > (med.min_stock_level || 5) ? 'badge-primary' : med.stock > 0 ? 'badge-secondary' : 'badge-error'}`}>
                    <span className="badge-dot" style={{ background: med.stock > (med.min_stock_level || 5) ? 'var(--primary)' : med.stock > 0 ? 'var(--secondary)' : 'var(--error)' }}></span>
                    {med.stock > (med.min_stock_level || 5) ? 'متوفر' : med.stock > 0 ? 'منخفض' : 'ناقص'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button 
                      className="btn-icon" 
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        borderRadius: '50%',
                        background: '#f8fafc',
                        color: 'var(--secondary)',
                        border: '1px solid #e2e8f0',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }} 
                      onClick={() => { setEditingMedicine(med); setIsModalOpen(true); }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'var(--secondary)';
                        e.currentTarget.style.color = 'white';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(48, 94, 163, 0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.color = 'var(--secondary)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <Edit2 size={16} strokeWidth={2.5} />
                    </button>
                    <button 
                      className="btn-icon" 
                      title="إتلاف / استبعاد"
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        borderRadius: '50%',
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fcd34d',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }} 
                      onClick={() => { 
                        setWriteoffData({ medicine_id: med.id, batch_id: 0, quantity: 0, reason: "Expired" });
                        fetchBatches(med.id);
                        setIsWriteoffOpen(true);
                      }}
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

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingMedicine ? "تعديل تفاصيل الدواء" : "إضافة دواء جديد للمخزون"}
      >
        <MedicineForm 
          initialData={editingMedicine || { name: "", scientific_name: "", category_id: 0, stock: 0, price: 0, purchase_price: 0, min_stock_level: 5, barcode: "", description: "", tax_rate: null }}
          categories={categories}
          onSubmit={handleFormSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal 
        isOpen={isRestockOpen} 
        onClose={() => setIsRestockOpen(false)} 
        title="إضافة وجبة (Batch) جديدة لدواء موجود"
      >
        <RestockForm 
          medicines={medicines}
          defaultTaxRate={appTaxRate}
          onCancel={() => setIsRestockOpen(false)}
          onSubmit={async (data) => {
            if (data.medicine_id === 0 || data.quantity <= 0 || !data.expiry_date) {
              alert("يرجى إكمال كافة البيانات بشكل صحيح");
              return;
            }
            const db = await getDb();
            // 1. Add batch
            await db.execute(
              "INSERT INTO medicine_batches (medicine_id, quantity, expiry_date, purchase_price, selling_price) VALUES ($1, $2, $3, $4, $5)",
              [data.medicine_id, data.quantity, data.expiry_date, data.purchase_price, data.selling_price]
            );
            // 2. Update summary stock and GLOBAL price for fallback
            await db.execute(
              "UPDATE medicines SET stock = stock + $1, price = $2, purchase_price = $3 WHERE id = $4", 
              [data.quantity, data.selling_price, data.purchase_price, data.medicine_id]
            );
            
            setIsRestockOpen(false);
            fetchInventory();
            alert("تمت إضافة الوجبة الجديدة وتحديث المخزون.");
          }}
        />
      </Modal>

      <Modal 
        isOpen={isWriteoffOpen} 
        onClose={() => setIsWriteoffOpen(false)} 
        title="إتلاف / استبعاد أدوية من المخزون"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>اختر الوجبة (Batch)</label>
            <select 
              className="input" style={{ width: '100%', height: '48px', background: '#f2f4f6', border: 'none' }}
              value={writeoffData.batch_id} onChange={e => setWriteoffData({...writeoffData, batch_id: parseInt(e.target.value)})}
            >
              <option value={0}>اختر الوجبة المراد إنقاصها...</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>وجبة تنتهي في: {b.expiry_date} (متوفر {b.quantity})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>الكمية المستبعدة</label>
            <input 
              type="number" className="input" style={{ width: '100%', background: '#f2f4f6', border: 'none', height: '48px' }}
              value={writeoffData.quantity} onChange={e => setWriteoffData({...writeoffData, quantity: parseInt(e.target.value) || 0})}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>السبب</label>
            <select 
              className="input" style={{ width: '100%', height: '48px', background: '#f2f4f6', border: 'none' }}
              value={writeoffData.reason} onChange={e => setWriteoffData({...writeoffData, reason: e.target.value})}
            >
              <option value="Expired">منتهية الصلاحية</option>
              <option value="Damaged">تالفة / مكسورة</option>
              <option value="Lost">مفقودة</option>
              <option value="Other">أخرى</option>
            </select>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ height: '56px', justifyContent: 'center', background: 'var(--error)' }}
            onClick={async () => {
              if (writeoffData.batch_id === 0 || writeoffData.quantity <= 0) {
                alert("يرجى إكمال البيانات"); return;
              }
              const db = await getDb();
              // 1. Record write-off
              await db.execute(
                "INSERT INTO medicine_writeoffs (medicine_id, batch_id, quantity, reason) VALUES ($1, $2, $3, $4)",
                [writeoffData.medicine_id, writeoffData.batch_id, writeoffData.quantity, writeoffData.reason]
              );
              // 2. Update batch stock
              await db.execute("UPDATE medicine_batches SET quantity = quantity - $1 WHERE id = $2", [writeoffData.quantity, writeoffData.batch_id]);
              // 3. Update medicine total stock
              await db.execute("UPDATE medicines SET stock = stock - $1 WHERE id = $2", [writeoffData.quantity, writeoffData.medicine_id]);
              
              setIsWriteoffOpen(false);
              fetchInventory();
              alert("تم تسجيل الإتلاف وتحديث المخزون");
            }}
          >
            تأكيد الاستبعاد من المخزون
          </button>
        </div>
      </Modal>
    </div>
  );
};
