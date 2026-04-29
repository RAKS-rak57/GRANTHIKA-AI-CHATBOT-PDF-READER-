// src/components/PDFUpload.tsx
// Analysis mode — RAG pipeline + Supabase chat persistence
 
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, X, Send, Loader2, BookOpen, Trash2, Clock, ChevronRight } from "lucide-react";
import {
  supabase,
  createSession,
  saveMessage,
  loadMessages,
  listSessions,
  deleteSession,
  updateSessionTitle,
  type ChatSession,
  type Message as DBMessage,
} from "../lib/supabase";
 
// ─── Types ────────────────────────────────────────────────────────────────────
interface Chunk { id: number; text: string; }
 
interface UIMessage { role: "user" | "assistant"; content: string; }
 
// ─── RAG Utilities ────────────────────────────────────────────────────────────
function chunkText(text: string, chunkSize = 500, overlap = 80): Chunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: Chunk[] = [];
  let i = 0, id = 0;
  while (i < words.length) {
    chunks.push({ id: id++, text: words.slice(i, i + chunkSize).join(" ") });
    i += chunkSize - overlap;
  }
  return chunks;
}
 
function tf(text: string): Map<string, number> {
  const map = new Map<string, number>();
  text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 2)
    .forEach(t => map.set(t, (map.get(t) ?? 0) + 1));
  return map;
}
 
function similarity(a: Map<string, number>, b: Map<string, number>): number {
  let s = 0;
  for (const [k, v] of a) if (b.has(k)) s += v * (b.get(k) ?? 0);
  return s;
}
 
function retrieveChunks(query: string, chunks: Chunk[], topK = 5): Chunk[] {
  const q = tf(query);
  return chunks.map(c => ({ c, s: similarity(q, tf(c.text)) }))
    .sort((a, b) => b.s - a.s).slice(0, topK).map(r => r.c);
}
 
async function extractTextFromPDF(file: File): Promise<string> {
  // @ts-ignore
  if (!window.pdfjsLib) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => res(); s.onerror = rej;
      document.head.appendChild(s);
    });
    // @ts-ignore
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  // @ts-ignore
  const lib = window.pdfjsLib;
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // @ts-ignore
    parts.push(content.items.map(i => i.str).join(" "));
  }
  return parts.join("\n\n");
}
 
async function askGeminiWithContext(apiKey: string, context: string, question: string): Promise<string> {
  const sys = `You are a precise document analyst. Answer using ONLY the provided excerpts.
If not found, say "I couldn't find this in the uploaded document."
 
DOCUMENT EXCERPTS:
${context}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: sys }] },
          { role: "model", parts: [{ text: "Understood. I'll answer based only on the excerpts." }] },
          { role: "user", parts: [{ text: question }] },
        ],
      }),
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "⚠️ No response from Gemini.";
}
 
// ─── Component ────────────────────────────────────────────────────────────────
const PDFUpload: React.FC = () => {
  // PDF / RAG state
  const [file, setFile] = useState<File | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docStats, setDocStats] = useState<{ chunks: number } | null>(null);
 
  // Chat state
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
 
  // Supabase session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
 
  // Load sessions list on mount
  useEffect(() => {
    listSessions("analysis").then(setSessions);
  }, []);
 
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
 
  // ── Process uploaded PDF ──
  const handleFile = useCallback(async (f: File) => {
    if (!f.type.includes("pdf")) { setError("Please upload a valid PDF."); return; }
    setFile(f);
    setChunks([]);
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
    setProcessing(true);
    try {
      const raw = await extractTextFromPDF(f);
      if (!raw.trim()) throw new Error("Could not extract text — PDF may be scanned/image-only.");
      const built = chunkText(raw);
      setChunks(built);
      setDocStats({ chunks: built.length });
 
      // Create Supabase session
      const title = f.name.replace(/\.pdf$/i, "").slice(0, 60);
      const session = await createSession("analysis", title, f.name);
      if (session) {
        setCurrentSessionId(session.id);
        setSessions(prev => [session, ...prev]);
      }
 
      const welcome: UIMessage = {
        role: "assistant",
        content: `📄 **${f.name}** indexed!\n• **${built.length} chunks** ready\n\nAsk me anything about this document.`,
      };
      setMessages([welcome]);
      if (session) await saveMessage(session.id, "assistant", welcome.content);
    } catch (err: any) {
      setError(err.message ?? "Failed to process PDF.");
    } finally {
      setProcessing(false);
    }
  }, []);
 
  // ── Send question ──
  const handleSend = async () => {
    const q = input.trim();
    if (!q || !chunks.length || loading) return;
    setInput("");
 
    const userMsg: UIMessage = { role: "user", content: q };
    setMessages(prev => [...prev, userMsg]);
    if (currentSessionId) await saveMessage(currentSessionId, "user", q);
 
    // Auto-title session from first user question
    if (currentSessionId && messages.length <= 1) {
      const title = q.slice(0, 60);
      await updateSessionTitle(currentSessionId, title);
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title } : s));
    }
 
    setLoading(true);
    setTimeout(scrollToBottom, 50);
    try {
      const relevant = retrieveChunks(q, chunks, 5);
      const context = relevant.map((c, i) => `[Excerpt ${i + 1}]\n${c.text}`).join("\n\n---\n\n");
      const answer = await askGeminiWithContext(apiKey, context, q);
      const assistantMsg: UIMessage = { role: "assistant", content: answer };
      setMessages(prev => [...prev, assistantMsg]);
      if (currentSessionId) await saveMessage(currentSessionId, "assistant", answer);
    } catch {
      const errMsg: UIMessage = { role: "assistant", content: "⚠️ Error fetching answer. Check your API key." };
      setMessages(prev => [...prev, errMsg]);
      if (currentSessionId) await saveMessage(currentSessionId, "assistant", errMsg.content);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    }
  };
 
  // ── Load a past session ──
  const loadSession = async (session: ChatSession) => {
    setLoadingHistory(true);
    try {
      const dbMsgs = await loadMessages(session.id);
      setMessages(dbMsgs.map(m => ({ role: m.role, content: m.content })));
      setCurrentSessionId(session.id);
      setFile(null);
      setChunks([]);
      setDocStats(null);
      setError(null);
      setShowHistory(false);
      setTimeout(scrollToBottom, 100);
    } finally {
      setLoadingHistory(false);
    }
  };
 
  // ── Delete session ──
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setMessages([]);
      setFile(null);
      setChunks([]);
    }
  };
 
  const removeFile = () => {
    setFile(null); setChunks([]); setMessages([]);
    setDocStats(null); setError(null); setCurrentSessionId(null);
  };
 
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };
 
  return (
    <div className="flex flex-col h-full w-full gap-3 p-4">
 
      {/* ── Toolbar: history toggle + save indicator ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowHistory(v => !v)}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-purple-400 transition-colors"
        >
          <Clock className="w-4 h-4" />
          {showHistory ? "Hide history" : `History (${sessions.length})`}
        </button>
        {currentSessionId && (
          <span className="text-xs text-green-400/70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Saved to Supabase
          </span>
        )}
      </div>
 
      {/* ── History panel ── */}
      {showHistory && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-6">No past sessions yet.</p>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                onClick={() => loadSession(s)}
                className={`
                  flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-white/5 last:border-0
                  ${s.id === currentSessionId ? "bg-purple-700/30" : "hover:bg-white/8"}
                `}
              >
                <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm truncate">{s.title}</p>
                  <p className="text-white/30 text-xs">{formatTime(s.updated_at)}</p>
                </div>
                <button
                  onClick={e => handleDelete(s.id, e)}
                  className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
 
      {/* ── Upload zone (shown when no file and no history loaded) ── */}
      {!file && chunks.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
            cursor-pointer transition-all duration-200 py-12
            ${isDragging ? "border-purple-400 bg-purple-900/20 scale-[1.01]" : "border-white/20 bg-white/5 hover:border-purple-500/60 hover:bg-purple-900/10"}
          `}
        >
          <Upload className="w-10 h-10 text-purple-400" />
          <p className="text-white/80 font-medium text-lg">Upload a PDF to analyse</p>
          <p className="text-white/40 text-sm">Drag & drop or click to select</p>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}
 
      {/* ── Processing ── */}
      {processing && (
        <div className="flex items-center gap-3 bg-purple-900/30 border border-purple-500/30 rounded-xl px-4 py-3 text-purple-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Extracting & indexing document…</span>
        </div>
      )}
 
      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
          <X className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
 
      {/* ── File badge ── */}
      {file && !processing && (
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-white/90 text-sm font-medium truncate">{file.name}</p>
              {docStats && <p className="text-white/40 text-xs">{docStats.chunks} chunks indexed</p>}
            </div>
          </div>
          <button onClick={removeFile} className="ml-3 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
 
      {/* ── Messages ── */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`
                max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                ${m.role === "user"
                  ? "bg-purple-600/80 text-white rounded-br-sm"
                  : "bg-white/8 border border-white/10 text-white/90 rounded-bl-sm"}
              `}>
                {m.content}
              </div>
            </div>
          ))}
          {(loading || loadingHistory) && (
            <div className="flex justify-start">
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                {[0, 1, 2].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
 
      {/* ── Input bar (shown when doc is loaded OR history loaded) ── */}
      {(chunks.length > 0) && (
        <div className="flex gap-2 mt-auto">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask anything about the document…"
            disabled={loading}
            className="
              flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3
              text-white/90 placeholder:text-white/35 text-sm
              focus:outline-none focus:border-purple-500/70 focus:bg-white/10
              disabled:opacity-50 transition-all
            "
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      )}
    </div>
  );
};
 
export default PDFUpload;