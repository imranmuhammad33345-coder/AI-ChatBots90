import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, Upload, X, Loader2, Send, Image as ImageIcon, LogOut, Copy, Check, History, Plus, Share2, Calculator, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { solveMathProblem } from './services/geminiService';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import Login from './components/Login';
import * as math from 'mathjs';

const mathSymbols = [
  { label: 'α', value: 'α' },
  { label: 'β', value: 'β' },
  { label: 'θ', value: 'θ' },
  { label: 'π', value: 'π' },
  { label: '±', value: '±' },
  { label: '×', value: '×' },
  { label: '÷', value: '÷' },
  { label: '√', value: '√' },
  { label: '∫', value: '∫' },
  { label: '∑', value: '∑' },
  { label: '∞', value: '∞' },
  { label: 'x²', value: '²' },
  { label: 'x³', value: '³' },
  { label: '½', value: '½' },
  { label: '¼', value: '¼' },
];

interface MathQuery {
  id: string;
  text: string;
  result: string;
  createdAt: Date | null;
  isShared?: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSharedCopied, setIsSharedCopied] = useState(false);
  const [history, setHistory] = useState<MathQuery[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [sharedQuery, setSharedQuery] = useState<MathQuery | null>(null);
  const [sharedQueryLoading, setSharedQueryLoading] = useState(false);
  const [mode, setMode] = useState<'ai' | 'calculator'>('ai');
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [calcType, setCalcType] = useState<'basic' | 'scientific' | 'bmi' | 'loan' | 'percentage' | 'unit'>('basic');
  const [bmiWeight, setBmiWeight] = useState('');
  const [bmiHeight, setBmiHeight] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanRate, setLoanRate] = useState('');
  const [loanTime, setLoanTime] = useState('');
  const [percBase, setPercBase] = useState('');
  const [percValue, setPercValue] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [unitFrom, setUnitFrom] = useState('cm');
  const [unitTo, setUnitTo] = useState('m');
  const [subject, setSubject] = useState('Math');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('shareId');
    
    if (shareId) {
      setSharedQueryLoading(true);
      const fetchSharedQuery = async () => {
        try {
          const docRef = doc(db, 'queries', shareId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().isShared) {
            const data = docSnap.data();
            setSharedQuery({
              id: docSnap.id,
              text: data.text,
              result: data.result,
              createdAt: data.createdAt?.toDate() || null,
              isShared: data.isShared,
            });
          } else {
            setError("This shared problem does not exist or is no longer public.");
          }
        } catch (err) {
          console.error("Error fetching shared query:", err);
          setError("Could not load the shared problem.");
        } finally {
          setSharedQueryLoading(false);
        }
      };
      
      fetchSharedQuery();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    const q = query(
      collection(db, 'queries'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData: MathQuery[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        historyData.push({
          id: doc.id,
          text: data.text,
          result: data.result,
          createdAt: data.createdAt?.toDate() || null,
          isShared: data.isShared,
        });
      });
      setHistory(historyData);
      setHistoryLoading(false);
    }, (err) => {
      console.error("Error fetching history:", err);
      setHistoryLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImage(base64String);
        setMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1
  });

  const handleSolve = async () => {
    if (!text && !image) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await solveMathProblem(text, image || undefined, mimeType || undefined, subject);
      setResult(response || "Sorry, I couldn't generate a solution.");
      
      // Save query to Firestore if user is logged in
      if (user && response) {
        try {
          const docRef = await addDoc(collection(db, 'queries'), {
            id: crypto.randomUUID(),
            userId: user.uid,
            text: text || '',
            result: response,
            createdAt: serverTimestamp(),
            isShared: false,
            subject: subject,
          });
          setCurrentQueryId(docRef.id);
        } catch (dbError) {
          console.error("Error saving query to database:", dbError);
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while solving the problem.");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setError(null);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setIsCameraOpen(false);
      
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission dismissed') || err.message?.includes('Permission denied')) {
        setError("Camera permission was denied or dismissed. Please allow camera access in your browser settings to use this feature.");
      } else if (err.name === 'NotFoundError') {
        setError("No camera found on your device.");
      } else {
        setError(`Could not access camera: ${err.message || 'Unknown error'}. Please check permissions.`);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64String = dataUrl.split(',')[1];
        setImage(base64String);
        setMimeType('image/jpeg');
        stopCamera();
      }
    }
  };

  const clearImage = () => {
    setImage(null);
    setMimeType(null);
  };

  const insertSymbol = (symbol: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newText = text.substring(0, start) + symbol + text.substring(end);
      setText(newText);
      
      // Move cursor after the inserted symbol
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + symbol.length;
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      setText(text + symbol);
    }
  };

  const handleCopy = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(result);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  const handleShare = async (queryId: string) => {
    if (!user) return;
    
    try {
      const docRef = doc(db, 'queries', queryId);
      await updateDoc(docRef, {
        isShared: true
      });
      
      const shareUrl = `${window.location.origin}${window.location.pathname}?shareId=${queryId}`;
      await navigator.clipboard.writeText(shareUrl);
      setIsSharedCopied(true);
      setTimeout(() => setIsSharedCopied(false), 2000);
    } catch (err) {
      console.error('Failed to share query: ', err);
      setError("Failed to generate share link.");
    }
  };

  const handleCalcInput = (val: string) => {
    if (val === '=') {
      try {
        if (!calcInput) return;
        const result = math.evaluate(calcInput);
        setCalcResult(result.toString());
      } catch (e) {
        setCalcResult('Error');
      }
    } else if (val === 'C') {
      setCalcInput('');
      setCalcResult('');
    } else if (val === '⌫') {
      if (calcResult && calcResult !== 'Error') {
        setCalcInput(calcResult.slice(0, -1));
        setCalcResult('');
      } else {
        setCalcInput(prev => prev.slice(0, -1));
        setCalcResult('');
      }
    } else {
      if (calcResult && calcResult !== 'Error') {
        if (['+', '-', '*', '/'].includes(val)) {
          setCalcInput(calcResult + val);
        } else {
          setCalcInput(val);
        }
        setCalcResult('');
      } else {
        setCalcInput(prev => prev + val);
        setCalcResult('');
      }
    }
  };

  if (authLoading || sharedQueryLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // If viewing a shared query and not logged in (or logged in, doesn't matter)
  if (sharedQuery) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-[0_4px_10px_rgba(79,70,229,0.3)]">
                <span className="text-white font-bold text-xl leading-none">∑</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 drop-shadow-sm">UIMath GPT</h1>
            </div>
            <button
              onClick={() => {
                setSharedQuery(null);
                window.history.replaceState({}, document.title, window.location.pathname);
              }}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all border-b-2 border-indigo-200 active:border-b-0 active:translate-y-0.5"
            >
              Solve your own problem
            </button>
          </div>
        </header>
        
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
          <section className="bg-white rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] border border-slate-200 p-6 flex flex-col gap-6 transform transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Shared Solution</h2>
              <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">
                Public Link
              </span>
            </div>
            
            {sharedQuery.text && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Problem</h3>
                <p className="text-slate-800 font-medium">{sharedQuery.text}</p>
              </div>
            )}
            
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Solution</h3>
              <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4 text-slate-900" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-5 mb-3 text-slate-800" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2 text-slate-800" {...props} />,
                    p: ({node, ...props}) => <p className="my-3 text-slate-700" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 my-3 space-y-2 text-slate-700" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-3 space-y-2 text-slate-700" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-200 pl-4 italic text-slate-600 my-4 bg-slate-50 py-2 pr-4 rounded-r-lg" {...props} />,
                    code: ({node, inline, ...props}: any) => 
                      inline ? 
                        <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props} /> : 
                        <code className="block bg-slate-800 text-slate-50 p-4 rounded-lg text-sm font-mono overflow-x-auto" {...props} />
                  }}
                >
                  {sharedQuery.result}
                </ReactMarkdown>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-[0_4px_10px_rgba(79,70,229,0.3)] transform hover:-translate-y-0.5 transition-transform">
              &sum;
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">UIMath GPT</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border-b-2 border-slate-300 active:border-b-0 active:translate-y-0.5"
            >
              {showHistory ? (
                <>
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Problem</span>
                </>
              ) : (
                <>
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">History</span>
                </>
              )}
            </button>
            <div className="text-sm font-medium text-slate-500 hidden sm:block">
              {user.displayName || user.email}
            </div>
            <button 
              onClick={handleSignOut}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border-b-2 border-transparent hover:border-red-200 active:border-b-0 active:translate-y-0.5"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {!showHistory && (
          <div className="flex justify-center mb-2">
            <div className="bg-slate-200/80 p-1.5 rounded-xl flex items-center gap-1 shadow-inner border border-slate-300/50">
              <button
                onClick={() => setMode('ai')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'ai' 
                    ? 'bg-white text-indigo-600 shadow-md border-b-2 border-slate-200 transform -translate-y-0.5' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50 border-b-2 border-transparent'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Solver
              </button>
              <button
                onClick={() => setMode('calculator')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'calculator' 
                    ? 'bg-white text-indigo-600 shadow-md border-b-2 border-slate-200 transform -translate-y-0.5' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50 border-b-2 border-transparent'
                }`}
              >
                <Calculator className="w-4 h-4" />
                Calculators
              </button>
            </div>
          </div>
        )}

        {showHistory ? (
          <section className="bg-white rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] border border-slate-200 p-6 flex flex-col gap-6 transform transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)]">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <History className="w-6 h-6 text-indigo-600" />
              Your History
            </h2>
            
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No solved problems yet. Go solve some math!
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {history.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-xl p-6 bg-slate-50 shadow-[0_4px_0_0_rgba(226,232,240,1)] hover:shadow-[0_6px_0_0_rgba(226,232,240,1)] hover:-translate-y-0.5 transition-all">
                    {item.text && (
                      <div className="mb-4 pb-4 border-b border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Problem</h3>
                        <p className="text-slate-800 font-medium">{item.text}</p>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Solution</h3>
                      <div className="prose prose-slate max-w-none prose-sm prose-p:leading-relaxed prose-pre:bg-white prose-pre:border prose-pre:border-slate-200">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-base font-medium mt-2 mb-1" {...props} />,
                            p: ({node, ...props}) => <p className="my-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-200 pl-4 italic text-slate-600 my-3" {...props} />,
                          }}
                        >
                          {item.result}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {item.createdAt && (
                      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                          {item.createdAt.toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleShare(item.id)}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all border-b-2 border-indigo-200 active:border-b-0 active:translate-y-0.5"
                        >
                          {isSharedCopied && currentQueryId === item.id ? (
                            <>
                              <Check className="w-4 h-4" />
                              Link Copied!
                            </>
                          ) : (
                            <>
                              <Share2 className="w-4 h-4" />
                              Share
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : mode === 'calculator' ? (
          <section className="bg-white rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] border border-slate-200 p-6 flex flex-col gap-6 max-w-md mx-auto w-full transform transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)]">
            <div className="flex justify-center gap-2 flex-wrap border-b border-slate-100 pb-4">
              {['basic', 'scientific', 'bmi', 'loan', 'percentage', 'unit'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setCalcType(type as any);
                    setCalcResult('');
                    setCalcInput('');
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border-b-4 active:border-b-0 active:translate-y-1 capitalize ${
                    calcType === type
                      ? 'bg-indigo-600 text-white border-indigo-800 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {calcType === 'basic' && (
              <>
                <div className="bg-slate-100 p-4 rounded-xl flex flex-col items-end justify-end h-24 border-b-4 border-slate-300 shadow-inner overflow-hidden">
                  <div className="text-slate-500 text-sm font-mono h-5 overflow-hidden w-full text-right">{calcInput}</div>
                  <div className="text-3xl font-semibold text-slate-800 font-mono h-10 overflow-hidden w-full text-right">{calcResult || calcInput || '0'}</div>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  {['C', '(', ')', '⌫'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-lg transition-all border-b-4 border-slate-300 active:border-b-0 active:translate-y-1">{btn}</button>
                  ))}
                  {['7', '8', '9', '/'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-3 rounded-xl font-medium text-lg transition-all border-b-4 active:border-b-0 active:translate-y-1 ${btn === '/' ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                  {['4', '5', '6', '*'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-3 rounded-xl font-medium text-lg transition-all border-b-4 active:border-b-0 active:translate-y-1 ${btn === '*' ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                  {['1', '2', '3', '-'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-3 rounded-xl font-medium text-lg transition-all border-b-4 active:border-b-0 active:translate-y-1 ${btn === '-' ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                  {['0', '.', '=', '+'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-3 rounded-xl font-medium text-lg transition-all border-b-4 active:border-b-0 active:translate-y-1 ${btn === '+' ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200' : btn === '=' ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border-indigo-800' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                </div>
              </>
            )}

            {calcType === 'scientific' && (
              <>
                <div className="bg-slate-100 p-4 rounded-xl flex flex-col items-end justify-end h-24 border-b-4 border-slate-300 shadow-inner overflow-hidden">
                  <div className="text-slate-500 text-sm font-mono h-5 overflow-hidden w-full text-right">{calcInput}</div>
                  <div className="text-3xl font-semibold text-slate-800 font-mono h-10 overflow-hidden w-full text-right">{calcResult || calcInput || '0'}</div>
                </div>
                
                <div className="grid grid-cols-5 gap-2">
                  {['sin(', 'cos(', 'tan(', 'log(', 'ln('].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className="py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-sm transition-all border-b-4 border-slate-300 active:border-b-0 active:translate-y-1">{btn.replace('(', '')}</button>
                  ))}
                  {['sqrt(', '^', 'pi', 'e', 'C'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-2 rounded-lg font-medium text-sm transition-all border-b-4 active:border-b-0 active:translate-y-1 ${btn === 'C' ? 'bg-red-100 hover:bg-red-200 text-red-700 border-red-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'}`}>{btn.replace('(', '')}</button>
                  ))}
                  {['7', '8', '9', '(', ')'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-2 rounded-lg font-medium text-sm transition-all border-b-4 active:border-b-0 active:translate-y-1 ${['(', ')'].includes(btn) ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                  {['4', '5', '6', '*', '/'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-2 rounded-lg font-medium text-sm transition-all border-b-4 active:border-b-0 active:translate-y-1 ${['*', '/'].includes(btn) ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                  {['1', '2', '3', '+', '-'].map((btn) => (
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-2 rounded-lg font-medium text-sm transition-all border-b-4 active:border-b-0 active:translate-y-1 ${['+', '-'].includes(btn) ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                  {['0', '.', '⌫', '=', ' '].map((btn) => (
                    btn === ' ' ? <div key={btn} /> :
                    <button key={btn} onClick={() => handleCalcInput(btn)} className={`py-2 rounded-lg font-medium text-sm transition-all border-b-4 active:border-b-0 active:translate-y-1 ${btn === '=' ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-800 col-span-2' : btn === '⌫' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}`}>{btn}</button>
                  ))}
                </div>
              </>
            )}

            {calcType === 'bmi' && (
              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
                    <input type="number" value={bmiWeight} onChange={(e) => setBmiWeight(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 70" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Height (cm)</label>
                    <input type="number" value={bmiHeight} onChange={(e) => setBmiHeight(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 175" />
                  </div>
                  <button onClick={() => {
                    const w = parseFloat(bmiWeight);
                    const h = parseFloat(bmiHeight) / 100;
                    if (w > 0 && h > 0) {
                      const bmi = w / (h * h);
                      let category = '';
                      if (bmi < 18.5) category = 'Underweight';
                      else if (bmi < 25) category = 'Normal weight';
                      else if (bmi < 30) category = 'Overweight';
                      else category = 'Obese';
                      setCalcResult(`BMI: ${bmi.toFixed(1)} (${category})`);
                    }
                  }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">Calculate BMI</button>
                </div>
                {calcResult && calcType === 'bmi' && (
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                    <span className="text-lg font-semibold text-indigo-900">{calcResult}</span>
                  </div>
                )}
              </div>
            )}

            {calcType === 'loan' && (
              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Principal Amount ($)</label>
                    <input type="number" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 10000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Annual Interest Rate (%)</label>
                    <input type="number" value={loanRate} onChange={(e) => setLoanRate(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Time Period (Years)</label>
                    <input type="number" value={loanTime} onChange={(e) => setLoanTime(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 3" />
                  </div>
                  <button onClick={() => {
                    const p = parseFloat(loanPrincipal);
                    const r = parseFloat(loanRate) / 100 / 12;
                    const n = parseFloat(loanTime) * 12;
                    if (p > 0 && r > 0 && n > 0) {
                      const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                      const total = emi * n;
                      setCalcResult(`EMI: $${emi.toFixed(2)} | Total: $${total.toFixed(2)}`);
                    }
                  }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">Calculate Loan</button>
                </div>
                {calcResult && calcType === 'loan' && (
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                    <span className="text-sm font-semibold text-indigo-900">{calcResult}</span>
                  </div>
                )}
              </div>
            )}

            {calcType === 'percentage' && (
              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">What is</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={percValue} onChange={(e) => setPercValue(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 20" />
                      <span className="text-slate-500 font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">of</label>
                    <input type="number" value={percBase} onChange={(e) => setPercBase(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 150" />
                  </div>
                  <button onClick={() => {
                    const v = parseFloat(percValue);
                    const b = parseFloat(percBase);
                    if (!isNaN(v) && !isNaN(b)) {
                      const res = (v / 100) * b;
                      setCalcResult(`${v}% of ${b} = ${res}`);
                    }
                  }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">Calculate Percentage</button>
                </div>
                {calcResult && calcType === 'percentage' && (
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                    <span className="text-lg font-semibold text-indigo-900">{calcResult}</span>
                  </div>
                )}
              </div>
            )}

            {calcType === 'unit' && (
              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                    <input type="number" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" placeholder="e.g. 100" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
                      <select value={unitFrom} onChange={(e) => setUnitFrom(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white">
                        <option value="cm">Centimeters (cm)</option>
                        <option value="m">Meters (m)</option>
                        <option value="km">Kilometers (km)</option>
                        <option value="in">Inches (in)</option>
                        <option value="ft">Feet (ft)</option>
                        <option value="mi">Miles (mi)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="lb">Pounds (lb)</option>
                        <option value="c">Celsius (°C)</option>
                        <option value="f">Fahrenheit (°F)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                      <select value={unitTo} onChange={(e) => setUnitTo(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white">
                        <option value="cm">Centimeters (cm)</option>
                        <option value="m">Meters (m)</option>
                        <option value="km">Kilometers (km)</option>
                        <option value="in">Inches (in)</option>
                        <option value="ft">Feet (ft)</option>
                        <option value="mi">Miles (mi)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="lb">Pounds (lb)</option>
                        <option value="c">Celsius (°C)</option>
                        <option value="f">Fahrenheit (°F)</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => {
                    const v = parseFloat(unitValue);
                    if (!isNaN(v)) {
                      try {
                        let res = 0;
                        // Temperature conversions
                        if (unitFrom === 'c' && unitTo === 'f') res = (v * 9/5) + 32;
                        else if (unitFrom === 'f' && unitTo === 'c') res = (v - 32) * 5/9;
                        else if (unitFrom === 'c' && unitTo === 'c') res = v;
                        else if (unitFrom === 'f' && unitTo === 'f') res = v;
                        // Math.js handles other standard units
                        else {
                          res = math.evaluate(`${v} ${unitFrom} to ${unitTo}`).toNumber();
                        }
                        setCalcResult(`${v} ${unitFrom} = ${res.toPrecision(6).replace(/\\.0+$/, '')} ${unitTo}`);
                      } catch (e) {
                        setCalcResult('Invalid conversion');
                      }
                    }
                  }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">Convert</button>
                </div>
                {calcResult && calcType === 'unit' && (
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                    <span className="text-lg font-semibold text-indigo-900">{calcResult}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Input Section */}
            <section className="bg-white rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] border border-slate-200 p-6 flex flex-col gap-6 transform transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)]">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Get instant help</h2>
            <p className="text-slate-500">Take a picture, upload an image, or type your problem.</p>
          </div>

          {!isCameraOpen ? (
            <div className="flex flex-col gap-4">
              {/* Subject Selection */}
              <div className="flex justify-center gap-2 flex-wrap">
                {['Math', 'Chemistry', 'Physics', 'Commerce', 'Other'].map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSubject(sub)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border-b-4 active:border-b-0 active:translate-y-1 ${
                      subject === sub
                        ? 'bg-indigo-600 text-white border-indigo-800 shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {/* Image Input Area */}
              {!image ? (
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all shadow-[0_4px_0_0_rgba(226,232,240,1)] hover:shadow-[0_6px_0_0_rgba(226,232,240,1)] hover:-translate-y-0.5 active:shadow-[0_0_0_0_rgba(226,232,240,1)] active:translate-y-1 ${
                    isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-slate-700">Drag & drop or click to add image</p>
                      <p className="text-sm text-slate-500 mt-1">Supports JPG, PNG, WEBP</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center max-h-64">
                  <img 
                    src={`data:${mimeType};base64,${image}`} 
                    alt="Uploaded math problem" 
                    className="max-h-64 object-contain"
                  />
                  <button 
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Camera Button */}
              {!image && (
                <div className="flex justify-center">
                  <button 
                    onClick={startCamera}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all border-b-4 border-slate-300 active:border-b-0 active:translate-y-1"
                  >
                    <Camera className="w-5 h-5" />
                    Take a picture
                  </button>
                </div>
              )}

              {/* Text Input */}
              <div className="relative flex flex-col gap-2">
                {/* Math Toolbar */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {mathSymbols.map((symbol) => (
                    <button
                      key={symbol.label}
                      onClick={() => insertSymbol(symbol.value)}
                      className="px-2.5 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 hover:border-slate-300 transition-all border-b-2 active:border-b-0 active:translate-y-0.5 shadow-sm"
                      title={`Insert ${symbol.label}`}
                    >
                      {symbol.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Or type your math problem here..."
                  className="w-full min-h-[100px] p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-y transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSolve}
                disabled={loading || (!text && !image)}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:border-b-0 disabled:translate-y-1 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Solving...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Solve Problem
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Camera View */
            <div className="flex flex-col gap-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                  <div className="relative w-11/12 sm:w-3/4 h-1/3 sm:h-1/2 border-2 border-white/30 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute -top-[2px] -left-[2px] w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
                    <div className="absolute -top-[2px] -right-[2px] w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
                    <div className="absolute -bottom-[2px] -left-[2px] w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
                    <div className="absolute -bottom-[2px] -right-[2px] w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl"></div>
                  </div>
                </div>

                <canvas ref={canvasRef} className="hidden" />
                <button 
                  onClick={stopCamera}
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                  <button 
                    onClick={captureImage}
                    className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 hover:scale-105 transition-transform shadow-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Error Message */}
        {mode === 'ai' && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
            <div className="mt-0.5 font-bold">!</div>
            <div>
              <h3 className="font-semibold">Error</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Result Section */}
        {mode === 'ai' && result && (
          <section className="bg-white rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] border border-slate-200 p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transform transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                Step-by-Step Solution
              </h2>
              <div className="flex items-center gap-2">
                {currentQueryId && (
                  <button
                    onClick={() => handleShare(currentQueryId)}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all border-b-2 border-indigo-200 active:border-b-0 active:translate-y-0.5"
                    title="Share solution"
                  >
                    {isSharedCopied ? (
                      <>
                        <Check className="w-4 h-4 text-indigo-600" />
                        <span className="text-indigo-700">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border-b-2 border-slate-300 active:border-b-0 active:translate-y-0.5"
                  title="Copy LaTeX solution"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-5 mb-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="my-3" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-6 my-3 space-y-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-3 space-y-1" {...props} />,
                  li: ({node, ...props}) => <li className="" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-200 pl-4 italic text-slate-600 my-4" {...props} />,
                }}
              >
                {result}
              </ReactMarkdown>
            </div>
          </section>
        )}

            {/* Info Section */}
            {mode === 'ai' && !result && (
              <section className="mt-8 text-center max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">UIMath GPT Math Solver and AI Calculator</h2>
                <p className="text-slate-600 mb-4">
                  UIMath GPT is your all-in-one math solver and AI tutor, serving as an AI math calculator that solves algebra, calculus, chemistry, and physics problems, making it the ultimate homework helper and AI math solver.
                </p>
                <p className="text-slate-600">
                  Gain confidence in your math-solving skills through on-demand step-by-step solutions that simplify the most complex math and STEM problems. With UIMath GPT as your AI math homework helper, you'll not only receive accurate solutions but also gain a deeper understanding of difficult concepts.
                </p>
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          <p>Built by Students, for Students</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} UIMath GPT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
