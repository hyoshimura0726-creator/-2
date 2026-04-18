import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calculator, Plus, Trash2, TrendingDown, TrendingUp, Receipt, Search, Filter, Undo, Settings, X, Edit2, Check, GripVertical, BarChart2, RefreshCw,
  Coffee, Home, Zap, Wifi, ShoppingCart, Car, Gift, HeartPulse, Wallet, Briefcase, HelpCircle, Smartphone, Monitor, BookOpen, Plane, Utensils, Music, Scissors, Dumbbell, Upload, FileText, Camera, Loader2, Mic, MicOff,
  Baby, Dog, Cat, Gamepad2, Tv, Sofa, Ticket, Clapperboard, Trophy, Pizza, GlassWater, GraduationCap, Pill, Stethoscope, Wrench, Umbrella, Smile, Star, Heart, Bus, Train, Bike, Palmtree, Tent, Shirt, Sparkles, Droplet, Flame, Key, Bath
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";

const ICON_MAP: Record<string, React.ElementType> = {
  Coffee, Home, Zap, Wifi, ShoppingCart, Car, Gift, HeartPulse, Wallet, Briefcase, HelpCircle, Smartphone, Monitor, BookOpen, Plane, Utensils, Music, Scissors, Dumbbell,
  Baby, Dog, Cat, Gamepad2, Tv, Sofa, Ticket, Clapperboard, Trophy, Pizza, GlassWater, GraduationCap, Pill, Stethoscope, Wrench, Umbrella, Smile, Star, Heart, Bus, Train, Bike, Palmtree, Tent, Shirt, Sparkles, Droplet, Flame, Key, Bath
};

type CategoryType = 'expense' | 'income';
type RecurringFrequency = 'none' | 'weekly' | 'monthly' | 'yearly';

type Category = {
  name: string;
  type: CategoryType;
  icon?: string;
};

type Transaction = {
  id: string;
  date: string;
  amount: number;
  category: string;
  memo: string;
  type: CategoryType;
  recurringFrequency?: RecurringFrequency;
  nextRecurringDate?: string | null;
};

const getNextDate = (dateStr: string, freq: RecurringFrequency): string => {
  const d = new Date(dateStr);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

const DEFAULT_CATEGORIES: Category[] = [
  { name: '食費', type: 'expense', icon: 'Utensils' },
  { name: '家賃', type: 'expense', icon: 'Home' },
  { name: '水道光熱費', type: 'expense', icon: 'Zap' },
  { name: '通信費', type: 'expense', icon: 'Wifi' },
  { name: '日用品', type: 'expense', icon: 'ShoppingCart' },
  { name: '交通費', type: 'expense', icon: 'Car' },
  { name: '交際費', type: 'expense', icon: 'Gift' },
  { name: '医療費', type: 'expense', icon: 'HeartPulse' },
  { name: '給与', type: 'income', icon: 'Wallet' },
  { name: 'その他', type: 'expense', icon: 'HelpCircle' }
];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('smart-ledger-data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((t: any) => ({
          ...t,
          type: t.type || 'expense'
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('smart-ledger-categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          // Migrate old string array to Category array
          return [
            ...parsed.map((name: string) => ({ name, type: 'expense' as CategoryType, icon: 'HelpCircle' })),
            { name: '給与', type: 'income' as CategoryType, icon: 'Wallet' }
          ];
        }
        return parsed.map((c: any) => ({ ...c, icon: c.icon || 'HelpCircle' }));
      } catch (e) {
        return DEFAULT_CATEGORIES;
      }
    }
    return DEFAULT_CATEGORIES;
  });

  const [txType, setTxType] = useState<CategoryType>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [memo, setMemo] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('none');

  // Update selected category when txType or categories change
  useEffect(() => {
    const availableCategories = categories.filter(c => c.type === txType);
    if (!availableCategories.find(c => c.name === category)) {
      setCategory(availableCategories[0]?.name || '');
    }
  }, [txType, categories, category]);

  // Receipt Scanning State
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Category Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvRawData, setCsvRawData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState({ date: -1, amount: -1, memo: -1 });
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('expense');
  const [newCategoryIcon, setNewCategoryIcon] = useState<string>('HelpCircle');
  const [editingCategory, setEditingCategory] = useState<{old: string, new: string, type: CategoryType, icon: string} | null>(null);

  const [showNewIconPicker, setShowNewIconPicker] = useState(false);
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);

  // Edit Transaction State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Undo state
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[] | null>(null);

  // Budget State
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    const saved = localStorage.getItem('smart-ledger-budget');
    return saved ? Number(saved) : 0;
  });
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState('');

  useEffect(() => {
    localStorage.setItem('smart-ledger-budget', monthlyBudget.toString());
  }, [monthlyBudget]);

  const saveBudget = () => {
    const parsed = Number(tempBudget);
    if (!isNaN(parsed) && parsed >= 0) {
      setMonthlyBudget(parsed);
    }
    setIsEditingBudget(false);
  };

  useEffect(() => {
    localStorage.setItem('smart-ledger-data', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('smart-ledger-categories', JSON.stringify(categories));
  }, [categories]);

  // Auto-generate recurring transactions
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    let changed = false;
    const newTxs: Transaction[] = [];
    
    for (const tx of transactions) {
      if (tx.recurringFrequency && tx.recurringFrequency !== 'none' && tx.nextRecurringDate && tx.nextRecurringDate <= today) {
        changed = true;
        
        let currentDate = tx.nextRecurringDate;
        let currentFreq = tx.recurringFrequency;
        
        // Add the original transaction, but strip its recurring status
        newTxs.push({ ...tx, recurringFrequency: 'none', nextRecurringDate: null });
        
        // Spawn new transactions until we pass today
        while (currentDate <= today) {
          const nextDate = getNextDate(currentDate, currentFreq);
          
          if (nextDate <= today) {
              // Spawn an intermediate transaction that also doesn't recur
              newTxs.push({
                  ...tx,
                  id: crypto.randomUUID(),
                  date: currentDate,
                  recurringFrequency: 'none',
                  nextRecurringDate: null
              });
          } else {
              // Spawn the final active recurring transaction
              newTxs.push({
                  ...tx,
                  id: crypto.randomUUID(),
                  date: currentDate,
                  recurringFrequency: currentFreq,
                  nextRecurringDate: nextDate
              });
          }
          currentDate = nextDate;
        }
      } else {
        newTxs.push(tx);
      }
    }

    if (changed) {
      newTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(newTxs);
    }
  }, [transactions]);

  const addCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed && !categories.find(c => c.name === trimmed)) {
      setCategories([...categories, { name: trimmed, type: newCategoryType, icon: newCategoryIcon }]);
      setNewCategoryName('');
      setNewCategoryIcon('HelpCircle');
    }
  };

  const deleteCategory = (catName: string) => {
    const newCategories = categories.filter(c => c.name !== catName);
    setCategories(newCategories);
    if (category === catName) {
      const available = newCategories.filter(c => c.type === txType);
      setCategory(available[0]?.name || '');
    }
    if (filterCategory === catName) setFilterCategory('');
  };

  const saveEditCategory = () => {
    if (!editingCategory) return;
    const oldName = editingCategory.old;
    const newName = editingCategory.new.trim();
    const newType = editingCategory.type;
    const newIcon = editingCategory.icon;
    
    if (newName && (newName === oldName || !categories.find(c => c.name === newName))) {
      setCategories(categories.map(c => c.name === oldName ? { name: newName, type: newType, icon: newIcon } : c));
      
      // Update existing transactions to reflect the new category name and type
      setPreviousTransactions(transactions);
      setTransactions(transactions.map(t => t.category === oldName ? { ...t, category: newName, type: newType } : t));
      
      if (category === oldName) setCategory(newName);
      if (filterCategory === oldName) setFilterCategory(newName);
    }
    setEditingCategory(null);
  };

  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedCategoryIndex === null || draggedCategoryIndex === dropIndex) return;

    const newCategories = [...categories];
    const draggedItem = newCategories[draggedCategoryIndex];
    newCategories.splice(draggedCategoryIndex, 1);
    newCategories.splice(dropIndex, 0, draggedItem);
    
    setCategories(newCategories);
    setDraggedCategoryIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedCategoryIndex(null);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingReceipt(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = (event.target?.result as string).split(',')[1];
          
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64Data,
                  },
                },
                {
                  text: "Analyze this receipt and extract the following information. Return ONLY a JSON object.",
                },
              ],
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  date: {
                    type: Type.STRING,
                    description: "The date of the receipt in YYYY-MM-DD format. If not found, return empty string.",
                  },
                  mainPurchasedItems: {
                    type: Type.STRING,
                    description: "A short summary of the main items purchased (e.g., 'コーヒーとサンドイッチ', '日用品一式', '切符'). If unable to read items, return the store name instead.",
                  },
                  totalAmount: {
                    type: Type.NUMBER,
                    description: "The total amount paid. Return as a number. If not found, return 0.",
                  },
                  category: {
                    type: Type.STRING,
                    description: "The category of the purchase.",
                  }
                },
                required: ["date", "mainPurchasedItems", "totalAmount", "category"]
              }
            }
          });

          const resultText = response.text;
          if (resultText) {
            const parsed = JSON.parse(resultText);
            
            if (parsed.date) {
              const d = new Date(parsed.date);
              if (!isNaN(d.getTime())) {
                setDate(d.toISOString().split('T')[0]);
              }
            }
            if (parsed.totalAmount) {
              setAmount(parsed.totalAmount.toString());
            }
            if (parsed.mainPurchasedItems) {
              setMemo(parsed.mainPurchasedItems);
              autoSelectCategory(parsed.mainPurchasedItems);
            }
            if (!category && parsed.category) {
              // Try to find a matching category only if autoSelectCategory didn't already pick one
              const matchedCategory = categories.find(c => c.type === 'expense' && (c.name.includes(parsed.category) || parsed.category.includes(c.name)));
              if (matchedCategory) {
                setCategory(matchedCategory.name);
              }
            }
            setTxType('expense'); // Receipts are usually expenses
          }
        } catch (error) {
          console.error("Error analyzing receipt:", error);
          alert("レシートの解析に失敗しました。");
        } finally {
          setIsAnalyzingReceipt(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error reading file:", error);
      setIsAnalyzingReceipt(false);
    }
  };

  const autoSelectCategory = (text: string) => {
    if (!text) return;

    // 1. 判定用キーワード辞書（優先順位：上から順）
    const KEYWORD_DICT = [
      { name: '自己投資', aliases: ['教材', '教育'], keywords: ['参考書', '本', '文房具', '受験料', '模試', '書籍', '勉強', '資格'] },
      { name: '固定費', aliases: ['家賃', '光熱費', '通信費'], keywords: ['家賃', '電気', '水道', 'ガス', '光熱費', 'ネット', 'スマホ', 'すまほ', '携帯', 'サブスク', 'アマプラ', '保険'] },
      { name: '医療・健康', aliases: ['医療費', '健康'], keywords: ['病院', '歯医者', 'サプリ', 'プロテイン', 'ジム', 'マッサージ', '薬局'] },
      { name: '美容・衣服', aliases: ['美容', '衣服', '被服費'], keywords: ['美容院', 'カット', '服', 'ユニクロ', 'コスメ', '散髪'] },
      { name: '交際・娯楽', aliases: ['交際費', '娯楽', '趣味'], keywords: ['飲み会', '映画', 'プレゼント', 'カラオケ', '旅行', '趣味', 'ゲーセン', '遊び'] },
      { name: '交通費', aliases: ['交通', '旅費'], keywords: ['電車', 'バス', 'タクシー', 'ガソリン', '駐車場', '切符', 'Suica', 'SUICA', 'suica', 'ICOCA', 'icoca', 'スイカ', 'イコカ'] },
      { name: '日用品', aliases: ['生活用品', '雑貨'], keywords: ['洗剤', 'ティッシュ', '薬', 'ドラッグストア', 'シャンプー', 'ゴミ袋', '100均', '１００均', '百均', 'ひゃっきん'] },
      { name: '食費', aliases: ['飲食'], keywords: ['ランチ', 'カフェ', 'スーパー', 'コンビニ', 'ご飯', '外食', '弁当', 'スタバ', 'マクド', 'マック', '自炊'] },
    ];

    const lowerText = text.toLowerCase();

    for (const group of KEYWORD_DICT) {
      if (group.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
        // キーワードに合致した場合、既存のカテゴリから最適なものを探す
        const searchNames = [group.name, ...(group.aliases || [])];
        const catExists = categories.find(c => 
          c.type === 'expense' && 
          searchNames.some(searchName => c.name.includes(searchName) || searchName.includes(c.name))
        );

        if (catExists) {
          setCategory(catExists.name);
          setTxType('expense');
          return;
        } else {
          // もし完全な一致項目がなくても「未分類」を設定して終了することもできるが、
          // 利便性のために存在するカテゴリの先頭をセットするか、そのまま（何もしない）にする。
          // リクエスト通り「変更しない」なら `return;` を実行。
          return; 
        }
      }
    }
  };

  const toggleSpeechInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('お使いのブラウザは音声入力に対応していません。Chrome、Safari、Edgeなどの最新版をご利用ください。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('Speech result:', transcript);
      
      // Convert Amount
      let parsedAmount = '';
      const amountMatch = transcript.match(/([0-9０-９,，]+)\s*円/);
      let parsedMemo = transcript;

      if (amountMatch) {
        // Convert full-width to half-width and remove commas
        const numStr = amountMatch[1].replace(/[０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/[,，]/g, '');
        parsedAmount = numStr;
        setAmount(numStr);
        // Remove the amount text from memo
        parsedMemo = parsedMemo.replace(amountMatch[0], '').trim();
      }

      setMemo(parsedMemo);
      // Auto-categorize based on memo content
      autoSelectCategory(parsedMemo);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            currentVal += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentVal += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(currentVal);
          currentVal = '';
        } else if (char === '\n' || char === '\r') {
          row.push(currentVal);
          if (row.some(v => v.trim() !== '')) {
            result.push(row);
          }
          row = [];
          currentVal = '';
          if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
            i++;
          }
        } else {
          currentVal += char;
        }
      }
    }
    if (currentVal || row.length > 0) {
      row.push(currentVal);
      if (row.some(v => v.trim() !== '')) {
        result.push(row);
      }
    }
    return result;
  };

  const generatePreview = (dataRows: string[][], mapping: { date: number, amount: number, memo: number }) => {
    const preview = dataRows.map((row, index) => {
      let rawDate = row[mapping.date] || '';
      let formattedDate = rawDate;
      const dateMatch = rawDate.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (dateMatch) {
        formattedDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      } else if (!isNaN(Date.parse(rawDate))) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      }

      let rawAmount = row[mapping.amount] || '0';
      let amountNum = Number(rawAmount.replace(/,/g, ''));
      if (isNaN(amountNum)) amountNum = 0;

      const type: CategoryType = amountNum < 0 ? 'expense' : 'expense';
      const absAmount = Math.abs(amountNum);

      return {
        id: `csv-${index}`,
        selected: true,
        date: formattedDate,
        amount: absAmount,
        memo: row[mapping.memo] || '',
        type: type,
        category: categories.find(c => c.type === type)?.name || '',
      };
    });
    setCsvPreview(preview);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        const headers = parsed[0];
        const dataRows = parsed.slice(1);
        setCsvHeaders(headers);
        setCsvRawData(dataRows);

        let dateIdx = -1;
        let amountIdx = -1;
        let memoIdx = -1;

        headers.forEach((header, idx) => {
          const h = header.toLowerCase();
          if (h.includes('日') || h.includes('date')) dateIdx = idx;
          else if (h.includes('金') || h.includes('amount') || h.includes('円')) amountIdx = idx;
          else if (h.includes('内容') || h.includes('摘要') || h.includes('memo') || h.includes('店') || h.includes('名')) memoIdx = idx;
        });

        const firstRow = dataRows[0];
        if (dateIdx === -1 && firstRow) {
          dateIdx = firstRow.findIndex(val => !isNaN(Date.parse(val)) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(val));
        }
        if (amountIdx === -1 && firstRow) {
          amountIdx = firstRow.findIndex((val, idx) => idx !== dateIdx && !isNaN(Number(val.replace(/,/g, ''))));
        }
        if (memoIdx === -1 && firstRow) {
          memoIdx = firstRow.findIndex((val, idx) => idx !== dateIdx && idx !== amountIdx && isNaN(Number(val)));
        }

        const mapping = {
          date: dateIdx !== -1 ? dateIdx : 0,
          amount: amountIdx !== -1 ? amountIdx : 1,
          memo: memoIdx !== -1 ? memoIdx : 2,
        };
        setCsvMapping(mapping);
        generatePreview(dataRows, mapping);
      }
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (field: 'date' | 'amount' | 'memo', value: number) => {
    const newMapping = { ...csvMapping, [field]: value };
    setCsvMapping(newMapping);
    generatePreview(csvRawData, newMapping);
  };

  const handlePreviewChange = (id: string, field: string, value: any) => {
    setCsvPreview(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'type') {
          updated.category = categories.find(c => c.type === value)?.name || '';
        }
        return updated;
      }
      return item;
    }));
  };

  const importCsvTransactions = () => {
    const newTransactions = csvPreview
      .filter(item => item.selected)
      .map(item => ({
        id: crypto.randomUUID(),
        date: item.date,
        amount: item.amount,
        category: item.category,
        memo: item.memo,
        type: item.type,
      }));
    
    if (newTransactions.length > 0) {
      setPreviousTransactions(transactions);
      setTransactions(prev => [...prev, ...newTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
    setIsCsvModalOpen(false);
    setCsvRawData([]);
    setCsvPreview([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      date,
      amount: Number(amount),
      category,
      memo,
      type: txType,
      recurringFrequency,
      nextRecurringDate: recurringFrequency !== 'none' ? getNextDate(date, recurringFrequency) : null
    };

    setPreviousTransactions(transactions);
    setTransactions(prev => [newTx, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    
    setAmount('');
    setMemo('');
    setRecurringFrequency('none');
  };

  const handleDelete = (id: string) => {
    setPreviousTransactions(transactions);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleUndo = () => {
    if (previousTransactions) {
      setTransactions(previousTransactions);
      setPreviousTransactions(null);
    }
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchQuery = searchQuery === '' || 
        tx.memo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = filterCategory === '' || tx.category === filterCategory;
      const matchStartDate = startDate === '' || tx.date >= startDate;
      const matchEndDate = endDate === '' || tx.date <= endDate;
      
      return matchQuery && matchCategory && matchStartDate && matchEndDate;
    });
  }, [transactions, searchQuery, filterCategory, startDate, endDate]);

  const chartData = useMemo(() => {
    const dataMap = new Map<string, { income: number, expense: number }>();
    const today = new Date();
    
    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;
      dataMap.set(monthStr, { income: 0, expense: 0 });
    }

    filteredTransactions.forEach(tx => {
      const monthStr = tx.date.slice(0, 7);
      if (dataMap.has(monthStr)) {
        const current = dataMap.get(monthStr)!;
        if (tx.type === 'income') {
          current.income += tx.amount;
        } else {
          current.expense += tx.amount;
        }
      }
    });

    return Array.from(dataMap.entries()).map(([month, data]) => ({
      month: month.replace('-', '/'),
      shortMonth: parseInt(month.split('-')[1], 10) + '月',
      income: data.income,
      expense: data.expense
    }));
  }, [filteredTransactions]);

  const monthlyStats = useMemo(() => {
    const currentMonthTxs = transactions.filter(t => t.date.startsWith(currentMonth));
    const income = currentMonthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = currentMonthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense };
  }, [transactions, currentMonth]);

  const budgetPercent = monthlyBudget > 0 ? (monthlyStats.expense / monthlyBudget) * 100 : 0;

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(num);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans text-[#141414] p-4 md:p-8 flex justify-center items-start">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Calculator/Input */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Header */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-[#141414] text-[#E4E3E0] rounded-lg flex items-center justify-center shadow-md">
              <Calculator size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Smart Ledger</h1>
              <p className="text-xs font-mono opacity-60 uppercase tracking-widest">Accounting Tool</p>
            </div>
          </div>

          {/* Display Screen (Monthly Total) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#141414] text-[#E4E3E0] rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
              <div className="absolute -right-4 -top-4 p-4 opacity-5">
                <TrendingUp size={100} />
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-mono opacity-70 mb-1 uppercase tracking-widest flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                  {currentMonth.replace('-', '年 ')}月 合計収入
                </p>
                <div className="font-mono text-2xl sm:text-3xl font-light tracking-tight break-all">
                  {formatCurrency(monthlyStats.income)}
                </div>
              </div>
            </div>
            <div className="bg-[#141414] text-[#E4E3E0] rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-4 -top-4 p-4 opacity-5">
                <TrendingDown size={100} />
              </div>
              <div className="relative z-10 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-mono opacity-70 uppercase tracking-widest flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2 animate-pulse"></span>
                      合計支出
                    </p>
                    {isEditingBudget ? (
                      <div className="flex items-center gap-1 z-20 relative">
                        <input 
                          type="number" 
                          value={tempBudget} 
                          onChange={(e) => setTempBudget(e.target.value)}
                          className="bg-gray-800 text-xs text-white px-2 py-0.5 rounded w-20 outline-none focus:ring-1 focus:ring-white border border-gray-700 font-mono"
                          autoFocus
                          placeholder="予算"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveBudget();
                            if (e.key === 'Escape') setIsEditingBudget(false);
                          }}
                        />
                        <button onClick={saveBudget} className="text-[10px] bg-white text-[#141414] px-2 py-1 rounded font-bold hover:bg-gray-200 transition-colors">保存</button>
                      </div>
                    ) : (
                      <button onClick={() => { setIsEditingBudget(true); setTempBudget(monthlyBudget > 0 ? monthlyBudget.toString() : ''); }} className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1 z-20 relative">
                        <Edit2 size={10} /> 予算: {monthlyBudget > 0 ? formatCurrency(monthlyBudget) : '未設定'}
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-2xl sm:text-3xl font-light tracking-tight break-all mb-3">
                    {formatCurrency(monthlyStats.expense)}
                  </div>
                </div>
                
                {/* Progress Bar */}
                {monthlyBudget > 0 && (
                  <div className="w-full mt-auto">
                    <div className="flex justify-between text-[10px] font-mono mb-1.5">
                      <span className="opacity-70">予算消化率</span>
                      <span className={budgetPercent >= 100 ? "text-red-400 font-bold" : budgetPercent >= 80 ? "text-yellow-400 font-bold" : "text-green-400"}>
                        {budgetPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          budgetPercent >= 100 ? "bg-red-500" : budgetPercent >= 80 ? "bg-yellow-400" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input Keypad/Form */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                <Plus size={14} className="mr-1" /> Entry Form
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={toggleSpeechInput}
                  className={`transition-colors flex items-center gap-1 px-2 py-1 rounded-md ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-[#141414] bg-gray-50 hover:bg-gray-100'}`}
                >
                  {isListening ? <MicOff size={12} /> : <Mic size={12} />} 
                  <span className="text-[10px] font-bold">{isListening ? '聞き取り中...' : '音声入力'}</span>
                </button>
                <label className="cursor-pointer text-gray-400 hover:text-[#141414] transition-colors flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-md">
                  <Camera size={12} /> <span className="text-[10px] font-bold">レシート</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptUpload} />
                </label>
                <button 
                  type="button" 
                  onClick={() => setIsCsvModalOpen(true)}
                  className="text-gray-400 hover:text-[#141414] transition-colors flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-md hidden sm:flex"
                >
                  <Upload size={12} /> <span className="text-[10px] font-bold">CSV読込</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-gray-400 hover:text-[#141414] transition-colors flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-md"
                >
                  <Settings size={12} /> <span className="text-[10px] font-bold">科目設定</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => setTxType('expense')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${txType === 'expense' ? 'bg-white shadow-sm text-[#141414]' : 'text-gray-400 hover:text-gray-600'}`}>支出 (Expense)</button>
                <button type="button" onClick={() => setTxType('income')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${txType === 'income' ? 'bg-white shadow-sm text-[#141414]' : 'text-gray-400 hover:text-gray-600'}`}>収入 (Income)</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">金額 (Amount)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-lg">¥</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent font-mono text-2xl transition-all"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">日付 (Date)</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent font-mono text-sm transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">科目 (Category)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      {React.createElement(ICON_MAP[categories.find(c => c.name === category)?.icon || 'HelpCircle'] || HelpCircle, { size: 16 })}
                    </div>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent text-sm font-medium transition-all appearance-none min-h-[44px]"
                    >
                      {categories.filter(c => c.type === txType).map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">摘要 (Memo)</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={e => {
                      setMemo(e.target.value);
                      autoSelectCategory(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent text-sm transition-all min-h-[44px]"
                    placeholder="詳細を入力..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">繰り返し (Recurring)</label>
                  <select
                    value={recurringFrequency}
                    onChange={e => setRecurringFrequency(e.target.value as RecurringFrequency)}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent text-sm font-medium transition-all appearance-none min-h-[44px]"
                  >
                    <option value="none">なし (None)</option>
                    <option value="weekly">毎週 (Weekly)</option>
                    <option value="monthly">毎月 (Monthly)</option>
                    <option value="yearly">毎年 (Yearly)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#141414] hover:bg-black text-white font-bold py-3.5 rounded-xl flex items-center justify-center space-x-2 transition-transform active:scale-[0.98] mt-2 shadow-md"
              >
                <span>登録 (ENTER)</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Ledger Tape */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full min-h-[500px] flex flex-col overflow-hidden">
            <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#141414]">
                <Receipt size={18} />
                <h2 className="font-bold tracking-wide">仕訳帳 (General Journal)</h2>
              </div>
              <div className="flex items-center space-x-2">
                {previousTransactions && (
                  <button 
                    onClick={handleUndo}
                    className="flex items-center space-x-1 text-xs font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors active:scale-95"
                    title="Undo last action"
                  >
                    <Undo size={12} />
                    <span>UNDO</span>
                  </button>
                )}
                <div className="text-xs text-gray-500 font-mono bg-gray-200 px-2 py-1 rounded">
                  {filteredTransactions.length} ENTRIES
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white px-4 sm:px-6 py-3 border-b border-gray-200 flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="キーワード検索..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent transition-all min-h-[44px] sm:min-h-0"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="text-gray-400 hidden sm:block" size={16} />
                <select 
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent transition-all appearance-none min-h-[44px] sm:min-h-0"
                >
                  <option value="">すべての科目</option>
                  {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 sm:flex-none px-2 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent transition-all min-h-[44px] sm:min-h-0"
                />
                <span className="text-gray-400">-</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 sm:flex-none px-2 py-3 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#141414] focus:border-transparent transition-all min-h-[44px] sm:min-h-0"
                />
              </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white px-4 sm:px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <BarChart2 size={14} className="text-gray-400" />
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Monthly Trends (Last 12 Months)</h3>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis 
                      dataKey="shortMonth" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af' }} 
                      dy={10}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f3f4f6' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#141414] text-white text-xs py-2 px-3 rounded-lg shadow-xl font-mono">
                              <div className="text-gray-400 mb-1">{payload[0].payload.month}</div>
                              {payload.map((entry: any) => (
                                <div key={entry.dataKey} className="flex justify-between gap-4">
                                  <span className="opacity-70">{entry.dataKey === 'income' ? '収入' : '支出'}</span>
                                  <span className="font-bold" style={{ color: entry.color }}>{formatCurrency(entry.value)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="income" fill="#9ca3af" radius={[2, 2, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="expense" fill="#141414" radius={[2, 2, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              {transactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12">
                  <Receipt size={48} className="text-gray-200 mb-4" strokeWidth={1} />
                  <p className="font-medium">データがありません</p>
                  <p className="text-sm mt-1 opacity-70">左のフォームから取引を入力してください</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12">
                  <Search size={48} className="text-gray-200 mb-4" strokeWidth={1} />
                  <p className="font-medium">一致するデータが見つかりません</p>
                  <p className="text-sm mt-1 opacity-70">検索条件を変更してください</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${tx.type === 'income' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {React.createElement(ICON_MAP[categories.find(c => c.name === tx.category)?.icon || 'HelpCircle'] || HelpCircle, { size: 14 })}
                            {tx.category}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
                            {tx.date.replace(/-/g, '/')}
                            {tx.recurringFrequency && tx.recurringFrequency !== 'none' && (
                              <RefreshCw size={12} className="text-blue-500" title={`繰り返し: ${tx.recurringFrequency}`} />
                            )}
                          </div>
                        </div>
                        <div className={`text-base sm:text-lg font-mono font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-[#141414]'}`}>
                          {tx.type === 'income' ? '+' : ''}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600 truncate pr-4 flex-1">
                          {tx.memo || <span className="text-gray-300 italic">No memo</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingTx(tx)}
                            className="text-gray-400 hover:text-[#141414] hover:bg-gray-200 p-2 rounded-lg transition-all active:scale-95"
                            title="編集"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all active:scale-95"
                            title="削除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-gray-500" />
                <h3 className="font-bold text-[#141414] tracking-wide">科目設定 (Categories)</h3>
              </div>
              <button 
                onClick={() => setIsCategoryModalOpen(false)} 
                className="text-gray-400 hover:text-[#141414] hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* Add new category */}
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex gap-2">
                  <select
                    value={newCategoryType}
                    onChange={e => setNewCategoryType(e.target.value as CategoryType)}
                    className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#141414] transition-all"
                  >
                    <option value="expense">支出</option>
                    <option value="income">収入</option>
                  </select>
                  <button 
                    onClick={() => setShowNewIconPicker(!showNewIconPicker)}
                    className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl px-3 hover:bg-gray-100 transition-colors"
                    title="アイコンを選択"
                  >
                    <div className="text-gray-500 pointer-events-none">
                      {React.createElement(ICON_MAP[newCategoryIcon] || ICON_MAP['HelpCircle'], { size: 16 })}
                    </div>
                  </button>
                  <input 
                    type="text" 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCategory()}
                    placeholder="新しい科目名..."
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#141414] transition-all"
                  />
                  <button 
                    onClick={addCategory} 
                    disabled={!newCategoryName.trim()}
                    className="px-4 py-2.5 bg-[#141414] text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    追加
                  </button>
                </div>
                
                {showNewIconPicker && (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl max-h-40 overflow-y-auto">
                    {Object.keys(ICON_MAP).map(icon => (
                      <button 
                        key={icon} 
                        onClick={() => { setNewCategoryIcon(icon); setShowNewIconPicker(false); }} 
                        className={`p-2 rounded-lg transition-colors ${newCategoryIcon === icon ? 'bg-[#141414] text-white' : 'hover:bg-gray-200 text-gray-500'}`}
                      >
                         {React.createElement(ICON_MAP[icon], { size: 18 })}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">登録済みの科目</h4>
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">科目がありません</p>
                ) : (
                  categories.map((cat, index) => (
                    <div 
                      key={cat.name} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center justify-between p-3 bg-white border shadow-sm rounded-xl group transition-all ${draggedCategoryIndex === index ? 'opacity-50 border-dashed border-gray-400' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      {editingCategory?.old === cat.name ? (
                        <div className="flex flex-col gap-2 flex-1">
                          <div className="flex items-center gap-2">
                            <select
                              value={editingCategory.type}
                              onChange={e => setEditingCategory({...editingCategory, type: e.target.value as CategoryType})}
                              className="px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]"
                            >
                              <option value="expense">支出</option>
                              <option value="income">収入</option>
                            </select>
                            <button
                              onClick={() => setShowEditIconPicker(!showEditIconPicker)}
                              className="flex items-center justify-center bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition-colors"
                            >
                              <div className="text-gray-500 pointer-events-none">
                                {React.createElement(ICON_MAP[editingCategory.icon] || ICON_MAP['HelpCircle'], { size: 14 })}
                              </div>
                            </button>
                            <input 
                              type="text"
                              value={editingCategory.new}
                              onChange={e => setEditingCategory({...editingCategory, new: e.target.value})}
                              onKeyDown={e => e.key === 'Enter' && saveEditCategory()}
                              className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]"
                              autoFocus
                            />
                            <button onClick={saveEditCategory} className="p-2 text-white bg-[#141414] hover:bg-black rounded-lg transition-colors"><Check size={14}/></button>
                            <button onClick={() => { setEditingCategory(null); setShowEditIconPicker(false); }} className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"><X size={14}/></button>
                          </div>
                          
                          {showEditIconPicker && (
                            <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-xl max-h-32 overflow-y-auto">
                              {Object.keys(ICON_MAP).map(icon => (
                                <button 
                                  key={icon} 
                                  onClick={() => { setEditingCategory({...editingCategory, icon}); setShowEditIconPicker(false); }} 
                                  className={`p-1.5 rounded-lg transition-colors ${editingCategory.icon === icon ? 'bg-[#141414] text-white' : 'hover:bg-gray-200 text-gray-500'}`}
                                >
                                   {React.createElement(ICON_MAP[icon], { size: 16 })}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors">
                              <GripVertical size={16} />
                            </div>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${cat.type === 'income' ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}>
                              {React.createElement(ICON_MAP[cat.icon || 'HelpCircle'] || ICON_MAP['HelpCircle'], { size: 14 })}
                            </div>
                            <span className="text-sm font-bold text-gray-700">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingCategory({old: cat.name, new: cat.name, type: cat.type, icon: cat.icon || 'HelpCircle'})} 
                              className="p-2.5 text-gray-400 hover:text-[#141414] hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
                              title="編集"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => deleteCategory(cat.name)} 
                              className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-95"
                              title="削除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-gray-500" />
                <h3 className="font-bold text-[#141414] tracking-wide">取引の編集 (Edit Entry)</h3>
              </div>
              <button 
                onClick={() => setEditingTx(null)} 
                className="text-gray-400 hover:text-[#141414] hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!editingTx.amount || isNaN(Number(editingTx.amount))) return;
              
              const originalTx = transactions.find(t => t.id === editingTx.id);
              let nextRecurringDate = editingTx.nextRecurringDate;
              
              if (editingTx.recurringFrequency === 'none') {
                nextRecurringDate = null;
              } else if (!originalTx || originalTx.recurringFrequency !== editingTx.recurringFrequency || originalTx.date !== editingTx.date || !nextRecurringDate) {
                nextRecurringDate = getNextDate(editingTx.date, editingTx.recurringFrequency!);
              }

              const finalTx = { ...editingTx, nextRecurringDate };
              
              setPreviousTransactions(transactions);
              setTransactions(prev => prev.map(t => t.id === finalTx.id ? finalTx : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
              setEditingTx(null);
            }} className="p-4 sm:p-6 space-y-5">
              
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => setEditingTx({...editingTx, type: 'expense', category: categories.find(c => c.type === 'expense')?.name || ''})} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${editingTx.type === 'expense' ? 'bg-white shadow-sm text-[#141414]' : 'text-gray-400 hover:text-gray-600'}`}>支出 (Expense)</button>
                <button type="button" onClick={() => setEditingTx({...editingTx, type: 'income', category: categories.find(c => c.type === 'income')?.name || ''})} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${editingTx.type === 'income' ? 'bg-white shadow-sm text-[#141414]' : 'text-gray-400 hover:text-gray-600'}`}>収入 (Income)</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">金額 (Amount)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-lg">¥</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingTx.amount === 0 ? '' : editingTx.amount}
                    onChange={e => setEditingTx({...editingTx, amount: Number(e.target.value)})}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] font-mono text-2xl transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">日付 (Date)</label>
                  <input
                    type="date"
                    required
                    value={editingTx.date}
                    onChange={e => setEditingTx({...editingTx, date: e.target.value})}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] font-mono text-sm transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">科目 (Category)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      {React.createElement(ICON_MAP[categories.find(c => c.name === editingTx.category)?.icon || 'HelpCircle'] || HelpCircle, { size: 16 })}
                    </div>
                    <select
                      value={editingTx.category}
                      onChange={e => setEditingTx({...editingTx, category: e.target.value})}
                      className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all appearance-none min-h-[44px]"
                    >
                      {categories.filter(c => c.type === editingTx.type).map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">摘要 (Memo)</label>
                  <input
                    type="text"
                    value={editingTx.memo}
                    onChange={e => setEditingTx({...editingTx, memo: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] text-sm transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">繰り返し (Recurring)</label>
                  <select
                    value={editingTx.recurringFrequency || 'none'}
                    onChange={e => setEditingTx({...editingTx, recurringFrequency: e.target.value as RecurringFrequency})}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414] text-sm font-medium transition-all appearance-none min-h-[44px]"
                  >
                    <option value="none">なし (None)</option>
                    <option value="weekly">毎週 (Weekly)</option>
                    <option value="monthly">毎月 (Monthly)</option>
                    <option value="yearly">毎年 (Yearly)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all active:scale-95"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#141414] text-white rounded-xl text-sm font-bold hover:bg-black transition-all active:scale-95 shadow-md"
                >
                  更新する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-gray-500" />
                <h3 className="font-bold text-[#141414] tracking-wide">CSVインポート</h3>
              </div>
              <button 
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvRawData([]);
                  setCsvPreview([]);
                }} 
                className="text-gray-400 hover:text-[#141414] hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              {csvRawData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <FileText size={48} className="text-gray-300 mb-4" />
                  <p className="text-sm font-bold text-gray-600 mb-2">CSVファイルを選択してください</p>
                  <p className="text-xs text-gray-400 mb-6">日付、金額、内容が含まれるファイル</p>
                  <label className="cursor-pointer bg-[#141414] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-black transition-all active:scale-95 shadow-md">
                    ファイルを選択
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">列の割り当て (Column Mapping)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">日付 (Date)</label>
                        <select 
                          value={csvMapping.date} 
                          onChange={e => handleMappingChange('date', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]"
                        >
                          <option value="-1">選択しない</option>
                          {csvHeaders.map((h, i) => <option key={i} value={i}>{h || `列 ${i+1}`}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">金額 (Amount)</label>
                        <select 
                          value={csvMapping.amount} 
                          onChange={e => handleMappingChange('amount', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]"
                        >
                          <option value="-1">選択しない</option>
                          {csvHeaders.map((h, i) => <option key={i} value={i}>{h || `列 ${i+1}`}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">内容 (Memo)</label>
                        <select 
                          value={csvMapping.memo} 
                          onChange={e => handleMappingChange('memo', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]"
                        >
                          <option value="-1">選択しない</option>
                          {csvHeaders.map((h, i) => <option key={i} value={i}>{h || `列 ${i+1}`}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">プレビュー (Preview)</h4>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[40px]">対象</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[120px]">日付</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[100px]">収支</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-[140px]">科目</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">内容</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right w-[120px]">金額</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {csvPreview.map((item) => (
                              <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.selected ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-2 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={item.selected} 
                                    onChange={e => handlePreviewChange(item.id, 'selected', e.target.checked)}
                                    className="rounded text-[#141414] focus:ring-[#141414]"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input 
                                    type="date" 
                                    value={item.date} 
                                    onChange={e => handlePreviewChange(item.id, 'date', e.target.value)}
                                    className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-[#141414] focus:bg-white rounded text-xs font-mono transition-all"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <select 
                                    value={item.type} 
                                    onChange={e => handlePreviewChange(item.id, 'type', e.target.value)}
                                    className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-[#141414] focus:bg-white rounded text-xs font-bold transition-all"
                                  >
                                    <option value="expense">支出</option>
                                    <option value="income">収入</option>
                                  </select>
                                </td>
                                <td className="px-4 py-2">
                                  <select 
                                    value={item.category} 
                                    onChange={e => handlePreviewChange(item.id, 'category', e.target.value)}
                                    className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-[#141414] focus:bg-white rounded text-xs font-bold transition-all"
                                  >
                                    <option value="">未分類</option>
                                    {categories.filter(c => c.type === item.type).map(c => (
                                      <option key={c.name} value={c.name}>{c.name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-2">
                                  <input 
                                    type="text" 
                                    value={item.memo} 
                                    onChange={e => handlePreviewChange(item.id, 'memo', e.target.value)}
                                    className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-[#141414] focus:bg-white rounded text-xs transition-all"
                                    placeholder="内容"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input 
                                    type="number" 
                                    value={item.amount} 
                                    onChange={e => handlePreviewChange(item.id, 'amount', Number(e.target.value))}
                                    className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-[#141414] focus:bg-white rounded text-xs font-mono text-right transition-all"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {csvRawData.length > 0 && (
              <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <div className="text-xs text-gray-500 font-bold">
                  {csvPreview.filter(i => i.selected).length} 件を取り込みます
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setCsvRawData([]);
                      setCsvPreview([]);
                    }} 
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all active:scale-95"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={importCsvTransactions}
                    disabled={csvPreview.filter(i => i.selected).length === 0}
                    className="px-6 py-2 bg-[#141414] text-white rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50 transition-all active:scale-95 shadow-md"
                  >
                    保存する
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Receipt Analysis Loading Overlay */}
      {isAnalyzingReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-[#141414] text-white p-4 rounded-full">
                <Loader2 size={32} className="animate-spin" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-[#141414] mb-2">レシートを解析中...</h3>
            <p className="text-sm text-gray-500">AIが日付、金額、内容を読み取っています。<br/>しばらくお待ちください。</p>
          </div>
        </div>
      )}
    </div>
  );
}
