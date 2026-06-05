import { useState, useEffect, useRef, Fragment } from 'react';
import { triggerToast } from '../lib/toast';
import { Plus, Edit2, Trash2, Search, ScanBarcode, Camera, ShoppingCart, Sparkles, Upload, Brain, Check, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getDb } from '../lib/db';
import { geminiKeyManager } from '../lib/geminiKeyManager';
import { Medicine, Category } from '../types';
import { Modal } from './Modal';
import { CameraScanner } from './CameraScanner';

// Helper functions for cleaning and parsing Arabic/Indic and Western numbers
const convertArabicNumerals = (val: any): string => {
  if (val === null || val === undefined) return "";
  let str = val.toString();
  // Arabic-Indic digits (U+0660 to U+0669)
  str = str.replace(/[\u0660-\u0669]/g, (d: string) => (d.charCodeAt(0) - 1632).toString());
  // Eastern Arabic/Persian/Urdu digits (U+06F0 to U+06F9)
  str = str.replace(/[\u06F0-\u06F9]/g, (d: string) => (d.charCodeAt(0) - 1776).toString());
  return str;
};

const parseCleanNumber = (val: any): number => {
  const cleaned = convertArabicNumerals(val).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
};

const parseCleanInt = (val: any): number => {
  const cleaned = convertArabicNumerals(val).replace(/[^0-9]/g, '');
  return parseInt(cleaned) || 0;
};

// Sub-component for the Add/Edit form to isolate state updates
const MedicineForm = ({ 
  initialData, 
  categories, 
  onSubmit, 
  onCancel,
  defaultTaxRate
}: { 
  initialData: any, 
  categories: Category[], 
  onSubmit: (data: any) => void, 
  onCancel: () => void,
  defaultTaxRate: number
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
        
        // Use default tax rate from settings if no specific tax_rate is set
        const tax = (next.tax_rate !== null && next.tax_rate !== undefined && next.tax_rate !== '') 
          ? parseFloat(next.tax_rate) 
          : defaultTaxRate;
        
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
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Prevent premature form submission from barcode scanners
                  handleChange('barcode', e.currentTarget.value.trim());
                }
              }}
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

export const InventoryModule = ({ initialFilter = "", initialSearch = "", currentUser }: { initialFilter?: string, initialSearch?: string, currentUser?: any }) => {
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

  // AI Ingestion States
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAIScanning, setIsAIScanning] = useState(false);
  const [aiError, setAiError] = useState("");
  const [scannedImages, setScannedImages] = useState<{ id: string; name: string; dataUrl: string }[]>([]);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // State for Fetch Scientific Names feature
  const [isFetchSciOpen, setIsFetchSciOpen] = useState(false);
  const [sciMeds, setSciMeds] = useState<{ id: number; name: string; description: string; scientific_name: string; status: 'idle' | 'loading' | 'success' | 'failed' }[]>([]);
  const [isFetchingSci, setIsFetchingSci] = useState(false);
  const [sciProgress, setSciProgress] = useState(0);
  const shouldStopRef = useRef(false);

  // Expandable Row States
  const [expandedMedId, setExpandedMedId] = useState<number | null>(null);
  const [medicineBatches, setMedicineBatches] = useState<Record<number, any[]>>({});
  const [loadingBatches, setLoadingBatches] = useState<number | null>(null);

  const toggleExpand = async (medId: number) => {
    if (expandedMedId === medId) {
      setExpandedMedId(null);
    } else {
      setExpandedMedId(medId);
      setLoadingBatches(medId);
      try {
        const db = await getDb();
        const result = await db.select<any[]>(
          "SELECT * FROM medicine_batches WHERE medicine_id = $1 ORDER BY expiry_date ASC",
          [medId]
        );
        setMedicineBatches(prev => ({ ...prev, [medId]: result }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBatches(null);
      }
    }
  };

  const fetchInventory = async () => {
    const db = await getDb();
    
    // Fetch settings
    const settings = await db.select<any[]>("SELECT value FROM app_settings WHERE key = 'tax_rate'");
    if (settings.length > 0) setAppTaxRate(parseFloat(settings[0].value));

    // Load key manager pool
    await geminiKeyManager.load();

    const result = await db.select<Medicine[]>(`
      SELECT m.*, c.name as category_name 
      FROM medicines m 
      LEFT JOIN categories c ON m.category_id = c.id
      ORDER BY m.created_at DESC
    `);
    setMedicines(result);
    
    const cats = await db.select<Category[]>("SELECT * FROM categories");
    setCategories(cats);

    // Refresh expanded batch details if one is expanded
    if (expandedMedId) {
      const bRes = await db.select<any[]>(
        "SELECT * FROM medicine_batches WHERE medicine_id = $1 ORDER BY expiry_date ASC",
        [expandedMedId]
      );
      setMedicineBatches(prev => ({ ...prev, [expandedMedId]: bRes }));
    }
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

  const fetchScientificName = async (tradeName: string, description: string): Promise<string> => {
    if (!geminiKeyManager.hasKeys()) return "";
    if (shouldStopRef.current) return "";
    try {
      const prompt = `You are a clinical pharmacist. Given this medicine brand name (Trade Name): "${tradeName}" and its description/context: "${description || ""}".
Determine its primary active pharmaceutical ingredient (Scientific Name in English).
Respond ONLY in a JSON object with the following schema:
{
  "scientific_name": "the scientific name of the drug, in English, e.g., 'Paracetamol', 'Amoxicillin', 'Tetracycline'"
}
Do not include any markdown format tags like \`\`\`json. Output raw JSON.`;

      const response = await geminiKeyManager.fetchWithRotation(
        (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      if (response.ok) {
        const resJson = await response.json();
        let text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
        text = text.trim();
        if (text.startsWith("```json")) {
          text = text.replace(/^```json/, "").replace(/```$/, "").trim();
        } else if (text.startsWith("```")) {
          text = text.replace(/^```/, "").replace(/```$/, "").trim();
        }
        const result = JSON.parse(text);
        return result.scientific_name || "";
      }

      console.error("Gemini API error for", tradeName, response.status);
    } catch (e) {
      console.error("Error fetching scientific name:", e);
    }
    return "";
  };

  const openFetchScientificModal = async () => {
    try {
      shouldStopRef.current = false;
      const db = await getDb();
      const result = await db.select<any[]>(
        "SELECT id, name, description FROM medicines WHERE scientific_name IS NULL OR scientific_name = ''"
      );
      if (result.length === 0) {
        showToast("جميع الأدوية في المخزن تحتوي على اسم علمي مسجل بالفعل!", "success");
        return;
      }
      setSciMeds(result.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description || "",
        scientific_name: "",
        status: 'idle'
      })));
      setSciProgress(0);
      setIsFetchSciOpen(true);
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ أثناء جلب الأدوية من قاعدة البيانات", "error");
    }
  };

  const startFetchingScientificNames = async () => {
    if (!geminiKeyManager.hasKeys()) {
      triggerToast("يرجى إضافة مفتاح Gemini API أولاً في صفحة الإعدادات لتتمكن من استخدام الذكاء الاصطناعي.", "warning");
      return;
    }
    setIsFetchingSci(true);
    shouldStopRef.current = false;
    const updated = [...sciMeds];
    
    for (let i = 0; i < updated.length; i++) {
      if (shouldStopRef.current) {
        break;
      }

      if (updated[i].status === 'success') {
        continue;
      }

      updated[i].status = 'loading';
      setSciMeds([...updated]);
      
      const sciName = await fetchScientificName(updated[i].name, updated[i].description);
      
      if (shouldStopRef.current) {
        updated[i].status = 'idle';
        setSciMeds([...updated]);
        break;
      }

      if (sciName) {
        updated[i].scientific_name = sciName;
        updated[i].status = 'success';
      } else {
        updated[i].status = 'failed';
      }
      setSciProgress(Math.round(((i + 1) / updated.length) * 100));
      setSciMeds([...updated]);
      
      // Delay to avoid hitting rate limits
      await new Promise(r => setTimeout(r, 1000));
    }
    setIsFetchingSci(false);
  };

  const saveScientificNames = async () => {
    try {
      const db = await getDb();
      let count = 0;
      for (const m of sciMeds) {
        if (m.scientific_name && m.scientific_name.trim()) {
          await db.execute(
            "UPDATE medicines SET scientific_name = $1 WHERE id = $2",
            [m.scientific_name.trim(), m.id]
          );
          count++;
        }
      }
      showToast(`تم حفظ الاسم العلمي لـ ${count} دواء بنجاح!`, "success");
      setIsFetchSciOpen(false);
      fetchInventory();
    } catch (e) {
      console.error(e);
      showToast("فشل في حفظ الأسماء العلمية في قاعدة البيانات", "error");
    }
  };

  // AI Ingestion Helper Functions
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification(null);
    }, 4000);
  };

  const sanitizeBarcode = (val: any): string | null => {
    if (!val) return null;
    const str = val.toString().trim();
    if (!str) return null;
    
    const lower = str.toLowerCase();
    if (
      lower === "null" ||
      lower === "none" ||
      lower === "n/a" ||
      lower === "na" ||
      lower === "nil" ||
      lower === "-" ||
      lower === "undefined"
    ) {
      return null;
    }
    return str;
  };


  const readFilesAsDataURLs = async (files: FileList): Promise<{ id: string; name: string; dataUrl: string }[]> => {
    const promises = Array.from(files).map(file => {
      return new Promise<{ id: string; name: string; dataUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            name: file.name,
            dataUrl: reader.result as string
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const newImages = await readFilesAsDataURLs(e.target.files);
        setScannedImages(prev => [...prev, ...newImages]);
      } catch (err) {
        console.error("Error reading files:", err);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        const newImages = await readFilesAsDataURLs(e.dataTransfer.files);
        setScannedImages(prev => [...prev, ...newImages]);
      } catch (err) {
        console.error("Error reading dropped files:", err);
      }
    }
  };

  const startAIScan = async () => {
    if (scannedImages.length === 0) {
      setAiError("يرجى اختيار أو سحب صورة واحدة على الأقل");
      return;
    }
    if (!geminiKeyManager.hasKeys()) {
      setAiError("يرجى إضافة مفتاح Gemini API في صفحة الإعدادات أولاً.");
      return;
    }

    setIsAIScanning(true);
    setAiError("");
    setExtractedItems([]);

    try {
      const parts: any[] = [
        {
          text: `Analyze these pharmacy invoice/medicine list images. Extract all medicines across all these images into a single structured JSON array, merging items if appropriate.
Rules:
1. 'name': MUST be the English medicine brand name ONLY (e.g. "Panadol Extra", "Amoxil 500mg"). Do NOT translate to Arabic. Get it from the item name column.
2. 'barcode': Barcode/UPC/EAN string if visible in the image or list (e.g. "6223002640123"). If no barcode is visible or present, return "".
3. 'quantity': Quantity or count (العدد) of items.
4. 'total_price': The total price (السعر الإجمالي للكمية كاملة) for this line item in the invoice. Return as a plain number. If only unit price is given, calculate total price as purchase_price * quantity.
5. 'purchase_price': Purchase price (سعر الشراء للقطعة الواحدة) for a SINGLE item from the price column. If only total price is given, divide it by quantity to get single piece cost. Return as a plain number.
6. 'expiry_date': Expiry date. Try to format as YYYY-MM-DD. If only MM/YYYY is present, format as YYYY-MM-01.

Return JSON in this format:
{
  "items": [
    {
      "name": "Panadol Extra",
      "barcode": "6223002640123",
      "quantity": 10,
      "total_price": 12000,
      "purchase_price": 1200,
      "expiry_date": "2027-05-01"
    }
  ]
}`
        }
      ];

      // Append each scanned image to the parts array
      for (const img of scannedImages) {
        const base64Data = img.dataUrl.split(',')[1];
        const mimeType = img.dataUrl.split(';')[0].split(':')[1];
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }

      const model = "gemini-2.5-flash";
      const response = await geminiKeyManager.fetchWithRotation(
        (key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  items: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        barcode: { type: "STRING" },
                        quantity: { type: "INTEGER" },
                        total_price: { type: "NUMBER" },
                        purchase_price: { type: "NUMBER" },
                        expiry_date: { type: "STRING" }
                      },
                      required: ["name", "barcode", "quantity", "total_price", "purchase_price", "expiry_date"]
                    }
                  }
                },
                required: ["items"]
              }
            }
          })
        }
      );

      if (!response || !response.ok) {
        throw new Error("فشل الاتصال بخوادم الذكاء الاصطناعي. يرجى التحقق من مفاتيح Gemini API في الإعدادات.");
      }

      const resJson = await response.json();
      const contentText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!contentText) {
        throw new Error("لم يتم استرجاع أي استجابة من الذكاء الاصطناعي");
      }

      const parsed = JSON.parse(contentText);
      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error("تنسيق الاستجابة غير صحيح");
      }

      const generalCat = categories.find(c => c.name.toLowerCase() === 'general' || c.name === 'جيرال');
      const defaultCatId = generalCat ? generalCat.id : (categories.length > 0 ? categories[0].id : 0);
      
      const mappedItems = parsed.items.map((item: any, index: number) => {
        const qty = parseCleanInt(item.quantity);
        const purchasePrice = parseCleanNumber(item.purchase_price);
        const totalPrice = parseCleanNumber(item.total_price) || (purchasePrice * qty);
        const finalPurchasePrice = purchasePrice || (qty > 0 ? totalPrice / qty : 0);

        return {
          tempId: index,
          name: item.name || "",
          barcode: item.barcode || "",
          quantity: qty,
          purchase_price: Math.round(finalPurchasePrice),
          total_price: Math.round(totalPrice),
          expiry_date: item.expiry_date || "",
          category_id: defaultCatId
        };
      });

      setExtractedItems(mappedItems);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setAiError(errMsg || "فشل تحليل الصورة. يرجى التحقق من مفتاح API أو جودة الصورة.");
    } finally {
      setIsAIScanning(false);
    }
  };

  const handleBulkSave = async () => {
    if (extractedItems.length === 0) return;
    const db = await getDb();

    try {
      for (const item of extractedItems) {
        const nameVal = item.name ? item.name.toString().trim() : "";
        const quantityCleaned = item.quantity ? item.quantity.toString().replace(/[^0-9]/g, '') : '';
        const quantityVal = parseInt(quantityCleaned) || 0;
        const purchasePriceCleaned = item.purchase_price ? item.purchase_price.toString().replace(/[^0-9.]/g, '') : '';
        const purchasePriceVal = parseFloat(purchasePriceCleaned) || 0;
        const expiryDateVal = item.expiry_date ? item.expiry_date.toString().trim() : "";
        const barcodeVal = sanitizeBarcode(item.barcode);

        if (!nameVal || quantityVal <= 0 || !expiryDateVal) {
          continue;
        }

        // Highly robust lookup logic to prevent UNIQUE constraint failures on barcode:
        // 1. Look up by barcode first if it exists
        // 2. Fall back to name matching
        let existingMed: any = null;
        if (barcodeVal) {
          const byBarcode = await db.select<any[]>("SELECT * FROM medicines WHERE barcode = $1", [barcodeVal]);
          if (byBarcode.length > 0) {
            existingMed = byBarcode[0];
          }
        }
        if (!existingMed) {
          const byName = await db.select<any[]>("SELECT * FROM medicines WHERE LOWER(name) = $1", [nameVal.toLowerCase()]);
          if (byName.length > 0) {
            existingMed = byName[0];
          }
        }

        const taxRate = existingMed && existingMed.tax_rate !== null ? existingMed.tax_rate : appTaxRate;
        const sellingPrice = Math.round(purchasePriceVal * (1 + taxRate / 100));

        if (existingMed) {
          const medId = existingMed.id;
          const existingBarcode = existingMed.barcode;
          const existingBarcodeStr = existingBarcode ? String(existingBarcode).trim() : "";
          
          await db.execute(
            "INSERT INTO medicine_batches (medicine_id, quantity, expiry_date, purchase_price, selling_price) VALUES ($1, $2, $3, $4, $5)",
            [medId, quantityVal, expiryDateVal, purchasePriceVal, sellingPrice]
          );

          if (!existingMed.scientific_name || !existingMed.scientific_name.trim()) {
            const sciName = await fetchScientificName(nameVal, existingMed.description || "");
            if (sciName) {
              await db.execute(
                "UPDATE medicines SET scientific_name = $1 WHERE id = $2",
                [sciName, medId]
              );
            }
          }

          if (!existingBarcodeStr && barcodeVal) {
            await db.execute(
              "UPDATE medicines SET stock = stock + $1, purchase_price = $2, price = $3, barcode = $5 WHERE id = $4",
              [quantityVal, purchasePriceVal, sellingPrice, medId, barcodeVal]
            );
          } else {
            await db.execute(
              "UPDATE medicines SET stock = stock + $1, purchase_price = $2, price = $3 WHERE id = $4",
              [quantityVal, purchasePriceVal, sellingPrice, medId]
            );
          }
        } else {
          const sciName = await fetchScientificName(nameVal, "");
          const result = await db.execute(
            "INSERT INTO medicines (name, category_id, stock, price, expiry_date, purchase_price, min_stock_level, barcode, scientific_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [nameVal, item.category_id, quantityVal, sellingPrice, expiryDateVal, purchasePriceVal, 5, barcodeVal, sciName]
          );
          
          const newMedId = result.lastInsertId;

          await db.execute(
            "INSERT INTO medicine_batches (medicine_id, quantity, expiry_date, purchase_price, selling_price) VALUES ($1, $2, $3, $4, $5)",
            [newMedId, quantityVal, expiryDateVal, purchasePriceVal, sellingPrice]
          );
        }
      }

      setIsAIModalOpen(false);
      setExtractedItems([]);
      setScannedImages([]);
      showToast("تمت إضافة قائمة الأدوية بنجاح إلى المخزون!", "success");
      fetchInventory();
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      showToast("حدث خطأ أثناء حفظ الأدوية في قاعدة البيانات: " + errMsg, "error");
    }
  };

  const addBlankExtractedItem = () => {
    const generalCat = categories.find(c => c.name.toLowerCase() === 'general' || c.name === 'جيرال');
    const defaultCatId = generalCat ? generalCat.id : (categories.length > 0 ? categories[0].id : 0);
    setExtractedItems(prev => [
      ...prev,
      {
        tempId: Date.now(),
        name: "",
        barcode: "",
        quantity: 1,
        purchase_price: 0,
        total_price: 0,
        expiry_date: new Date().toISOString().split('T')[0],
        category_id: defaultCatId
      }
    ]);
  };

  const deleteExtractedItem = (tempId: number) => {
    setExtractedItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const renderAIModalContent = () => {
    // 1. API Key Setup Screen
    if (!geminiKeyManager.hasKeys()) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#eff6ff', padding: '16px', borderRadius: '16px', color: '#1e40af', border: '1px solid #bfdbfe' }}>
            <Brain size={24} />
            <div>
              <h4 style={{ margin: 0, fontWeight: 700 }}>مفاتيح Gemini API غير مضافة</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>توجه إلى <strong>الإعدادات ← إعدادات الذكاء الاصطناعي</strong> وأضف مفتاح API واحداً أو أكثر لتفعيل هذه الميزة. يمكنك إضافة حتى 10 مفاتيح للتبديل التلقائي.</p>
            </div>
          </div>
        </div>
      );
    }

    // 2. Scanning / Loading Screen
    if (isAIScanning) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '24px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '4px solid #eff6ff',
              borderTopColor: '#3b82f6',
              animation: 'spin 1s linear infinite'
            }} />
            <Brain size={32} style={{ position: 'absolute', color: '#3b82f6', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } }
          `}</style>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 700 }}>جاري قراءة وتحليل القائمة بالذكاء الاصطناعي...</h3>
            <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              نقوم باستخراج أسماء الأدوية باللغة الإنجليزية، الكميات، وأسعار الشراء، وتواريخ الانتهاء من صورتك. يرجى الانتظار...
            </p>
          </div>
        </div>
      );
    }

    // 3. Interactive Review Grid Screen
    if (extractedItems.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: '#3b82f6' }} /> مراجعة البيانات المستخرجة
              </h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                يرجى مراجعة وتعديل البيانات المستخرجة من الصورة قبل حفظها في المخزون.
              </p>
            </div>
            <button 
              className="btn" 
              style={{ background: '#f1f5f9', color: 'var(--text-slate)', fontSize: '0.85rem', padding: '8px 16px', borderRadius: '10px' }} 
              onClick={addBlankExtractedItem}
            >
              + إضافة صف جديد
            </button>
          </div>

          {aiError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: '12px', color: '#991b1b', fontSize: '0.85rem' }}>
              <AlertTriangle size={18} />
              <span>{aiError}</span>
            </div>
          )}

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '130px' }}>الباركود</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>اسم الدواء (إنجليزي)</th>
                  <th style={{ padding: '12px 6px', textAlign: 'center', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '60px' }}>الكمية</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '95px' }}>السعر الإجمالي (د.ع)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '95px' }}>سعر الشراء للقطعة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '140px' }}>تاريخ الصلاحية</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '130px' }}>سعر البيع المقدر</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '60px' }}>حذف</th>
                </tr>
              </thead>
              <tbody>
                {extractedItems.map((item, idx) => {
                  const rate = appTaxRate;
                  const purchasePriceNum = parseCleanNumber(item.purchase_price);
                  const estimatedSalePrice = Math.round(purchasePriceNum * (1 + rate / 100));

                  return (
                    <tr key={item.tempId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input 
                          className="input" 
                          style={{ width: '100%', height: '38px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }}
                          value={item.barcode || ""}
                          onChange={e => {
                            const updated = [...extractedItems];
                            updated[idx].barcode = e.target.value;
                            setExtractedItems(updated);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault(); // Prevent form/page level triggers
                              const trimmed = e.currentTarget.value.trim();
                              const updated = [...extractedItems];
                              updated[idx].barcode = trimmed;
                              setExtractedItems(updated);
                              
                              // Slick UX: Automatically focus the "Brand Name" input in the same row
                              const row = e.currentTarget.closest('tr');
                              const nameInput = row?.querySelector('input[placeholder="Brand Name"]') as HTMLInputElement;
                              if (nameInput) nameInput.focus();
                            }
                          }}
                          placeholder="الباركود (اختياري)"
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input 
                          className="input" 
                          style={{ width: '100%', height: '38px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }}
                          value={item.name}
                          required
                          onChange={e => {
                            const updated = [...extractedItems];
                            updated[idx].name = e.target.value;
                            setExtractedItems(updated);
                          }}
                          placeholder="Brand Name"
                        />
                      </td>

                      <td style={{ padding: '8px 6px' }}>
                        <input 
                          type="text"
                          className="input"
                          style={{ width: '100%', height: '38px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center' }}
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={e => {
                            const valStr = e.target.value;
                            const qty = parseCleanInt(valStr);
                            
                            const updated = [...extractedItems];
                            updated[idx].quantity = valStr;
                            
                            // Re-calculate unit purchase price or total price based on what's available
                            const tp = parseCleanNumber(item.total_price);
                            const pp = parseCleanNumber(item.purchase_price);
                            
                            if (qty > 0) {
                              if (tp > 0) {
                                updated[idx].purchase_price = Math.round(tp / qty);
                              } else if (pp > 0) {
                                updated[idx].total_price = Math.round(pp * qty);
                              }
                            }
                            setExtractedItems(updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input 
                          type="text"
                          className="input"
                          style={{ width: '100%', height: '38px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}
                          value={item.total_price === 0 ? "" : item.total_price}
                          onChange={e => {
                            const valStr = e.target.value;
                            const tp = parseCleanNumber(valStr);
                            
                            const updated = [...extractedItems];
                            updated[idx].total_price = valStr;
                            
                            // Re-calculate unit purchase price
                            const qty = parseCleanInt(item.quantity);
                            if (qty > 0) {
                              updated[idx].purchase_price = Math.round(tp / qty);
                            }
                            setExtractedItems(updated);
                          }}
                          placeholder="الإجمالي"
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input 
                          type="text"
                          className="input"
                          style={{ width: '100%', height: '38px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}
                          value={item.purchase_price === 0 ? "" : item.purchase_price}
                          onChange={e => {
                            const valStr = e.target.value;
                            const pp = parseCleanNumber(valStr);
                            
                            const updated = [...extractedItems];
                            updated[idx].purchase_price = valStr;
                            
                            // Re-calculate total price
                            const qty = parseCleanInt(item.quantity);
                            updated[idx].total_price = Math.round(pp * qty);
                            setExtractedItems(updated);
                          }}
                          placeholder="سعر القطعة"
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input 
                          type="date"
                          className="input"
                          style={{ width: '100%', height: '38px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem' }}
                          value={item.expiry_date}
                          onChange={e => {
                            const updated = [...extractedItems];
                            updated[idx].expiry_date = e.target.value;
                            setExtractedItems(updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
                        {estimatedSalePrice.toLocaleString()} د.ع
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button 
                          className="btn-icon" 
                          style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => deleteExtractedItem(item.tempId)}
                        >
                          <X size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <button 
              className="btn btn-primary" 
              style={{ flex: 2, height: '48px', justifyContent: 'center', borderRadius: '12px', fontSize: '0.95rem' }}
              onClick={handleBulkSave}
            >
              <Check size={18} /> تأكيد وإدخال للمخزون ({extractedItems.length} أدوية)
            </button>
            <button 
              className="btn" 
              style={{ flex: 1, height: '48px', justifyContent: 'center', background: '#f1f5f9', borderRadius: '12px', color: 'var(--text-slate)' }}
              onClick={() => {
                setExtractedItems([]);
                setScannedImages([]);
              }}
            >
              إعادة الرفع
            </button>
          </div>
        </div>
      );
    }

    // 4. File Dropzone / Ingestion Setup Screen
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            قم برفع صورة لفاتورة شراء أو قائمة الأدوية، وسيقوم الذكاء الاصطناعي باستخراج كافة التفاصيل لك تلقائياً.
          </p>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {geminiKeyManager.count()} {geminiKeyManager.count() === 1 ? 'مفتاح' : 'مفاتيح'} نشطة
          </span>
        </div>

        {aiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: '12px', color: '#991b1b', fontSize: '0.85rem' }}>
            <AlertTriangle size={18} />
            <span>{aiError}</span>
          </div>
        )}

        {scannedImages.length === 0 ? (
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('ai-file-uploader')?.click()}
            style={{
              border: `2px dashed ${dragActive ? 'var(--primary)' : '#cbd5e1'}`,
              background: dragActive ? 'rgba(59, 130, 246, 0.05)' : '#f8fafc',
              borderRadius: '20px',
              padding: '48px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.02)';
            }}
            onMouseOut={(e) => {
              if (!dragActive) {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#f8fafc';
              }
            }}
          >
            <input 
              id="ai-file-uploader" 
              type="file" 
              multiple
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={28} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>اسحب وأسقط صور قوائم الأدوية هنا</p>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>أو انقر هنا لاختيار ملفات من جهازك</p>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>يدعم تحديد عدة صور معاً (PNG, JPG, JPEG, WEBP)</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              id="ai-file-uploader" 
              type="file" 
              multiple
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
              gap: '16px', 
              background: 'var(--bg)', 
              padding: '20px', 
              borderRadius: '20px', 
              border: '1px solid var(--border-color)',
              maxHeight: '360px',
              overflowY: 'auto'
            }}>
              {scannedImages.map((img) => (
                <div key={img.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-bg)', padding: '8px', borderRadius: '14px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ position: 'relative', width: '100%', height: '100px', borderRadius: '8px', overflow: 'hidden' }}>
                    <img 
                      src={img.dataUrl} 
                      alt={img.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <button 
                      type="button"
                      className="btn-icon" 
                      style={{ 
                        position: 'absolute', 
                        top: '4px', 
                        right: '4px', 
                        background: 'rgba(239, 68, 68, 0.9)', 
                        color: 'white', 
                        border: 'none', 
                        cursor: 'pointer', 
                        borderRadius: '50%', 
                        width: '24px', 
                        height: '24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setScannedImages(prev => prev.filter(x => x.id !== img.id));
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'center', direction: 'ltr' }} title={img.name}>
                    {img.name}
                  </p>
                </div>
              ))}

              <div 
                onClick={() => document.getElementById('ai-file-uploader')?.click()}
                style={{ 
                  border: '2px dashed #cbd5e1', 
                  borderRadius: '14px', 
                  height: '142px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer', 
                  transition: 'all 0.2s', 
                  background: 'var(--card-bg)',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.01)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'var(--card-bg)';
                }}
              >
                <Plus size={20} style={{ color: '#64748b' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>إضافة المزيد</span>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ height: '48px', justifyContent: 'center', borderRadius: '12px', width: '100%', gap: '8px', marginTop: '8px' }}
              onClick={startAIScan}
            >
              <Sparkles size={18} /> بدء استخراج البيانات بالذكاء الاصطناعي ({scannedImages.length} قائمة/قوائم)
            </button>
          </div>
        )}
      </div>
    );
  };

  const initiateDelete = (medId: number) => {
    setConfirmDeleteId(medId);
    setTimeout(() => {
      setConfirmDeleteId(prev => prev === medId ? null : prev);
    }, 4000); // Auto reset after 4 seconds
  };

  const handleDeleteMedicine = async (medId: number) => {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM medicine_writeoffs WHERE medicine_id = $1", [medId]);
      await db.execute("DELETE FROM medicine_batches WHERE medicine_id = $1", [medId]);
      await db.execute("DELETE FROM sale_items WHERE medicine_id = $1", [medId]);
      await db.execute("DELETE FROM medicines WHERE id = $1", [medId]);
      
      setConfirmDeleteId(null);
      fetchInventory();
      showToast("تم حذف الدواء وجميع بياناته بنجاح", "success");
    } catch (err: any) {
      console.error(err);
      showToast("فشل في حذف الدواء: " + err.message, "error");
    }
  };

  const handleFormSubmit = async (formData: any) => {
    const db = await getDb();
    const barcodeVal = sanitizeBarcode(formData.barcode);

    let scientificName = formData.scientific_name;
    if (!scientificName || !scientificName.trim()) {
      scientificName = await fetchScientificName(formData.name, formData.description);
    }

    if (editingMedicine) {
      await db.execute(
        "UPDATE medicines SET name = $1, category_id = $2, stock = $3, price = $4, barcode = $5, expiry_date = $6, description = $7, tax_rate = $8, scientific_name = $9, min_stock_level = $10, purchase_price = $11 WHERE id = $12",
        [formData.name, formData.category_id, formData.stock, formData.price, barcodeVal, formData.expiry_date, formData.description, formData.tax_rate, scientificName, formData.min_stock_level, formData.purchase_price, editingMedicine.id]
      );

      // Sync active batches to ensure POS and report modules use the correct, updated prices/costs
      const activeBatches = await db.select<any[]>(
        "SELECT * FROM medicine_batches WHERE medicine_id = $1 AND quantity > 0 ORDER BY expiry_date ASC",
        [editingMedicine.id]
      );

      if (activeBatches.length === 0) {
        // If stock was edited to be greater than 0, create an initial batch
        if (formData.stock > 0) {
          await db.execute(
            "INSERT INTO medicine_batches (medicine_id, quantity, expiry_date, purchase_price, selling_price) VALUES ($1, $2, $3, $4, $5)",
            [editingMedicine.id, formData.stock, formData.expiry_date, formData.purchase_price, formData.price]
          );
        }
      } else {
        // 1. Always update selling_price and purchase_price for all active batches
        await db.execute(
          "UPDATE medicine_batches SET purchase_price = $1, selling_price = $2 WHERE medicine_id = $3 AND quantity > 0",
          [formData.purchase_price, formData.price, editingMedicine.id]
        );

        // 2. Sync expiry date for the oldest active batch
        await db.execute(
          "UPDATE medicine_batches SET expiry_date = $1 WHERE id = $2",
          [formData.expiry_date, activeBatches[0].id]
        );

        // 3. Adjust batch quantities so their sum equals the new total stock
        const currentTotal = activeBatches.reduce((sum, b) => sum + b.quantity, 0);
        if (formData.stock !== currentTotal) {
          if (formData.stock > currentTotal) {
            // Increase: add the difference to the oldest active batch
            const diff = formData.stock - currentTotal;
            await db.execute(
              "UPDATE medicine_batches SET quantity = quantity + $1 WHERE id = $2",
              [diff, activeBatches[0].id]
            );
          } else {
            // Decrease: deduct difference starting from the oldest active batch
            let remainingToDeduct = currentTotal - formData.stock;
            for (const batch of activeBatches) {
              if (remainingToDeduct <= 0) break;
              const deduct = Math.min(batch.quantity, remainingToDeduct);
              await db.execute(
                "UPDATE medicine_batches SET quantity = quantity - $1 WHERE id = $2",
                [deduct, batch.id]
              );
              remainingToDeduct -= deduct;
            }
          }
        }
      }
    } else {
      const result = await db.execute(
        "INSERT INTO medicines (name, category_id, stock, price, barcode, expiry_date, description, tax_rate, scientific_name, min_stock_level, purchase_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        [formData.name, formData.category_id, formData.stock, formData.price, barcodeVal, formData.expiry_date, formData.description, formData.tax_rate, scientificName, formData.min_stock_level, formData.purchase_price]
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
    const cleanQuery = searchQuery.trim().toLowerCase();
    const barcodeStr = (m.barcode && m.barcode.trim()) ? m.barcode.toLowerCase() : 'none';
    const matchesSearch = m.name.toLowerCase().includes(cleanQuery) || 
      m.scientific_name?.toLowerCase().includes(cleanQuery) ||
      barcodeStr.includes(cleanQuery);
    
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

  const totalAllCount = medicines.length;
  
  const totalLowStockCount = medicines.filter(
    m => m.stock <= (m.min_stock_level || 5)
  ).length;

  const totalExpiredCount = medicines.filter(m => {
    if (!m.expiry_date) return false;
    const expiry = new Date(m.expiry_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry < thirtyDaysFromNow;
  }).length;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>المخزون</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>إدارة الأدوية والمستلزمات الطبية</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--tab-bg)', padding: '4px', borderRadius: '12px' }}>
            <button 
              className={`btn ${activeFilter === '' ? 'btn-primary' : ''}`} 
              style={{ 
                background: activeFilter === '' ? 'var(--primary)' : 'transparent', 
                color: activeFilter === '' ? 'white' : 'var(--text-slate)', 
                padding: '8px 16px', 
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                boxShadow: 'none'
              }}
              onClick={() => setActiveFilter('')}
            >
              <span>الكل</span>
              <span style={{ 
                background: activeFilter === '' ? 'rgba(255, 255, 255, 0.22)' : 'var(--bg)', 
                color: activeFilter === '' ? 'white' : 'var(--text-slate)', 
                padding: '2px 8px', 
                borderRadius: '20px', 
                fontSize: '0.75rem', 
                fontWeight: 600 
              }}>
                {totalAllCount}
              </span>
            </button>
            <button 
              className={`btn ${activeFilter === 'low_stock' ? 'btn-primary' : ''}`} 
              style={{ 
                background: activeFilter === 'low_stock' ? 'var(--primary)' : 'transparent', 
                color: activeFilter === 'low_stock' ? 'white' : 'var(--text-slate)', 
                padding: '8px 16px', 
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                boxShadow: 'none'
              }}
              onClick={() => setActiveFilter('low_stock')}
            >
              <span>النواقص</span>
              <span style={{ 
                background: activeFilter === 'low_stock' 
                  ? 'rgba(255, 255, 255, 0.22)' 
                  : (totalLowStockCount > 0 ? 'var(--error-container)' : 'var(--bg)'), 
                color: activeFilter === 'low_stock' 
                  ? 'white' 
                  : (totalLowStockCount > 0 ? 'var(--error)' : 'var(--text-slate)'), 
                padding: '2px 8px', 
                borderRadius: '20px', 
                fontSize: '0.75rem', 
                fontWeight: 600 
              }}>
                {totalLowStockCount}
              </span>
            </button>
            <button 
              className={`btn ${activeFilter === 'expired' ? 'btn-primary' : ''}`} 
              style={{ 
                background: activeFilter === 'expired' ? 'var(--primary)' : 'transparent', 
                color: activeFilter === 'expired' ? 'white' : 'var(--text-slate)', 
                padding: '8px 16px', 
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                boxShadow: 'none'
              }}
              onClick={() => setActiveFilter('expired')}
            >
              <span>منتهية الصلاحية</span>
              <span style={{ 
                background: activeFilter === 'expired' 
                  ? 'rgba(255, 255, 255, 0.22)' 
                  : (totalExpiredCount > 0 ? 'var(--error-container)' : 'var(--bg)'), 
                color: activeFilter === 'expired' 
                  ? 'white' 
                  : (totalExpiredCount > 0 ? 'var(--error)' : 'var(--text-slate)'), 
                padding: '2px 8px', 
                borderRadius: '20px', 
                fontSize: '0.75rem', 
                fontWeight: 600 
              }}>
                {totalExpiredCount}
              </span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
            <button 
              className="btn" 
              style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                fontSize: '0.75rem', 
                background: 'var(--secondary)', 
                color: 'white', 
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }} 
              onClick={() => setIsRestockOpen(true)}
            >
              <ShoppingCart size={15} /> إضافة وجبة لشحنة موجودة
            </button>
            <button 
              className="btn" 
              style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                fontSize: '0.75rem', 
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', 
                color: 'white', 
                border: 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }} 
              onClick={() => setIsAIModalOpen(true)}
            >
              <Sparkles size={15} /> إضافة بالذكاء الاصطناعي
            </button>
            <button 
              className="btn" 
              style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                fontSize: '0.75rem', 
                background: 'var(--card-bg)', 
                border: '1.5px solid var(--border-color)', 
                color: 'var(--text-slate)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontWeight: 700,
                transition: 'all 0.2s ease',
                height: '38px',
                whiteSpace: 'nowrap'
              }} 
              onClick={openFetchScientificModal}
            >
              <Brain size={15} /> جلب الاسم العلمي
            </button>
            <button 
              className="btn btn-primary" 
              style={{
                padding: '8px 12px', 
                borderRadius: '8px', 
                fontSize: '0.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                height: '38px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
              onClick={() => { setEditingMedicine(null); setIsModalOpen(true); }}
            >
              <Plus size={15} /> إضافة دواء جديد
            </button>
          </div>
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
              <th style={{ width: '60px' }}></th>
              <th>اسم الدواء</th>
              <th>الفئة</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>تاريخ الانتهاء</th>
              <th style={{ textAlign: 'center' }}>خيارات</th>
            </tr>
          </thead>
          <tbody>
            {filteredMedicines.map(med => {
              const isExpanded = expandedMedId === med.id;
              return (
                <Fragment key={med.id}>
                  <tr onClick={() => toggleExpand(med.id)} style={{ cursor: 'pointer', background: isExpanded ? 'rgba(13, 148, 136, 0.02)' : 'transparent' }}>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <button 
                        type="button"
                        className="btn-eye-modern" 
                        onClick={() => toggleExpand(med.id)}
                        style={{ color: isExpanded ? 'var(--primary)' : 'var(--text-slate)' }}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{med.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 500 }}>{med.scientific_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{med.barcode ? med.barcode : "none"}</div>
                    </td>
                    <td>{med.category_name}</td>
                    <td style={{ fontWeight: 600 }}>{med.stock}</td>
                    <td>{med.price.toLocaleString('en-US')} د.ع</td>
                    <td>{med.expiry_date}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {currentUser?.role === 'admin' ? (
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
                          {confirmDeleteId === med.id ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button 
                                className="btn"
                                style={{ 
                                  background: '#ef4444', 
                                  color: 'white', 
                                  border: 'none', 
                                  padding: '4px 10px', 
                                  borderRadius: '8px', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  height: '32px'
                                }}
                                onClick={() => handleDeleteMedicine(med.id)}
                              >
                                تأكيد
                              </button>
                              <button 
                                className="btn"
                                style={{ 
                                  background: '#e2e8f0', 
                                  color: '#475569', 
                                  border: 'none', 
                                  padding: '4px 10px', 
                                  borderRadius: '8px', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  height: '32px'
                                }}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <>
                              {currentUser?.role === 'admin' && (
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
                              )}
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
                                <AlertTriangle size={16} />
                              </button>
                              {currentUser?.role === 'admin' && (
                                <button 
                                  className="btn-icon" 
                                  title="حذف نهائي"
                                  style={{ 
                                    width: '38px', 
                                    height: '38px', 
                                    borderRadius: '50%',
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    border: '1px solid #fca5a5',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }} 
                                  onClick={() => initiateDelete(med.id)}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#ef4444';
                                    e.currentTarget.style.color = 'white';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#fee2e2';
                                    e.currentTarget.style.color = '#ef4444';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>مغلق</div>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: 'var(--bg)' }}>
                      <td colSpan={8} style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ 
                          background: 'var(--card-bg)', 
                          borderRadius: '16px', 
                          padding: '20px', 
                          border: '1px solid var(--border)',
                          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                            📦 جميع الوجبات (Batches)
                          </h4>
                          {loadingBatches === med.id ? (
                            <div style={{ padding: '10px', color: 'var(--text-slate)', fontSize: '0.85rem' }}>جاري تحميل الوجبات...</div>
                          ) : !medicineBatches[med.id] || medicineBatches[med.id].length === 0 ? (
                            <div style={{ padding: '10px', color: 'var(--text-slate)', fontSize: '0.85rem' }}>لا توجد وجبات مسجلة لهذا الدواء بعد.</div>
                          ) : (
                            <table style={{ margin: 0, width: '100%', border: 'none' }}>
                              <thead style={{ background: '#f1f5f9' }}>
                                <tr style={{ background: 'transparent' }}>
                                  <th style={{ background: 'transparent', padding: '10px 16px', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>الوجبة</th>
                                  <th style={{ background: 'transparent', padding: '10px 16px', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>تاريخ الصلاحية</th>
                                  <th style={{ background: 'transparent', padding: '10px 16px', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>الكمية المتوفرة</th>
                                  <th style={{ background: 'transparent', padding: '10px 16px', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>سعر الشراء للقطعة</th>
                                  <th style={{ background: 'transparent', padding: '10px 16px', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>سعر البيع للوجبة</th>
                                  <th style={{ background: 'transparent', padding: '10px 16px', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800 }}>تاريخ الإدخال</th>
                                  {currentUser?.role === 'admin' && (
                                    <th style={{ background: 'transparent', padding: '10px 16px', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: 'var(--text-slate)', fontWeight: 800, textAlign: 'center' }}>إجراءات</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {medicineBatches[med.id].map((batch, index) => {
                                  const expiry = new Date(batch.expiry_date);
                                  const now = new Date();
                                  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                  
                                  let rowOpacity = 1;
                                  let badgeClass = 'badge-primary';
                                  let statusText = 'صالحة';
                                  if (batch.quantity === 0) {
                                    badgeClass = 'badge-error';
                                    statusText = 'مستهلكة';
                                    rowOpacity = 0.45;
                                  } else if (daysLeft < 0) {
                                    badgeClass = 'badge-error';
                                    statusText = 'منتهية';
                                    rowOpacity = 0.6;
                                  } else if (daysLeft <= 90) {
                                    badgeClass = 'badge-secondary';
                                    statusText = `تنتهي خلال ${daysLeft} يوم`;
                                  }

                                  return (
                                    <tr key={batch.id} style={{ background: 'transparent', opacity: rowOpacity }}>
                                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>وجبة #{index + 1}</td>
                                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span>{batch.expiry_date}</span>
                                          <span className={`badge ${badgeClass}`} style={{ fontSize: '9px', padding: '2px 8px' }}>{statusText}</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, borderBottom: '1px solid #f1f5f9' }}>{batch.quantity} قطعة</td>
                                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>{batch.purchase_price.toLocaleString()} د.ع</td>
                                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', borderBottom: '1px solid #f1f5f9' }}>{batch.selling_price.toLocaleString()} د.ع</td>
                                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>{new Date(batch.created_at).toLocaleDateString()}</td>
                                      {currentUser?.role === 'admin' && (
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                                          <button 
                                            type="button"
                                            className="btn" 
                                            style={{ 
                                              padding: '4px 10px', 
                                              fontSize: '0.75rem', 
                                              background: '#fee2e2', 
                                              color: '#dc2626', 
                                              borderRadius: '8px',
                                              fontWeight: 700,
                                              cursor: 'pointer' 
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setWriteoffData({ medicine_id: med.id, batch_id: batch.id, quantity: batch.quantity, reason: daysLeft < 0 ? "Expired" : "Damaged" });
                                              setBatches([batch]);
                                              setIsWriteoffOpen(true);
                                            }}
                                          >
                                            إتلاف الوجبة
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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
          defaultTaxRate={appTaxRate}
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
              triggerToast("يرجى إكمال كافة البيانات بشكل صحيح", "error");
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
            triggerToast("تمت إضافة الوجبة الجديدة وتحديث المخزون.", "success");
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
                triggerToast("يرجى إكمال البيانات", "error"); return;
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
              triggerToast("تم تسجيل الإتلاف وتحديث المخزون", "success");
            }}
          >
            تأكيد الاستبعاد من المخزون
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isAIModalOpen} 
        onClose={() => { 
          setIsAIModalOpen(false); 
          setExtractedItems([]); 
          setScannedImages([]); 
        }} 
        title="إضافة أدوية بالذكاء الاصطناعي"
        maxWidth="1000px"
        closeOnOverlayClick={false}
      >
        {renderAIModalContent()}
      </Modal>

      <Modal
        isOpen={isFetchSciOpen}
        onClose={() => {
          if (!isFetchingSci) setIsFetchSciOpen(false);
        }}
        title="🤖 جلب الأسماء العلمية بالذكاء الاصطناعي"
        maxWidth="800px"
        closeOnOverlayClick={false}
      >
        <div style={{ padding: '8px', direction: 'rtl' }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .spinner-small {
              width: 16px;
              height: 16px;
              border: 2px solid #cbd5e1;
              border-top: 2px solid #3b82f6;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
          `}</style>


          {/* Progress bar or fetch trigger */}
          <div style={{ 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: '16px', 
            padding: '16px', 
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                عدد الأدوية المحددة: <span style={{ color: '#3b82f6' }}>{sciMeds.length}</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isFetchingSci && (
                  <>
                    <span style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="spinner-small" style={{ display: 'inline-block' }}></span> جاري البحث والتخمين...
                    </span>
                    <button
                      className="btn"
                      onClick={() => { shouldStopRef.current = true; }}
                      style={{ 
                        padding: '8px 16px', 
                        fontSize: '0.85rem', 
                        background: '#fee2e2', 
                        color: '#ef4444', 
                        border: '1px solid #fca5a5',
                        fontWeight: 700 
                      }}
                    >
                      إيقاف البحث
                    </button>
                  </>
                )}
                {!isFetchingSci && sciMeds.length > 0 && !sciMeds.every(m => m.status === 'success') && (
                  <button 
                    className="btn btn-primary" 
                    onClick={startFetchingScientificNames}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Brain size={18} /> {sciProgress > 0 ? "استئناف الجلب" : "بدء الجلب بالذكاء الاصطناعي"}
                  </button>
                )}
                {!isFetchingSci && sciMeds.length > 0 && sciMeds.every(m => m.status === 'success') && (
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>
                    اكتمل الجلب! يرجى مراجعة الأسماء وحفظها.
                  </span>
                )}
              </div>
            </div>

            {sciProgress > 0 && (
              <div>
                <div style={{ 
                  width: '100%', 
                  background: '#e2e8f0', 
                  borderRadius: '9999px', 
                  height: '10px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    width: `${sciProgress}%`, 
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', 
                    height: '100%',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
                  <span>{sciProgress}% مكتمل</span>
                  <span>{sciMeds.filter(m => m.status === 'success').length} نجح | {sciMeds.filter(m => m.status === 'failed').length} فشل</span>
                </div>
              </div>
            )}
          </div>

          {/* List of medicines */}
          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            background: 'var(--card-bg)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-slate)' }}>الدواء (الاسم التجاري)</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-slate)' }}>الوصف</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-slate)', width: '250px' }}>الاسم العلمي المستخرج</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-slate)', width: '80px', textAlign: 'center' }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {sciMeds.map((med, idx) => (
                  <tr key={med.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                      {med.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {med.description || 'لا يوجد وصف'}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <input
                        type="text"
                        className="input"
                        style={{ 
                          width: '100%', 
                          height: '36px', 
                          fontSize: '0.85rem', 
                          padding: '0 8px', 
                          background: med.status === 'loading' ? '#f8fafc' : '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px'
                        }}
                        disabled={isFetchingSci || med.status === 'loading'}
                        placeholder={med.status === 'loading' ? "جاري الجلب..." : "الاسم العلمي"}
                        value={med.scientific_name}
                        onChange={(e) => {
                          const updated = [...sciMeds];
                          updated[idx].scientific_name = e.target.value;
                          setSciMeds(updated);
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {med.status === 'idle' && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>بانتظار البدء</span>}
                      {med.status === 'loading' && <div style={{ display: 'flex', justifyContent: 'center' }}><span className="spinner-small"></span></div>}
                      {med.status === 'success' && <Check size={18} style={{ color: '#10b981', display: 'inline-block' }} />}
                      {med.status === 'failed' && <AlertTriangle size={18} style={{ color: '#ef4444', display: 'inline-block' }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button 
              className="btn btn-primary" 
              onClick={saveScientificNames}
              disabled={isFetchingSci || sciMeds.filter(m => m.scientific_name.trim()).length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
            >
              <Check size={18} /> حفظ الأسماء العلمية في قاعدة البيانات
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setIsFetchSciOpen(false)}
              disabled={isFetchingSci}
              style={{ fontWeight: 700 }}
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {toastNotification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '50%',
          transform: 'translateX(50%)',
          backgroundColor: toastNotification.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          zIndex: 100000,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastNotification.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
          {toastNotification.message}
        </div>
      )}
    </div>
  );
};
