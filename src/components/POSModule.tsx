import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, User as UserIcon, CheckCircle, Camera, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getDb } from '../lib/db';
import { geminiKeyManager } from '../lib/geminiKeyManager';
import { Medicine } from '../types';
import { CameraScanner } from './CameraScanner';
import { Modal } from './Modal';

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
  currentUser?: any;
}

export const POSModule = ({ cart, setCart, customerName, setCustomerName, currentUser: _currentUser }: POSProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(15);
  const [discount, setDiscount] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [amountPaid, setAmountPaid] = useState<number>(0);

  // Alternatives suggestions state
  const [altModalOpen, setAltModalOpen] = useState(false);
  const [alternativeFor, setAlternativeFor] = useState<any | null>(null);
  const [alternativesList, setAlternativesList] = useState<any[]>([]);

  // DDI states
  const [ddiResult, setDdiResult] = useState<{
    has_interaction: boolean;
    severity: 'critical' | 'warning' | 'none';
    message?: string;
    conflicting_drugs?: string;
    risks?: string;
    recommended_alternatives?: string;
  } | null>(null);
  const [isCheckingDDI, setIsCheckingDDI] = useState(false);
  const [ddiAlertOpen, setDdiAlertOpen] = useState(false);
  const [patientCondition, setPatientCondition] = useState<string>("none");

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
        // Load/refresh the key manager pool
        await geminiKeyManager.load();
    };
    fetchTax();
  }, []);


  const checkLocalInteractions = (drugs: { name: string; scientific_name: string }[], condition: string) => {
    const names = drugs.map(d => d.name.toLowerCase());
    const scientifics = drugs.map(d => d.scientific_name.toLowerCase());

    const resolvedScientifics = [...scientifics];
    drugs.forEach(d => {
      const trade = d.name.toLowerCase();
      if (!d.scientific_name) {
        if (trade.includes("apcycline") || trade.includes("tetracyclen") || trade.includes("tetracycline")) {
          resolvedScientifics.push("tetracycline");
        }
        if (trade.includes("brufen") || trade.includes("ibuphil") || trade.includes("ibuprofen")) {
          resolvedScientifics.push("ibuprofen");
        }
        if (trade.includes("olfen") || trade.includes("voltex") || trade.includes("difen") || trade.includes("diclogesic") || trade.includes("diclofast") || trade.includes("oflam") || trade.includes("voltaren") || trade.includes("diclofenac")) {
          resolvedScientifics.push("diclofenac");
        }
        if (trade.includes("concor") || trade.includes("cardex") || trade.includes("bisoprolol")) {
          resolvedScientifics.push("bisoprolol");
        }
        if (trade.includes("inderal") || trade.includes("propranolol")) {
          resolvedScientifics.push("propranolol");
        }
        if (trade.includes("lisinopril") || trade.includes("captopril") || trade.includes("valsartan") || trade.includes("losartan") || trade.includes("diovan") || trade.includes("diostar") || trade.includes("angiosar") || trade.includes("atacand") || trade.includes("lotevan")) {
          resolvedScientifics.push("ace_arb");
        }
        if (trade.includes("cold-out") || trade.includes("cold cure") || trade.includes("flustop") || trade.includes("123 cold") || trade.includes("otrivin") || trade.includes("decozaal") || trade.includes("clarinase") || trade.includes("actifed") || trade.includes("pseudoephedrine") || trade.includes("phenylephrine") || trade.includes("xylometazoline")) {
          resolvedScientifics.push("decongestant");
        }
        if (trade.includes("prednisolone") || trade.includes("dexamethasone") || trade.includes("cortisone") || trade.includes("prilone")) {
          resolvedScientifics.push("corticosteroid");
        }
        if (trade.includes("paracetamol") || trade.includes("panadol") || trade.includes("samadol") || trade.includes("cetal") || trade.includes("adol")) {
          resolvedScientifics.push("paracetamol");
        }
      }
    });

    const hasDrug = (term: string) => {
      const t = term.toLowerCase();
      return (
        names.some(n => n.includes(t)) || 
        scientifics.some(s => s.includes(t)) ||
        resolvedScientifics.some(s => s.includes(t))
      );
    };

    const findOffendingDrug = (terms: string[]) => {
      const match = drugs.find(d => {
        const t = d.name.toLowerCase();
        const s = (d.scientific_name || "").toLowerCase();
        return terms.some(term => {
          const termLower = term.toLowerCase();
          return t.includes(termLower) || s.includes(termLower) ||
                 (termLower === "tetracycline" && (t.includes("apcycline") || t.includes("tetracyclen"))) ||
                 (termLower === "ibuprofen" && (t.includes("brufen") || t.includes("ibuphil"))) ||
                 (termLower === "diclofenac" && (t.includes("olfen") || t.includes("voltex") || t.includes("difen") || t.includes("diclogesic") || t.includes("diclofast") || t.includes("oflam") || t.includes("voltaren"))) ||
                 (termLower === "bisoprolol" && (t.includes("concor") || t.includes("cardex"))) ||
                 (termLower === "propranolol" && t.includes("inderal")) ||
                 (termLower === "ace_arb" && (t.includes("lisinopril") || t.includes("captopril") || t.includes("valsartan") || t.includes("losartan") || t.includes("diovan") || t.includes("diostar") || t.includes("angiosar") || t.includes("atacand") || t.includes("lotevan"))) ||
                 (termLower === "decongestant" && (t.includes("cold-out") || t.includes("cold cure") || t.includes("flustop") || t.includes("123 cold") || t.includes("otrivin") || t.includes("decozaal") || t.includes("clarinase") || t.includes("actifed") || t.includes("pseudoephedrine") || t.includes("phenylephrine") || t.includes("xylometazoline"))) ||
                 (termLower === "corticosteroid" && (t.includes("prednisolone") || t.includes("dexamethasone") || t.includes("cortisone") || t.includes("prilone"))) ||
                 (termLower === "paracetamol" && (t.includes("paracetamol") || t.includes("panadol") || t.includes("samadol") || t.includes("cetal") || t.includes("adol")));
        });
      });
      return match ? `${match.name} (${match.scientific_name || "اسم علمي غير مسجل"})` : "";
    };

    const hasDecongestant = () => {
      return (
        hasDrug("pseudoephedrine") || 
        hasDrug("سودوإيفيدرين") || 
        hasDrug("phenylephrine") || 
        hasDrug("فينيليفرين") || 
        hasDrug("cold & flu") || 
        hasDrug("برد وإنفلونزا") || 
        hasDrug("clarinase") || 
        hasDrug("كلاريناز") || 
        hasDrug("actifed") || 
        hasDrug("أكتيفيد") ||
        resolvedScientifics.includes("decongestant")
      );
    };

    // ----------------------------------------------------
    // 1. Patient Special Condition Contraindications
    // ----------------------------------------------------
    if (condition === 'pregnant') {
      // Tetracyclines are contraindicated in pregnancy
      if (hasDrug("tetracycline") || hasDrug("تيتراسايكلن") || hasDrug("doxycycline") || hasDrug("دوكسيسايكلن") || hasDrug("apcycline") || hasDrug("أبسيكلين") || hasDrug("vibramycin") || hasDrug("فايبرامايسين")) {
        const offending = findOffendingDrug(["tetracycline", "doxycycline", "apcycline", "vibramycin"]);
        return {
          has_interaction: true,
          severity: 'critical' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" يتعارض مع حالة الحمل`,
          risks: "تسبب التتراسايكلينات (مثل الأبسيكلين والدوكسيسايكلين) تلوناً دائماً في أسنان الجنين (باللون الأصفر أو البني) وتثبط نمو العظام الطويلة لدى الجنين، كما تشكل خطراً بسمية كبدية للأم الحامل.",
          recommended_alternatives: "يُنصح باستبدالها بمضاد حيوي آمن أثناء الحمل مثل الأموكسيسيلين (Amoxicillin) أو الأريثروميسين (Erythromycin) المتوفرة في المخزن بعد استشارة الطبيب المعالج."
        };
      }
      // NSAIDs are contraindicated in pregnancy (especially 3rd trimester)
      if (hasDrug("diclofenac") || hasDrug("ديكلوفيناك") || hasDrug("voltaren") || hasDrug("فولتارين") || hasDrug("ibuprofen") || hasDrug("بروفين") || hasDrug("naproxen") || hasDrug("نابروكسين") || hasDrug("aspirin") || hasDrug("أسبرين")) {
        const offending = findOffendingDrug(["diclofenac", "ibuprofen", "naproxen", "aspirin"]);
        return {
          has_interaction: true,
          severity: 'critical' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (NSAIDs/Aspirin) يتعارض مع حالة الحمل`,
          risks: "خطر كبير على الجنين (خاصة في الثلث الثالث) يشمل الإغلاق المبكر للقناة الشريانية الجنينية وتثبيط وظائف الكلى لدى الجنين، بالإضافة إلى خطر زيادة النزيف أثناء الولادة.",
          recommended_alternatives: "يُنصح باستبدال مسكن الألم بمادة الباراسيتامول (أدول / بنادول) المتوفرة في المخزن باعتباره البديل الأكثر أماناً أثناء الحمل بعد استشارة الطبيب المشرف."
        };
      }
      // ACE Inhibitors / ARBs are contraindicated
      if (hasDrug("lisinopril") || hasDrug("ليسينوبريل") || hasDrug("captopril") || hasDrug("كابتوبريل") || hasDrug("valsartan") || hasDrug("فالزارتان") || hasDrug("diovan") || hasDrug("ديوفان") || hasDrug("losartan") || hasDrug("لوزارتان") || resolvedScientifics.includes("ace_arb")) {
        const offending = findOffendingDrug(["lisinopril", "captopril", "valsartan", "losartan", "ace_arb"]);
        return {
          has_interaction: true,
          severity: 'critical' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" يتعارض مع حالة الحمل`,
          risks: "سمية شديدة لكلى الجنين، تراجع في كمية السائل السلوي (Oligohydramnios)، وتأخر نمو عظام الجمجمة للجنين.",
          recommended_alternatives: "يجب التوقف فوراً واستشارة الطبيب المعالج لاستبدال الدواء ببدائل آمنة للضغط أثناء الحمل مثل ميثيل دوبا (Aldomet / ألدوميت) أو لابيتابول المتوفرة في المخزن."
        };
      }
    }

    if (condition === 'renal') {
      // NSAIDs are nephrotoxic
      if (hasDrug("diclofenac") || hasDrug("ديكلوفيناك") || hasDrug("voltaren") || hasDrug("فولتارين") || hasDrug("ibuprofen") || hasDrug("بروفين") || hasDrug("naproxen") || hasDrug("نابروكسين")) {
        const offending = findOffendingDrug(["diclofenac", "ibuprofen", "naproxen"]);
        return {
          has_interaction: true,
          severity: 'warning' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" يتعارض مع الاعتلال الكلوي`,
          risks: "تسبب مضادات الالتهاب غير الستيرويدية تضيق الأوعية الواردة للكلية، مما يؤدي إلى انخفاض حاد في معدل الترشيح الكبيبي وتدهور وظائف الكلى واحتجاز السوائل.",
          recommended_alternatives: "يُنصح باستخدام الباراسيتامول (بنادول / أدول) كمسكن بديل آمن لتجنب إلحاق الضرر بالكلية."
        };
      }
    }

    if (condition === 'diabetic') {
      // Corticosteroids elevate blood glucose
      if (hasDrug("prednisolone") || hasDrug("بريدنيزولون") || hasDrug("dexamethasone") || hasDrug("ديكساميثازون") || hasDrug("cortisone") || hasDrug("كورتيزون") || resolvedScientifics.includes("corticosteroid")) {
        const offending = findOffendingDrug(["prednisolone", "dexamethasone", "cortisone", "corticosteroid"]);
        return {
          has_interaction: true,
          severity: 'warning' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (كورتيزون) يتعارض مع مرض السكري`,
          risks: "ارتفاع حاد وشديد في مستويات السكر في الدم بسبب زيادة مقاومة الإنسولين وتحفيز تصنيع الجلوكوز في الكبد.",
          recommended_alternatives: "يجب مراقبة مستويات السكر في الدم عن كثب وتعديل جرعات خافضات السكر بعد استشارة الطبيب، أو التفكير في خيارات علاجية غير كورتيزونية."
        };
      }
    }

    if (condition === 'hepatic') {
      // High dose paracetamol hepatotoxicity
      if (hasDrug("paracetamol") || hasDrug("باراسيتامول") || hasDrug("panadol") || hasDrug("بنادول") || hasDrug("adol") || hasDrug("أدول")) {
        const offending = findOffendingDrug(["paracetamol", "panadol", "adol"]);
        return {
          has_interaction: true,
          severity: 'warning' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" يتعارض مع اعتلال الكبد`,
          risks: "خطر حدوث تسمم كبدي وتلف خلايا الكبد عند استخدام الباراسيتامول بجرعات عالية أو متكررة في مرضى اعتلال الكبد.",
          recommended_alternatives: "يجب الحد من الجرعة اليومية الإجمالية للباراسيتامول لتكون أقل من 2 جرام يومياً (أو تجنبه تماماً في حالات الفشل الكبدي المتقدم) مع المراقبة الطبية."
        };
      }
    }

    if (condition === 'hypertension') {
      if (hasDecongestant()) {
        const offending = findOffendingDrug(["pseudoephedrine", "phenylephrine", "xylometazoline", "cold", "clarinase", "actifed", "decongestant"]);
        return {
          has_interaction: true,
          severity: 'critical' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (مضاد احتقان) يتعارض مع مرضى ضغط الدم`,
          risks: "تسبب مضادات الاحتقان تضيقاً في الأوعية الدموية وارتفاعاً حاداً ومفاجئاً في ضغط الدم، مما يشكل خطراً كبيراً على مرضى الضغط.",
          recommended_alternatives: "يُنصح باستبدالها بمضادات الحساسية الآمنة الخالية من مضادات الاحتقان مثل لوراتادين (كلاريتين) أو سيتريزين (زيرتك) المتوفرة في المخزن لعلاج أعراض الزكام."
        };
      }
      if (hasDrug("diclofenac") || hasDrug("ديكلوفيناك") || hasDrug("voltaren") || hasDrug("فولتارين") || hasDrug("ibuprofen") || hasDrug("بروفين") || hasDrug("naproxen") || hasDrug("نابروكسين")) {
        const offending = findOffendingDrug(["diclofenac", "ibuprofen", "naproxen"]);
        return {
          has_interaction: true,
          severity: 'warning' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (NSAIDs) يتعارض مع مرضى ضغط الدم`,
          risks: "تقلل مضادات الالتهاب غير الستيرويدية من فعالية أدوية الضغط (مثل مدرات البول ومثبطات ACE) عن طريق تثبيط البروستاجلاندين الكلوي، مما يؤدي لارتفاع ضغط الدم واحتجاز السوائل.",
          recommended_alternatives: "يُنصح بطلب استشارة الطبيب أو استخدام الباراسيتامول (بنادول / أدول) المتوفر في المخزن كبديل آمن لتسكين الألم."
        };
      }
    }

    if (condition === 'htn_diabetes') {
      if (hasDecongestant()) {
        const offending = findOffendingDrug(["pseudoephedrine", "phenylephrine", "xylometazoline", "cold", "clarinase", "actifed", "decongestant"]);
        return {
          has_interaction: true,
          severity: 'critical' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (مضاد احتقان) يتعارض مع مرضى الضغط والسكري معاً`,
          risks: "تؤدي لارتفاع حاد في ضغط الدم نتيجة تضيق الأوعية، بالإضافة لرفع مستويات السكر في الدم عبر تحفيز مستقبلات بيتا الأدرينالية الكبدية.",
          recommended_alternatives: "يُنصح باستبدالها ببخاخات المحلول الملحي ومضادات الهيستامين الآمنة مثل زيرتك أو كلاريتين المتوفرة في المخزن."
        };
      }
      if (hasDrug("prednisolone") || hasDrug("بريدنيزولون") || hasDrug("dexamethasone") || hasDrug("ديكساميثازون") || hasDrug("cortisone") || hasDrug("كورتيزون") || resolvedScientifics.includes("corticosteroid")) {
        const offending = findOffendingDrug(["prednisolone", "dexamethasone", "cortisone", "corticosteroid"]);
        return {
          has_interaction: true,
          severity: 'warning' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (كورتيزون) يتعارض مع مرضى الضغط والسكري معاً`,
          risks: "تسبب الكورتيزونات ارتفاعاً مضاعفاً في السكر والضغط معاً بسبب احتباس الصوديوم والمياه وزيادة مقاومة الإنسولين.",
          recommended_alternatives: "يجب الصرف تحت إشراف طبي دقيق ومراقبة المؤشرات الحيوية بانتظام."
        };
      }
      if (hasDrug("diclofenac") || hasDrug("ديكلوفيناك") || hasDrug("voltaren") || hasDrug("فولتارين") || hasDrug("ibuprofen") || hasDrug("بروفين") || hasDrug("naproxen") || hasDrug("نابروكسين")) {
        const offending = findOffendingDrug(["diclofenac", "ibuprofen", "naproxen"]);
        return {
          has_interaction: true,
          severity: 'warning' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (NSAIDs) يتعارض مع مرضى الضغط والسكري معاً`,
          risks: "ترفع ضغط الدم وتزيد من خطر الاعتلال الكلوي وتسبب تهيج بطانة المعدة خاصة مع أدوية السكري والضغط المتزامنة.",
          recommended_alternatives: "يُنصح باستخدام الباراسيتامول (بنادول / أدول) المتوفر في المخزن كمسكن بديل آمن."
        };
      }
    }

    if (condition === 'asthma') {
      if (hasDrug("propranolol") || hasDrug("بروبرانولول") || hasDrug("inderal") || hasDrug("إنديرال") || hasDrug("atenolol") || hasDrug("أتينولول") || hasDrug("bisoprolol") || hasDrug("بيسوبرولول") || hasDrug("concor") || hasDrug("كونكور")) {
        const offending = findOffendingDrug(["propranolol", "inderal", "atenolol", "bisoprolol", "concor"]);
        return {
          has_interaction: true,
          severity: 'critical' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (حاصرات بيتا) يتعارض مع مريض الربو`,
          risks: "تسبب حاصرات بيتا تضيقاً حاداً وخطراً في القصبات الهوائية (Bronchoconstriction)، مما قد يؤدي إلى نوبة ربو شديدة ومهددة للحياة.",
          recommended_alternatives: "يجب استبدال حاصرات بيتا بأدوية ضغط أو قلب بديلة وآمنة لمرضى الربو بالتنسيق مع الطبيب المختص."
        };
      }
      if (hasDrug("aspirin") || hasDrug("أسبرين") || hasDrug("diclofenac") || hasDrug("ديكلوفيناك") || hasDrug("voltaren") || hasDrug("فولتارين") || hasDrug("ibuprofen") || hasDrug("بروفين")) {
        const offending = findOffendingDrug(["aspirin", "diclofenac", "ibuprofen"]);
        return {
          has_interaction: true,
          severity: 'warning' as const,
          conflicting_drugs: `الدواء المانع: "${offending}" (NSAIDs/Aspirin) يتعارض مع مريض الربو`,
          risks: "قد تؤدي مضادات الالتهاب غير الستيرويدية والأسبرين إلى إحداث تشنج قصبي حاد (Asthma Attack) لدى المرضى الذين يعانون من حساسية الأسبرين (متلازمة سامتر).",
          recommended_alternatives: "يُفضل استخدام الباراسيتامول (بنادول / أدول) المتوفر في المخزن كبديل آمن لتسكين الألم وخفض الحرارة."
        };
      }
    }

    // ----------------------------------------------------
    // 2. Drug-Drug Interactions (DDI)
    // ----------------------------------------------------
    // Sildenafil + Nitroglycerin (Nitrates)
    if (
      (hasDrug("sildenafil") || hasDrug("viagra") || hasDrug("cialis") || hasDrug("tadalafil")) &&
      (hasDrug("nitroglycerin") || hasDrug("nitrate") || hasDrug("isosorbide") || hasDrug("angised"))
    ) {
      const offending1 = findOffendingDrug(["sildenafil", "viagra", "cialis", "tadalafil"]);
      const offending2 = findOffendingDrug(["nitroglycerin", "nitrate", "isosorbide", "angised"]);
      return {
        has_interaction: true,
        severity: 'critical' as const,
        conflicting_drugs: `تعارض بين: "${offending1}" و "${offending2}"`,
        risks: "انخفاض مفاجئ وحاد جداً في ضغط الدم قد يهدد حياة المريض.",
        recommended_alternatives: "الرجاء مراجعة الطبيب المختص فوراً لتعديل الخطة العلاجية أو استبدال أحد الدوائين ببديل آمن لا يتفاعل مع النيترات."
      };
    }

    // Warfarin + Aspirin
    if (
      hasDrug("warfarin") &&
      (hasDrug("aspirin") || hasDrug("أسبرين"))
    ) {
      const offending1 = findOffendingDrug(["warfarin"]);
      const offending2 = findOffendingDrug(["aspirin"]);
      return {
        has_interaction: true,
        severity: 'critical' as const,
        conflicting_drugs: `تعارض بين: "${offending1}" و "${offending2}"`,
        risks: "ارتفاع كبير ومضاعف في خطر حدوث نزيف داخلي أو معوي حاد قد يهدد حياة المريض.",
        recommended_alternatives: "الرجاء استشارة الطبيب المشرف؛ قد يُنصح باستخدام بدائل مسكنة آمنة للمعدة مثل الباراسيتامول لتسكين الألم بدلاً من الأسبرين."
      };
    }

    // NSAID (Diclofenac/Ibuprofen/Naproxen) + SSRI (Escitalopram/Sertraline/Fluoxetine/Citalopram/Paroxetine)
    if (
      (hasDrug("diclofenac") || hasDrug("ديكلوفيناك") || hasDrug("voltaren") || hasDrug("فولتارين") || hasDrug("ibuprofen") || hasDrug("بروفين") || hasDrug("naproxen") || hasDrug("نابروكسين")) &&
      (hasDrug("escitalopram") || hasDrug("اسيتالوبرام") || hasDrug("cipralex") || hasDrug("سيبراالكس") || hasDrug("sertraline") || hasDrug("سيرترالين") || hasDrug("lustral") || hasDrug("fluoxetine") || hasDrug("فلوكسيتين") || hasDrug("prozac") || hasDrug("citalopram") || hasDrug("سيتالوبرام") || hasDrug("paroxetine") || hasDrug("باروكسيتين"))
    ) {
      const offending1 = findOffendingDrug(["diclofenac", "ibuprofen", "naproxen"]);
      const offending2 = findOffendingDrug(["escitalopram", "sertraline", "fluoxetine", "citalopram", "paroxetine"]);
      return {
        has_interaction: true,
        severity: 'warning' as const,
        conflicting_drugs: `تعارض بين: "${offending1}" و "${offending2}"`,
        risks: "يزيد الاستخدام المتزامن لمضادات الالتهاب غير الستيرويدية (NSAIDs) ومثبطات استرداد السيروتونين الانتقائية (SSRIs) من خطر النزيف المعدي المعوي بشكل كبير. الآلية تكمن في أن مضادات الالتهاب غير الستيرويدية يمكن أن تسبب تآكلًا في بطانة المعدة وتثبط وظيفة الصفائح الدموية، بينما تؤثر مثبطات استرداد السيروتونين الانتقائية أيضًا على وظيفة الصفائح الدموية، مما يعزز هذا الخطر.",
        recommended_alternatives: "يوصى بمراقبة المريض عن كثب لأي علامات نزيف (مثل براز أسود أو دموي، قيء دموي). قد يكون من الضروري النظر في استخدام دواء واقي للمعدة مثل مثبطات مضخة البروتون (PPIs)، أو التفكير في بدائل لأحد الدوائين إذا أمكن (مثل الباراسيتامول) من الأدوية المتوفرة بالمخزن."
      };
    }

    // NSAID (Ibuprofen/Diclofenac) + Blood Thinner (Aspirin/Warfarin)
    if (
      (hasDrug("ibuprofen") || hasDrug("بروفين") || hasDrug("diclofenac") || hasDrug("voltaren") || hasDrug("فولتارين") || hasDrug("naproxen")) &&
      (hasDrug("aspirin") || hasDrug("warfarin") || hasDrug("clopidogrel") || hasDrug("plavix"))
    ) {
      const offending1 = findOffendingDrug(["ibuprofen", "diclofenac", "naproxen"]);
      const offending2 = findOffendingDrug(["aspirin", "warfarin", "clopidogrel", "plavix"]);
      return {
        has_interaction: true,
        severity: 'warning' as const,
        conflicting_drugs: `تعارض بين: "${offending1}" و "${offending2}"`,
        risks: "زيادة خطر حدوث قرحة المعدة والنزيف المعوي الحاد وتثبيط وظيفة الصفائح الدموية.",
        recommended_alternatives: "يُنصح باستبدال مسكن الألم ببديل آمن على المعدة والدم مثل الباراسيتامول (أدول / بنادول) المتوفر بالمخزن."
      };
    }

    // Ciprofloxacin + Calcium/Iron
    if (
      (hasDrug("ciprofloxacin") || hasDrug("سيبرو")) &&
      (hasDrug("calcium") || hasDrug("كالسيوم") || hasDrug("iron") || hasDrug("حديد"))
    ) {
      const offending1 = findOffendingDrug(["ciprofloxacin"]);
      const offending2 = findOffendingDrug(["calcium", "iron"]);
      return {
        has_interaction: true,
        severity: 'warning' as const,
        conflicting_drugs: `تعارض بين: "${offending1}" و "${offending2}"`,
        risks: "انخفاض كبير في امتصاص المضاد حيوي بالامعاء، مما يؤدي إلى فشل العلاج وعدم القضاء على الالتهاب.",
        recommended_alternatives: "لا يوجد تعارض حتمي يمنع الصرف، ولكن يجب الفصل الزمني: أخذ السيبروفلوكساسين قبل ساعتين أو بعد 6 ساعات من تناول الكالسيوم أو الحديد."
      };
    }

    return null;
  };

  const checkDrugInteractions = async () => {
    setIsCheckingDDI(true);
    const drugs = cart.map(item => ({
      name: item.medicine.name,
      scientific_name: item.medicine.scientific_name || ""
    }));

    const offlineCheck = checkLocalInteractions(drugs, patientCondition);
    if (offlineCheck) {
      setDdiResult(offlineCheck);
      setIsCheckingDDI(false);
      return;
    }

    if (!geminiKeyManager.hasKeys()) {
      setDdiResult({
        has_interaction: false,
        severity: 'none',
        message: patientCondition !== 'none'
          ? "الفحص السريري: لم يتم رصد تعارض محلي لهذه الحالة الخاصة. يرجى تفعيل مفتاح Gemini API للفحص الشامل."
          : "الفحص السريري: لم يتم رصد تداخلات شائعة محلياً. يرجى تفعيل مفتاح Gemini API في الإعدادات للفحص الذكي الشامل."
      });
      setIsCheckingDDI(false);
      return;
    }

    try {
      const db = await getDb();
      const inventoryRes = await db.select<any[]>("SELECT name, scientific_name, stock FROM medicines WHERE stock > 0");

      const conditionMap: { [key: string]: string } = {
        none: "None (Normal patient)",
        pregnant: "Pregnant",
        breastfeeding: "Breastfeeding",
        renal: "Renal Impairment (Kidney disease)",
        hepatic: "Hepatic Impairment (Liver disease)",
        diabetic: "Diabetic",
        hypertension: "Hypertension (High Blood Pressure)",
        htn_diabetes: "Hypertension and Diabetes together",
        asthma: "Asthma"
      };
      const conditionMapAr: { [key: string]: string } = {
        none: "طبيعية (لا توجد حالة خاصة)",
        pregnant: "حامل",
        breastfeeding: "مرضع",
        renal: "مريض كلى",
        hepatic: "مريض كبد",
        diabetic: "مريض سكري",
        hypertension: "مريض ضغط دم",
        htn_diabetes: "مريض ضغط وسكري معاً",
        asthma: "مريض ربو"
      };
      const conditionText = conditionMap[patientCondition] || "None";
      const conditionTextAr = conditionMapAr[patientCondition] || "طبيعية";

      const promptText = `You are a clinical pharmacist. Analyze this patient profile:
- Special Patient Condition: "${conditionText}" (in Arabic: "${conditionTextAr}")
- Cart Medicines:
${drugs.map((d, idx) => `${idx + 1}. Trade Name: "${d.name}", Scientific Name: "${d.scientific_name || "(Unknown/Missing)"}"`).join('\n')}

Here is a list of available in-stock medicines in our pharmacy's inventory:
${inventoryRes.map(i => `- "${i.name}" (Scientific: "${i.scientific_name || "(Unknown/Missing)"}", Stock: ${i.stock})`).join('\n')}

IMPORTANT CLINICAL SAFETY DIRECTIVES:
1. Some medicines in the cart or inventory have MISSING or EMPTY scientific names in our database. You MUST deduce the active pharmaceutical ingredient (scientific name) or drug class from their Trade Name / Brand Name.
   - For example:
     * "Apcycline" contains Tetracycline (Tetracycline is contraindicated/unsafe in pregnancy).
     * "Brufen" or "Ibuphil" contains Ibuprofen.
     * "Olfen", "Voltex", "Difen", "Diclogesic", "Diclofast", "Oflam", "Voltaren" contain Diclofenac.
     * "Concor" or "Cardex" contains Bisoprolol (Beta blocker).
     * "Nexium" contains Esomeprazole.
     * "Otrivin" contains Xylometazoline (decongestant).
     * "Panadol cold+flu", "Cold-out" contain Pseudoephedrine or other decongestants + Paracetamol.
     * "Panadol Extra", "Citro-Dol" contain Paracetamol + Caffeine.
     * "Duphaston" contains Dydrogesterone.
     * "Duspatalin" contains Mebeverine.
     * "Atacand" contains Candesartan.
     * "Uvamin" contains Nitrofurantoin.
   - You must check all cart medicines (using both their stated scientific name AND their brand-deduced active ingredient) for contraindications against the patient's condition "${conditionText}" and for drug-drug interactions.
2. If any medicine (either directly by stated scientific name or brand-deduced active ingredient) is contraindicated or unsafe for the patient's condition, set "has_interaction" to true and return details.
3. In "recommended_alternatives", suggest SAFE alternatives from the provided in-stock list (matching by their brand name or scientific name). Ensure the suggested alternatives are safe for this patient condition and do not interact.

Check if:
1. Any medicine in the patient's cart is contraindicated or unsafe for their Special Patient Condition.
2. There are any clinically significant Drug-Drug Interactions (DDI) between any pair of these cart medicines.

Respond ONLY in a structured JSON object with the following schema:
{
  "has_interaction": boolean, // Set to true if there is a drug-drug interaction OR if any drug is unsafe for the patient's special condition
  "severity": "critical" | "warning" | "none",
  "conflicting_drugs": "Specify exactly which specific drugs from the patient's cart are causing the conflict (in Arabic). You MUST state the exact Trade Name / Brand Name of the offending drug(s) as typed in the cart (e.g. 'Ajanta Apcycline-250mg cap' or 'Abbott Brufen 400mg tab') so the pharmacist knows exactly which one to remove or replace. Mention both trade and scientific names.",
  "risks": "Detail the clinical risks and potential harm to the patient/fetus (what could happen to them, in Arabic) for either the DDI or the drug-condition contraindication.",
  "recommended_alternatives": "From the provided list of available in-stock medicines in our pharmacy, list alternative trade name medicines that have the same therapeutic efficacy/class, are SAFE for this patient's special condition, and do NOT conflict with other cart medicines. Format as a clean bulleted list in Arabic."
}

Do not include any markdown format tags like \`\`\`json. Output raw JSON.`;

      const response = await geminiKeyManager.fetchWithRotation(
        (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      if (!response.ok) {
        throw new Error("Failed to call Gemini API");
      }

      const resJson = await response.json();
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const result = JSON.parse(text.trim());
      setDdiResult(result);
    } catch (err) {
      console.error("DDI Check error:", err);
      setDdiResult({
        has_interaction: false,
        severity: 'none',
        message: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي لفحص التداخلات الدوائية."
      });
    } finally {
      setIsCheckingDDI(false);
    }
  };

  // Reset DDI result when cart becomes empty or condition clears
  useEffect(() => {
    if (cart.length === 0) {
      setDdiResult(null);
    }
  }, [cart.length]);

  useEffect(() => {
    if (ddiResult && ddiResult.has_interaction && (ddiResult.severity === 'critical' || ddiResult.severity === 'warning')) {
      setDdiAlertOpen(true);
    } else {
      setDdiAlertOpen(false);
    }
  }, [ddiResult]);

  const handleShowAlternatives = async (med: Medicine) => {
    if (!med.scientific_name) {
      alert("هذا الدواء لا يحتوي على اسم علمي مسجل للبحث عن بدائل.");
      return;
    }
    try {
      const db = await getDb();
      const result = await db.select<Medicine[]>(
        `SELECT m.*, 
         COALESCE((SELECT NULLIF(mb.selling_price, 0) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.price) as price,
         COALESCE((SELECT mb.expiry_date FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.expiry_date) as expiry_date
         FROM medicines m 
         WHERE m.scientific_name = $1 AND m.stock > 0 AND m.id != $2 LIMIT 10`,
        [med.scientific_name, med.id]
      );
      setAlternativesList(result);
      setAlternativeFor(med);
      setAltModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const searchMedicines = async (query: string) => {
    if (!query) {
      setMedicines([]);
      return;
    }
    const db = await getDb();
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      setMedicines([]);
      return;
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const token of tokens) {
      conditions.push(
        `(m.name LIKE $${paramIndex} OR m.scientific_name LIKE $${paramIndex + 1} OR m.barcode LIKE $${paramIndex + 2})`
      );
      const wildcardToken = `%${token}%`;
      params.push(wildcardToken, wildcardToken, wildcardToken);
      paramIndex += 3;
    }

    const whereClause = conditions.join(" AND ");

    const sql = `SELECT m.*, 
       COALESCE((SELECT NULLIF(mb.selling_price, 0) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.price) as price,
       COALESCE((SELECT mb.expiry_date FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.expiry_date) as expiry_date
       FROM medicines m 
       WHERE ${whereClause} LIMIT 100`;

    try {
      const result = await db.select<Medicine[]>(sql, params);
      setMedicines(result);
    } catch (e) {
      console.error("Search query error:", e);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const rawVal = e.currentTarget.value.trim();
    if (e.key === 'Enter' && rawVal) {
      const db = await getDb();
      const result = await db.select<Medicine[]>(
        `SELECT m.*, 
         COALESCE((SELECT NULLIF(mb.selling_price, 0) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.price) as price,
         COALESCE((SELECT mb.expiry_date FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.quantity > 0 ORDER BY mb.expiry_date ASC LIMIT 1), m.expiry_date) as expiry_date
         FROM medicines m 
         WHERE (m.barcode = $1 OR m.name = $1 OR m.scientific_name = $1) LIMIT 1`,
        [rawVal]
      );
      
      if (result.length > 0) {
        if (result[0].stock > 0) {
          addToCart(result[0]);
          setSearchQuery("");
          setMedicines([]);
        } else {
          setMedicines(result);
        }
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

      // Fallback: If there's still quantity remaining to deduct (e.g. no active batches or batches are exhausted),
      // we must still record the sale of the remaining quantity in sale_items using default prices.
      if (remainingToDeduct > 0) {
        await db.execute(
          "INSERT INTO sale_items (sale_id, medicine_id, quantity, unit_price, purchase_price) VALUES ($1, $2, $3, $4, $5)",
          [saleId, item.medicine.id, remainingToDeduct, item.medicine.price, item.medicine.purchase_price || 0]
        );
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
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px', height: 'calc(100vh - 120px)' }}>
      {/* Left Column: Search and Product Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontWeight: 800 }}>نقطة البيع</h2>
            {(cart.length > 1 || (cart.length === 1 && patientCondition !== 'none')) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isCheckingDDI ? (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#f1f5f9', borderRadius: '20px' }}>
                    <span style={{ border: '2px solid #e2e8f0', borderTop: '2px solid var(--primary)', borderRadius: '50%', width: '13px', height: '13px', display: 'inline-block', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                    جاري الفحص...
                  </span>
                ) : ddiResult ? (
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: ddiResult.severity === 'critical' ? '#fee2e2' : ddiResult.severity === 'warning' ? '#fef9c3' : '#dcfce7',
                    color: ddiResult.severity === 'critical' ? '#dc2626' : ddiResult.severity === 'warning' ? '#ca8a04' : '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: ddiResult.has_interaction ? 'pointer' : 'default'
                  }} onClick={() => {
                    if (ddiResult.has_interaction) setDdiAlertOpen(true);
                  }}>
                    {ddiResult.severity === 'critical' ? <ShieldAlert size={14} /> : ddiResult.severity === 'warning' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                    {ddiResult.severity === 'critical' ? 'تداخل حرج!' : ddiResult.severity === 'warning' ? 'تداخل محتمل!' : 'آمن ✓'}
                  </span>
                ) : null}

                {/* Manual check button — shown when no result yet or to re-check */}
                {!isCheckingDDI && (
                  <button
                    onClick={checkDrugInteractions}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: ddiResult ? 'transparent' : 'linear-gradient(135deg, #0d9488, #0891b2)',
                      color: ddiResult ? 'var(--text-muted)' : 'white',
                      border: ddiResult ? '1px solid #e2e8f0' : 'none',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: ddiResult ? 'none' : '0 2px 8px rgba(13,148,136,0.35)'
                    }}
                    onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.04)'; }}
                    onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                    title="فحص التداخلات الدوائية يدوياً"
                  >
                    <ShieldAlert size={13} />
                    {ddiResult ? 'إعادة الفحص' : 'فحص التداخلات'}
                  </button>
                )}
              </div>
            )}
          </div>
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
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: 'var(--primary)', 
                color: 'white', 
                borderRadius: '12px',
                border: 'none',
                boxShadow: 'none',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              <Camera size={18} />
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
              <div className="card" style={{ position: 'absolute', top: '64px', left: 0, right: 0, zIndex: 100, padding: '8px', maxHeight: '400px', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', borderRadius: '16px' }}>
                {medicines.map(med => (
                  <div key={med.id} className="card result-item" style={{ 
                    padding: '16px', 
                    cursor: med.stock > 0 ? 'pointer' : 'default', 
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    transition: 'all 0.2s',
                    opacity: med.stock > 0 ? 1 : 0.85
                  }} onClick={() => { if (med.stock > 0) addToCart(med); }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: med.stock > 0 ? 'var(--text-main)' : '#94a3b8' }}>{med.name}</span>
                        {med.stock === 0 && (
                          <span className="badge badge-error" style={{ fontSize: '10px', padding: '2px 6px' }}>نفد المخزون</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{med.scientific_name}</div>
                      {med.stock > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          صلاحية الوجبة: <span style={{ fontWeight: 700, color: '#e11d48' }}>{med.expiry_date}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{(med.price ?? 0).toLocaleString()} د.ع</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>المتوفر: {med.stock} قطعة</div>
                      </div>
                      {med.stock === 0 && med.scientific_name && (
                        <button 
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowAlternatives(med);
                          }}
                        >
                          🔍 البدائل
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Patient Special Condition selector inside the search card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', direction: 'rtl' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              👩‍⚕️ الحالة الخاصة للمريض:
            </label>
            <select 
              className="input" 
              style={{ flex: 1, borderRadius: '12px', background: '#f2f4f6', border: 'none', height: '48px', fontWeight: 700, direction: 'rtl', paddingRight: '12px', margin: 0 }}
              value={patientCondition}
              onChange={(e) => setPatientCondition(e.target.value)}
            >
              <option value="none">طبيعية (لا توجد حالة خاصة)</option>
              <option value="pregnant">حامل (Pregnancy)</option>
              <option value="breastfeeding">مرضع (Breastfeeding)</option>
              <option value="renal">مريض كلى (Renal Impairment)</option>
              <option value="hepatic">مريض كبد (Hepatic Impairment)</option>
              <option value="diabetic">مريض سكري (Diabetes)</option>
              <option value="hypertension">مريض ضغط دم (Hypertension)</option>
              <option value="htn_diabetes">مريض ضغط وسكري معاً (Hypertension & Diabetes)</option>
              <option value="asthma">مريض ربو (Asthma)</option>
            </select>
          </div>
        </div>

        {/* Drug-Drug Interaction Warning Box */}
        {(cart.length > 1 || (cart.length === 1 && patientCondition !== 'none')) && ddiResult && (
          <div className="card fade-in" style={{ 
            padding: '20px', 
            background: ddiResult.severity === 'critical' ? '#fff5f5' : ddiResult.severity === 'warning' ? '#fefbeb' : '#f0fdf4',
            border: `1px solid ${ddiResult.severity === 'critical' ? '#fee2e2' : ddiResult.severity === 'warning' ? '#fef9c3' : '#dcfce7'}`,
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            direction: 'rtl'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: ddiResult.severity === 'critical' ? '#fee2e2' : ddiResult.severity === 'warning' ? '#fef9c3' : '#dcfce7',
              color: ddiResult.severity === 'critical' ? '#dc2626' : ddiResult.severity === 'warning' ? '#ca8a04' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {ddiResult.severity === 'critical' ? <ShieldAlert size={20} /> : ddiResult.severity === 'warning' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ 
                margin: '0 0 4px 0', 
                fontWeight: 800, 
                fontSize: '0.95rem',
                color: ddiResult.severity === 'critical' ? '#991b1b' : ddiResult.severity === 'warning' ? '#854d0e' : '#166534'
              }}>
                {ddiResult.severity === 'critical' ? 'تنبيه: تداخل دوائي حرج!' : ddiResult.severity === 'warning' ? 'تحذير: تداخل دوائي محتمل' : 'الفحص السريري للتداخلات الدوائية'}
              </h4>
              
              {ddiResult.has_interaction ? (
                <div style={{ display: 'grid', gap: '8px', marginTop: '8px', textAlign: 'right' }}>
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>الأدوية المتعارضة:</strong>
                    <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '2px', fontWeight: 700 }}>{ddiResult.conflicting_drugs}</div>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>الأضرار والخطورة:</strong>
                    <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>{ddiResult.risks}</div>
                  </div>
                  {ddiResult.recommended_alternatives && (
                    <div>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>البدائل المقترحة (في المخزن):</strong>
                      <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '2px', fontWeight: 600, whiteSpace: 'pre-line' }}>{ddiResult.recommended_alternatives}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.85rem', 
                  lineHeight: '1.5',
                  color: ddiResult.severity === 'critical' ? '#dc2626' : ddiResult.severity === 'warning' ? '#ca8a04' : '#166534'
                }}>
                  {ddiResult.message}
                </p>
              )}
            </div>
          </div>
        )}

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
                      <div>{(item.lineTotal ?? 0).toLocaleString()} د.ع</div>
                      {item.quantity > 1 && (item.lineTotal / item.quantity).toFixed(0) !== (item.medicine.price ?? 0).toString() && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--secondary)', opacity: 0.8 }}>* سعر مختلط (وجبات متعددة)</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <button 
                        className="btn-icon" 
                        style={{ 
                          color: '#ef4444', 
                          background: 'rgba(239, 68, 68, 0.08)', 
                          border: 'none',
                          borderRadius: '12px',
                          width: '36px',
                          height: '36px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          marginRight: 'auto'
                        }} 
                        onClick={() => removeFromCart(item.medicine.id)}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
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

        <div className="card">
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
        </div>
      </div>

      {/* Alternatives Suggestions Modal */}
      {alternativeFor && (
        <Modal
          isOpen={altModalOpen}
          onClose={() => {
            setAltModalOpen(false);
            setAlternativeFor(null);
          }}
          title={`البدائل العلمية المتاحة لـ: ${alternativeFor.name}`}
        >
          <div style={{ direction: 'rtl' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              الاسم العلمي: <strong style={{ color: 'var(--primary)' }}>{alternativeFor.scientific_name}</strong>
            </p>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {alternativesList.map(alt => (
                <div key={alt.id} style={{
                  padding: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{alt.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      الصلاحية: <strong style={{ color: '#e11d48' }}>{alt.expiry_date}</strong> | المتوفر: {alt.stock} قطعة
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>{(alt.price ?? 0).toLocaleString()} د.ع</span>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem' }}
                      onClick={() => {
                        addToCart(alt);
                        setAltModalOpen(false);
                        setAlternativeFor(null);
                      }}
                    >
                      إضافة للسلة
                    </button>
                  </div>
                </div>
              ))}
              {alternativesList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-slate)', background: '#f8fafc', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                  لا توجد بدائل علمية أخرى متوفرة في المخزن حالياً لهذا الاسم العلمي.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Drug-Drug Interaction Alert Popup Modal */}
      {ddiResult && (
        <Modal
          isOpen={ddiAlertOpen}
          onClose={() => setDdiAlertOpen(false)}
          title={ddiResult.severity === 'critical' ? "🚨 تحذير سريري حرج جداً" : "⚠️ تنبيه تداخل دوائي محتمل"}
        >
          <div style={{ direction: 'rtl', padding: '12px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: ddiResult.severity === 'critical' ? '#fee2e2' : '#fef9c3',
              color: ddiResult.severity === 'critical' ? '#dc2626' : '#ca8a04',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <ShieldAlert size={36} />
            </div>

            {ddiResult.has_interaction ? (
              <div style={{ display: 'grid', gap: '20px', textAlign: 'right', marginBottom: '32px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '8px' }}>🔍 1. الأدوية المتعارضة علمياً:</h4>
                  <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 700, paddingRight: '8px' }}>
                    {ddiResult.conflicting_drugs}
                  </div>
                </div>

                <div style={{ background: '#fff5f5', padding: '16px', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#991b1b', marginBottom: '8px' }}>❌ 2. الأضرار والخطورة على المريض:</h4>
                  <div style={{ fontSize: '0.9rem', color: '#dc2626', fontWeight: 600, paddingRight: '8px', lineHeight: '1.6' }}>
                    {ddiResult.risks}
                  </div>
                </div>

                {ddiResult.recommended_alternatives && (
                  <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                    <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#166534', marginBottom: '8px' }}>✅ 3. البدائل الآمنة المقترحة (المتوفرة بمخزنك):</h4>
                    <div style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 600, paddingRight: '8px', whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                      {ddiResult.recommended_alternatives}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ 
                fontSize: '1.05rem', 
                lineHeight: '1.7', 
                color: 'var(--text-main)', 
                fontWeight: 600,
                marginBottom: '32px',
                textAlign: 'center'
              }}>
                {ddiResult.message}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ 
                  height: '48px', 
                  padding: '0 48px', 
                  fontWeight: 700, 
                  background: ddiResult.severity === 'critical' ? '#dc2626' : 'var(--primary)',
                  border: 'none',
                  borderRadius: '12px'
                }}
                onClick={() => setDdiAlertOpen(false)}
              >
                موافق، فهمت المخاطر
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
