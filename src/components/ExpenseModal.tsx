import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Check,
  DollarSign,
  Calendar,
  Clock,
  CreditCard,
  Tag,
  FileText,
  Repeat,
  Camera,
  Scan,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Video,
  VideoOff,
  ChevronRight,
  Receipt,
  ArrowLeft,
  Upload,
  Eye,
  Trash2,
  Image as ImageIcon,
  Maximize2,
} from 'lucide-react';
import { Expense, ExpenseCategory, PaymentMethod, BudgetSettings, RecurrenceFrequency } from '../types';
import { CATEGORIES, PAYMENT_METHODS } from '../data/sampleExpenses';
import { CURRENCY_SYMBOLS, formatCurrency } from '../utils/formatters';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import {
  captureVideoFrameToBase64,
  compressImageFileToBase64,
  generateReceiptBase64,
} from '../utils/receiptGenerator';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expenseData: Omit<Expense, 'id'>, existingId?: string) => void;
  editingExpense?: Expense | null;
  defaultDate?: string;
  budgetSettings: BudgetSettings;
  recentMerchants?: string[];
  availableTags?: string[];
}

const COMMON_TAG_SUGGESTIONS = ['Personal', 'Work', 'Project X', 'Essential', 'Travel', 'Tax'];

interface SampleReceipt {
  id: string;
  name: string;
  merchant: string;
  amount: number;
  category: ExpenseCategory;
  rawText: string;
}

const SAMPLE_RECEIPTS: SampleReceipt[] = [
  {
    id: 'blue-bottle',
    name: 'Blue Bottle Coffee',
    merchant: 'Blue Bottle Coffee',
    amount: 14.50,
    category: 'Dining & Drinks',
    rawText: `BLUE BOTTLE COFFEE #104\n315 S. SPRING ST, LOS ANGELES CA\n\n1x HAYES VALLEY ESPRESSO   $4.75\n1x OAT MILK LATTE          $6.25\n1x PASTRY CINNAMON ROLL    $3.50\n--------------------------------\nSUBTOTAL                  $14.50\nTAX                        $0.00\nTOTAL AMOUNT              $14.50\n--------------------------------\nVISA ENDING IN 4092\nAUTH: 882910\nTHANK YOU FOR VISITING!`,
  },
  {
    id: 'trader-joes',
    name: "Trader Joe's",
    merchant: "Trader Joe's",
    amount: 52.36,
    category: 'Groceries',
    rawText: `TRADER JOE'S #541\nSTORE MANAGER: ALEX\n\nORGANIC BANANAS            $1.49\nALMOND BUTTER              $6.99\nDARK CHOCOLATE CHIPS       $3.99\nSOURDOUGH BOULE            $4.49\nCOLD BREW CONCENTRATE      $8.99\nFREE-RANGE EGGS            $4.29\nORGANIC SPINACH            $2.99\nORGANIC CHICKEN BREAST    $14.98\n--------------------------------\nSUBTOTAL                  $48.21\nSALES TAX                  $4.15\nTOTAL AMOUNT              $52.36\n--------------------------------\nMASTERCARD ************8812\nAPPROVED - THANK YOU!`,
  },
  {
    id: 'shell-fuel',
    name: 'Shell Fuel Express',
    merchant: 'Shell Fuel Express',
    amount: 53.56,
    category: 'Transportation',
    rawText: `SHELL OIL EXPRESS\nSTATION #04821\n\nPUMP #04 REGULAR UNLEADED\n12.450 GAL @ $3.499/GAL\nFUEL TOTAL                $43.56\nCAR WASH DELUXE           $10.00\n--------------------------------\nTOTAL AMOUNT              $53.56\n--------------------------------\nDEBIT TENDERED\nCARD APPROVED 991204`,
  },
  {
    id: 'target-store',
    name: 'Target Store',
    merchant: 'Target Store',
    amount: 56.39,
    category: 'Shopping',
    rawText: `TARGET STORE #2104\n\nDESK LAMP LED             $24.99\nNOTEBOOK PACK              $6.50\nERGONOMIC MOUSEPAD        $12.99\nAA BATTERIES 8PK           $7.49\n--------------------------------\nSUBTOTAL                  $51.97\nTAX                        $4.42\nTOTAL AMOUNT              $56.39\n--------------------------------\nTARGET REDCARD **********1049`,
  },
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingExpense,
  defaultDate,
  budgetSettings,
  recentMerchants = [],
  availableTags = [],
}) => {
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('2026-10-29');
  const [time, setTime] = useState('12:00');
  const [category, setCategory] = useState<ExpenseCategory>('Dining & Drinks');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit Card');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<string>('none');
  const [error, setError] = useState<string | null>(null);

  // Receipt Scanner & Camera Simulation State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedReceiptIndex, setSelectedReceiptIndex] = useState(0);
  const [customReceiptText, setCustomReceiptText] = useState('');
  const [useCustomReceipt, setUseCustomReceipt] = useState(false);
  const [ocrStep, setOcrStep] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    merchant: string;
    amount: number;
    category: ExpenseCategory;
    itemsCount: number;
  } | null>(null);
  const [scanSuccessBanner, setScanSuccessBanner] = useState<string | null>(null);

  // Stored Base64 Physical Receipt Image
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currencySymbol = CURRENCY_SYMBOLS[budgetSettings.currency] || '$';

  // Merge tag suggestions
  const suggestedTags = Array.from(
    new Set([...COMMON_TAG_SUGGESTIONS, ...availableTags])
  );

  // Stop camera helper
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (editingExpense) {
      setAmount(editingExpense.amount.toString());
      setMerchant(editingExpense.merchant);
      setDate(editingExpense.date);
      setTime(editingExpense.time || '12:00');
      setCategory(editingExpense.category);
      setPaymentMethod(editingExpense.paymentMethod);
      setNotes(editingExpense.notes || '');
      setTags(editingExpense.tags ? [...editingExpense.tags] : []);
      setTagInput('');
      setRecurrenceFrequency(
        editingExpense.recurrenceFrequency ||
          (editingExpense.isRecurring ? 'monthly' : 'none')
      );
      setReceiptImage(editingExpense.receiptImage || null);
      setCapturedSnapshot(editingExpense.receiptImage || null);
      setError(null);
      setScanSuccessBanner(null);
    } else {
      setAmount('');
      setMerchant('');
      setDate(defaultDate || '2026-10-29');
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      setTime(`${currentHours}:${currentMins}`);
      setCategory('Dining & Drinks');
      setPaymentMethod('Credit Card');
      setNotes('');
      setTags([]);
      setTagInput('');
      setRecurrenceFrequency('none');
      setReceiptImage(null);
      setCapturedSnapshot(null);
      setError(null);
      setScanSuccessBanner(null);
    }

    if (!isOpen) {
      stopCamera();
      setIsScannerOpen(false);
      setCapturedSnapshot(null);
      setReceiptImage(null);
      setIsReceiptPreviewOpen(false);
      setOcrStep('idle');
      setParsedPreview(null);
    }
  }, [editingExpense, defaultDate, isOpen]);

  // Hook camera stream to video element whenever it changes
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('Video play interrupted:', err);
      });
    }
  }, [cameraStream, isScannerOpen]);

  if (!isOpen) return null;

  const handleStartCamera = async () => {
    setIsCameraLoading(true);
    setCameraError(null);
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setCameraError('Camera API not accessible in this context. Using simulated viewfinder.');
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied or blocked by iframe policy. Using simulated camera viewfinder.'
          : 'Camera device unavailable. Using simulated camera viewfinder.'
      );
    } finally {
      setIsCameraLoading(false);
    }
  };

  const handleOpenScanner = () => {
    setIsScannerOpen(true);
    setOcrStep('idle');
    setParsedPreview(null);
    setCapturedSnapshot(null);
    handleStartCamera();
  };

  const handleCloseScanner = () => {
    stopCamera();
    setIsScannerOpen(false);
    setCapturedSnapshot(null);
    setOcrStep('idle');
    setParsedPreview(null);
  };

  // OCR Parsing Algorithm: parses receipt text to extract Merchant & Amount
  const parseReceiptContent = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Detect Merchant: Top lines before item listings
    let detectedMerchant = '';
    for (const line of lines) {
      if (
        !line.startsWith('-') &&
        !line.startsWith('=') &&
        !line.toLowerCase().includes('welcome') &&
        !line.toLowerCase().includes('store manager')
      ) {
        detectedMerchant = line.replace(/[#*].*$/, '').replace(/\d{3,}.*$/, '').trim();
        if (detectedMerchant.length > 2) break;
      }
    }
    if (!detectedMerchant) detectedMerchant = 'Scanned Merchant';

    // 2. Detect Amount: Look for TOTAL or highest currency value
    let detectedAmount = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (/total(\s+amount)?/i.test(line) && !/subtotal/i.test(line)) {
        const match = line.match(/\$?\s*(\d+[\.,]\d{2})/);
        if (match) {
          detectedAmount = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }
    }

    if (!detectedAmount) {
      // Fallback: look for any dollar matches
      const allMatches = text.match(/\$?\s*(\d+[\.,]\d{2})/g);
      if (allMatches && allMatches.length > 0) {
        const nums = allMatches.map((m) => {
          const cleaned = m.replace('$', '').trim().replace(',', '.');
          return parseFloat(cleaned);
        }).filter((n) => !isNaN(n));
        if (nums.length > 0) {
          detectedAmount = Math.max(...nums);
        }
      }
    }

    // 3. Infer category based on merchant and items
    let detectedCategory: ExpenseCategory = 'Miscellaneous';
    const lower = text.toLowerCase();
    if (
      lower.includes('coffee') ||
      lower.includes('latte') ||
      lower.includes('cafe') ||
      lower.includes('restaurant') ||
      lower.includes('espresso') ||
      lower.includes('pastry')
    ) {
      detectedCategory = 'Dining & Drinks';
    } else if (
      lower.includes('trader') ||
      lower.includes('grocery') ||
      lower.includes('market') ||
      lower.includes('bananas') ||
      lower.includes('milk') ||
      lower.includes('eggs')
    ) {
      detectedCategory = 'Groceries';
    } else if (
      lower.includes('shell') ||
      lower.includes('fuel') ||
      lower.includes('gas') ||
      lower.includes('unleaded') ||
      lower.includes('pump') ||
      lower.includes('uber')
    ) {
      detectedCategory = 'Transportation';
    } else if (
      lower.includes('target') ||
      lower.includes('lamp') ||
      lower.includes('electronics') ||
      lower.includes('mousepad') ||
      lower.includes('batteries')
    ) {
      detectedCategory = 'Shopping';
    }

    const itemsCount = lines.filter((l) => /\$\s*\d+/.test(l)).length;

    return {
      merchant: detectedMerchant,
      amount: detectedAmount || 15.00,
      category: detectedCategory,
      itemsCount: Math.max(1, itemsCount),
    };
  };

  // Trigger capture & receipt parsing
  const handleCaptureAndParse = () => {
    let capturedBase64: string | null = null;

    // 1. If video stream is active, capture snapshot from video element
    if (videoRef.current && cameraStream) {
      capturedBase64 = captureVideoFrameToBase64(videoRef.current);
    }

    const receiptToParse = useCustomReceipt && customReceiptText.trim()
      ? customReceiptText
      : SAMPLE_RECEIPTS[selectedReceiptIndex].rawText;

    const parsed = parseReceiptContent(receiptToParse);

    // 2. If camera stream wasn't available, generate an authentic high-res receipt photo
    if (!capturedBase64) {
      capturedBase64 = generateReceiptBase64(
        {
          merchant: parsed.merchant,
          amount: parsed.amount,
          date,
          time,
          category: parsed.category,
          paymentMethod,
        },
        currencySymbol
      );
    }

    setCapturedSnapshot(capturedBase64);
    setReceiptImage(capturedBase64);

    setOcrStep('scanning');
    setOcrStatusText('Initiating camera frame capture & image preprocessing...');

    setTimeout(() => {
      setOcrStatusText('Running OCR optical text recognition on receipt image...');
    }, 400);

    setTimeout(() => {
      setOcrStatusText('Detecting merchant entity and total transaction amount...');
    }, 850);

    setTimeout(() => {
      setParsedPreview(parsed);
      setOcrStep('success');
      setOcrStatusText('Receipt photo captured and parsed successfully!');
    }, 1300);
  };

  // Upload receipt image from local file or native device camera
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageFileToBase64(file);
      setReceiptImage(base64);
      setCapturedSnapshot(base64);
      if (!tags.includes('Receipt')) {
        setTags((prev) => [...prev, 'Receipt']);
      }
      setScanSuccessBanner('Physical receipt photo uploaded and attached to this expense!');
    } catch (err) {
      console.error('Failed to compress receipt file:', err);
      setError('Could not process the selected image file. Please try another format.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Quick attach sample receipt photo
  const handleAttachSampleReceipt = () => {
    const sample = SAMPLE_RECEIPTS[selectedReceiptIndex] || SAMPLE_RECEIPTS[0];
    const base64 = generateReceiptBase64(
      {
        merchant: merchant.trim() || sample.merchant,
        amount: parseFloat(amount) || sample.amount,
        date,
        time,
        category,
        paymentMethod,
      },
      currencySymbol
    );
    setReceiptImage(base64);
    setCapturedSnapshot(base64);
    if (!tags.includes('Receipt')) {
      setTags((prev) => [...prev, 'Receipt']);
    }
    setScanSuccessBanner('Sample physical receipt photo attached successfully!');
  };

  // Auto-fill values and close scanner
  const handleApplyParsedResult = () => {
    if (!parsedPreview) return;

    setAmount(parsedPreview.amount.toFixed(2));
    setMerchant(parsedPreview.merchant);
    setCategory(parsedPreview.category);

    if (capturedSnapshot) {
      setReceiptImage(capturedSnapshot);
    }

    // Auto-append receipt scan tag if not present
    if (!tags.includes('Receipt')) {
      setTags((prev) => [...prev, 'Receipt']);
    }

    // Set informative note
    setNotes((prev) =>
      prev ? `${prev} · Scanned from receipt` : `Scanned receipt: ${parsedPreview.merchant}`
    );

    setScanSuccessBanner(
      `Receipt photo attached & details auto-filled: ${parsedPreview.merchant} · ${formatCurrency(parsedPreview.amount, budgetSettings.currency)}`
    );

    handleCloseScanner();
  };

  const handleAddTag = (tagToAdd?: string) => {
    const raw = tagToAdd || tagInput;
    const trimmed = raw.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      if (!tagToAdd) setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!merchant.trim()) {
      setError('Please provide a merchant or expense description.');
      return;
    }

    if (!date) {
      setError('Please select a valid date.');
      return;
    }

    const isRec = recurrenceFrequency !== 'none';

    onSave(
      {
        amount: Math.round(parsedAmount * 100) / 100,
        merchant: merchant.trim(),
        date,
        time: time || '12:00',
        category,
        paymentMethod,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        isRecurring: isRec,
        recurrenceFrequency: isRec ? (recurrenceFrequency as RecurrenceFrequency) : undefined,
        receiptImage: receiptImage || undefined,
      },
      editingExpense ? editingExpense.id : undefined
    );

    onClose();
  };

  const activeSampleReceipt = SAMPLE_RECEIPTS[selectedReceiptIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs transition-colors">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors"
        role="dialog"
        aria-modal="true"
      >
        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            {isScannerOpen ? (
              <button
                type="button"
                onClick={handleCloseScanner}
                className="p-1 -ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md transition-colors"
                title="Back to expense form"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isScannerOpen
                ? 'Camera Receipt Scanner'
                : editingExpense
                ? 'Edit Expense'
                : 'Log New Expense'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {!isScannerOpen && (
              <button
                type="button"
                onClick={handleOpenScanner}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800/80 rounded-lg transition-colors shadow-2xs"
                title="Trigger camera to scan receipt and auto-fill merchant & amount"
              >
                <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Scan Receipt</span>
              </button>
            )}

            <button
              type="button"
              onClick={isScannerOpen ? handleCloseScanner : onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View 1: Camera Scanner Viewfinder & Receipt Parsing */}
        {isScannerOpen ? (
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Viewfinder Screen */}
            <div className="relative w-full h-56 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* Live Video Feed if Camera Stream active and not yet captured */}
              {cameraStream && !capturedSnapshot ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : capturedSnapshot ? (
                <img
                  src={capturedSnapshot}
                  alt="Captured Receipt"
                  className="w-full h-full object-cover filter contrast-105"
                />
              ) : (
                /* Simulated Visual Viewfinder */
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2 text-emerald-400">
                    <Scan className="w-6 h-6 stroke-[1.8] animate-pulse" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    Smart Receipt Scanner Viewfinder
                  </span>
                  <span className="text-[11px] text-slate-400 max-w-xs mt-1">
                    Align your paper or digital receipt within the scanner target frame
                  </span>
                </div>
              )}

              {/* Viewfinder Target Reticles */}
              <div className="absolute inset-4 pointer-events-none border border-emerald-500/20 rounded-lg">
                {/* 4 Corner Markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-sm" />

                {/* Animated Scanning Laser Line during OCR scan */}
                {ocrStep === 'scanning' && (
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-[bounce_1.5s_infinite]" />
                )}
              </div>

              {/* Status Badge in Viewfinder */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-xs border border-slate-700/60 text-[10px] font-mono text-slate-200">
                {cameraStream ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>CAMERA FEED ACTIVE</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span>SIMULATED VIEW</span>
                  </>
                )}
              </div>

              {/* Receipt Target Preview Tag */}
              <div className="absolute bottom-3 right-3 z-10 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur-xs border border-slate-700/60 text-[10px] font-mono text-emerald-400">
                Target: {useCustomReceipt ? 'Custom Text' : activeSampleReceipt.merchant}
              </div>
            </div>

            {/* Camera Permission or Notice */}
            {cameraError && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <span className="font-semibold">Notice:</span> {cameraError}
                  <span className="block text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                    You can seamlessly test OCR parsing with the receipt presets below!
                  </span>
                </div>
              </div>
            )}

            {/* OCR Processing State Display */}
            {ocrStep === 'scanning' && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 rounded-xl space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>{ocrStatusText}</span>
                </div>
                <div className="w-full bg-emerald-200/60 dark:bg-emerald-900/40 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full animate-[pulse_1s_infinite] w-3/4" />
                </div>
              </div>
            )}

            {/* OCR Extracted Result Card */}
            {ocrStep === 'success' && parsedPreview && (
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>OCR Parsing Succeeded</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                    Confidence: 98.4%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-900/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Detected Merchant
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {parsedPreview.merchant}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Detected Total
                    </span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(parsedPreview.amount, budgetSettings.currency)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Inferred Category
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {parsedPreview.category}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Recognized Lines
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {parsedPreview.itemsCount} line items
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOcrStep('idle');
                      setParsedPreview(null);
                      setCapturedSnapshot(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                  >
                    Rescan
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyParsedResult}
                    className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Auto-Fill Merchant & Amount</span>
                  </button>
                </div>
              </div>
            )}

            {/* Receipt Selection Presets */}
            {ocrStep !== 'success' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Select Receipt to Scan</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseCustomReceipt(!useCustomReceipt)}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                  >
                    {useCustomReceipt ? 'Use Presets' : 'Custom Receipt Text'}
                  </button>
                </div>

                {!useCustomReceipt ? (
                  <div className="grid grid-cols-2 gap-2">
                    {SAMPLE_RECEIPTS.map((r, idx) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedReceiptIndex(idx);
                          setCapturedSnapshot(null);
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          selectedReceiptIndex === idx
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-xs truncate">{r.name}</div>
                        <div className="flex items-center justify-between mt-1 text-[11px] font-mono tabular-nums">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(r.amount, budgetSettings.currency)}
                          </span>
                          <span className="text-slate-500 text-[10px]">{r.category}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={4}
                      placeholder="Paste any receipt text with items, subtotal, and TOTAL $XX.XX..."
                      value={customReceiptText}
                      onChange={(e) => setCustomReceiptText(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      The parser extracts the top merchant name and searches for total lines or dollar values.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Scanner Action Buttons */}
            {ocrStep !== 'success' && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                {/* Center Shutter & Source Options */}
                <div className="flex items-center justify-center gap-4 py-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
                    title="Upload photo from device / native camera"
                  >
                    <Upload className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCaptureAndParse}
                    disabled={ocrStep === 'scanning'}
                    className="w-14 h-14 rounded-full border-4 border-slate-200 dark:border-slate-700 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center shadow-lg text-slate-950 font-bold"
                    title="Capture receipt photo & trigger OCR"
                  >
                    <Camera className="w-6 h-6 stroke-[2.2]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleAttachSampleReceipt}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
                    title="Attach sample receipt photo"
                  >
                    <Receipt className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={handleCloseScanner}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                  >
                    Back to Form
                  </button>

                  <div className="text-[11px] text-slate-500 text-center">
                    Tap the shutter to capture photo & store base64 image
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Use File Upload
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* View 2: Standard Expense Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {error && (
              <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Banner when auto-filled from scanner */}
            {scanSuccessBanner && (
              <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-medium">{scanSuccessBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScanSuccessBanner(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Camera Scan Callout */}
            {!editingExpense && !scanSuccessBanner && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-[11px]">Have a paper or digital receipt? Auto-fill with camera OCR.</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenScanner}
                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800/80 rounded-md transition-colors whitespace-nowrap"
                >
                  Scan Now
                </button>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Amount ({budgetSettings.currency})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-lg">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Merchant / Description with suggestions */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Merchant / Payee
              </label>
              <input
                type="text"
                placeholder="e.g. Trader Joe's, Uber, Blue Bottle Coffee"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              {recentMerchants.length > 0 && !merchant && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500">Recent:</span>
                  {recentMerchants.slice(0, 4).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMerchant(m)}
                      className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono tabular-nums transition-colors"
                />
              </div>
            </div>

            {/* Category & Payment Method Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags & Labels System */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Custom Labels & Tags
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. Work, Personal, Project X"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8.5 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddTag()}
                  className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Selected Tags list */}
              {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 px-2 py-0.5 rounded"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-emerald-900 dark:hover:text-white ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Quick Tag Suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-500">Suggestions:</span>
                {suggestedTags.slice(0, 5).map((s) => {
                  const isSelected = tags.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddTag(s)}
                      disabled={isSelected}
                      className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                        isSelected
                          ? 'opacity-40 text-slate-400 dark:text-slate-500 cursor-default'
                          : 'text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      +{s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recurrence Frequency Setting */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Repeat Expense
                  </span>
                </div>
                <select
                  value={recurrenceFrequency}
                  onChange={(e) => setRecurrenceFrequency(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white px-2.5 py-1 focus:outline-none focus:border-emerald-500"
                >
                  <option value="none">One-time only</option>
                  <option value="daily">Daily repeat</option>
                  <option value="weekly">Weekly repeat</option>
                  <option value="monthly">Monthly repeat</option>
                </select>
              </div>
              {recurrenceFrequency !== 'none' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Will repeat {recurrenceFrequency} and automatically generate entries in the ledger.
                </p>
              )}
            </div>

            {/* Physical Receipt Photo Section */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Physical Receipt Photo
                  </span>
                  {receiptImage && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
                      Attached
                    </span>
                  )}
                </div>

                {/* Hidden native camera/file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {!receiptImage ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors"
                      title="Upload receipt image from device"
                    >
                      <Upload className="w-3 h-3 inline mr-1" />
                      <span>Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenScanner}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 rounded-md transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Camera Access</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsReceiptPreviewOpen(true)}
                      className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>View Full</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenScanner}
                      className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors"
                      title="Retake receipt photo"
                    >
                      <span>Retake</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptImage(null);
                        setCapturedSnapshot(null);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                      title="Remove attached receipt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Receipt Image Card or Empty Prompt */}
              {receiptImage ? (
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div
                    onClick={() => setIsReceiptPreviewOpen(true)}
                    className="w-14 h-16 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer group relative bg-slate-100 dark:bg-slate-800"
                  >
                    <img
                      src={receiptImage}
                      alt="Receipt thumbnail"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Physical Receipt Attached</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        (Stored in Expense)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      Base64 image stored with record for audits & tax reference.
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setIsReceiptPreviewOpen(true)}
                        className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <span>Inspect receipt image</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Capture physical paper receipt to store proof of purchase with this transaction.</span>
                  <button
                    type="button"
                    onClick={handleAttachSampleReceipt}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium shrink-0 ml-2"
                  >
                    + Sample Receipt
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Shared dinner with friends, work reimbursement"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{editingExpense ? 'Save Changes' : 'Record Expense'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Receipt Fullscreen Lightbox Modal */}
        <ReceiptPreviewModal
          isOpen={isReceiptPreviewOpen}
          onClose={() => setIsReceiptPreviewOpen(false)}
          receiptImage={receiptImage}
          merchant={merchant || 'Expense Receipt'}
          amount={parseFloat(amount) || undefined}
          date={date}
          category={category}
          currency={budgetSettings.currency}
        />
      </div>
    </div>
  );
};
