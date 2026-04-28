Pdfupload · TSX
Copy

// src/components/PDFUpload.tsx
// DROP-IN REPLACEMENT — only touches the Analysis (PDF) mode
// RAG pipeline: PDF → extract text → chunk → TF-IDF retrieval → Gemini answer
 
import React, { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Send, Loader2, BookOpen, ChevronDown } from "lucide-react";
 
// ─── Types ────────────────────────────────────────────────────────────────────
interface Chunk {
  id: number;
  text: string;
  page: number;
}
 
interface Message {
  role: "user" | "assistant";
  content: string;
}
 
// ─── RAG Utilities ────────────────────────────────────────────────────────────
 
/** Split text into overlapping chunks of ~500 words */
function chunkText(text: string, chunkSize = 500, overlap = 80): Chunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: Chunk[] = [];
  let i = 0;
  let id = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + chunkSize).join(" ");
    chunks.push({ id: id++, text: slice, page: 0 }); // page enriched later
    i += chunkSize - overlap;
  }
  return chunks;
}
 
/** Build a simple term-frequency map */
function tf(text: string): Map<string, number> {
  const map = new Map<string, number>();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  for (const t of tokens) map.set(t, (map.get(t) ?? 0) + 1);
  return map;
}
 
/** Dot-product similarity between two TF maps (no normalisation needed for ranking) */
function similarity(a: Map<string, number>, b: Map<string, number>): number {
  let score = 0;
  for (const [term, freq] of a) {
    if (b.has(term)) score += freq * (b.get(term) ?? 0);
  }
  return score;
}
 
/** Return the top-k most relevant chunks for a query */
function retrieveChunks(query: string, chunks: Chunk[], topK = 5): Chunk[] {
  const qTf = tf(query);
  return chunks
    .map((c) => ({ chunk: c, score: similarity(qTf, tf(c.text)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => r.chunk);
}
 
// ─── PDF text extraction via pdf.js CDN ───────────────────────────────────────
async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamically load pdfjs from CDN (no install needed)
  // @ts-ignore
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
    // @ts-ignore
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  // @ts-ignore
  const pdfjsLib = window.pdfjsLib;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      // @ts-ignore
      .map((item) => item.str)
      .join(" ");
    parts.push(pageText);
  }
  return parts.join("\n\n");
}
 
// ─── Gemini call ──────────────────────────────────────────────────────────────
async function askGeminiWithContext(
  apiKey: string,
  context: string,
  question: string
): Promise<string> {
  const systemPrompt = `You are a precise document analyst. Answer the user's question using ONLY the provided document excerpts.
If the answer is not in the excerpts, say "I couldn't find this in the uploaded document."
Be concise and cite which part of the document supports your answer.
 
DOCUMENT EXCERPTS:
${context}`;
 
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. I will answer based only on the provided excerpts." }] },
          { role: "user", parts: [{ text: question }] },
        ],
      }),
    }
  );
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "⚠️ No response from Gemini."
  );
}
 
// ─── Component ────────────────────────────────────────────────────────────────
const PDFUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docStats, setDocStats] = useState<{ pages: number; chunks: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
 
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
 
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
 
  const handleFile = useCallback(async (f: File) => {
    if (!f.type.includes("pdf")) {
      setError("Please upload a valid PDF file.");
      return;
    }
    setFile(f);
    setChunks([]);
    setMessages([]);
    setError(null);
    setProcessing(true);
    try {
      const rawText = await extractTextFromPDF(f);
      if (!rawText.trim()) throw new Error("Could not extract text. The PDF may be scanned/image-only.");
      const built = chunkText(rawText);
      setChunks(built);
 
      // Rough page count from line breaks
      const pages = rawText.split("\n\n").length;
      setDocStats({ pages, chunks: built.length });
 
      setMessages([
        {
          role: "assistant",
          content: `📄 **${f.name}** indexed successfully!\n\n• **~${pages} sections** extracted\n• **${built.length} knowledge chunks** ready\n\nAsk me anything about this document.`,
        },
      ]);
    } catch (err: any) {
      setError(err.message ?? "Failed to process PDF.");
    } finally {
      setProcessing(false);
    }
  }, []);
 
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };
 
  const handleSend = async () => {
    const q = input.trim();
    if (!q || !chunks.length || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    setTimeout(scrollToBottom, 50);
 
    try {
      const relevant = retrieveChunks(q, chunks, 5);
      const context = relevant.map((c, i) => `[Excerpt ${i + 1}]\n${c.text}`).join("\n\n---\n\n");
      const answer = await askGeminiWithContext(apiKey, context, q);
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error fetching answer. Check your API key." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    }
  };
 
  const removeFile = () => {
    setFile(null);
    setChunks([]);
    setMessages([]);
    setDocStats(null);
    setError(null);
  };
 
  return (
    <div className="flex flex-col h-full w-full gap-4 p-4">
      {/* ── Upload zone ── */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
            cursor-pointer transition-all duration-200 py-14
            ${isDragging
              ? "border-purple-400 bg-purple-900/20 scale-[1.01]"
              : "border-white/20 bg-white/5 hover:border-purple-500/60 hover:bg-purple-900/10"}
          `}
        >
          <Upload className="w-10 h-10 text-purple-400" />
          <p className="text-white/80 font-medium text-lg">Upload a PDF to analyse</p>
          <p className="text-white/40 text-sm">Drag & drop or click to select</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}
 
      {/* ── Processing spinner ── */}
      {processing && (
        <div className="flex items-center gap-3 bg-purple-900/30 border border-purple-500/30 rounded-xl px-4 py-3 text-purple-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Extracting &amp; indexing document…</span>
        </div>
      )}
 
      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
 
      {/* ── File badge ── */}
      {file && !processing && (
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-white/90 text-sm font-medium truncate">{file.name}</p>
              {docStats && (
                <p className="text-white/40 text-xs">{docStats.chunks} chunks indexed</p>
              )}
            </div>
          </div>
          <button
            onClick={removeFile}
            className="ml-3 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
 
      {/* ── Chat messages ── */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`
                  max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                  ${m.role === "user"
                    ? "bg-purple-600/80 text-white rounded-br-sm"
                    : "bg-white/8 border border-white/10 text-white/90 rounded-bl-sm"}
                `}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
 
      {/* ── Input bar ── */}
      {chunks.length > 0 && (
        <div className="flex gap-2 mt-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
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
            className="
              p-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40
              disabled:cursor-not-allowed transition-all text-white
              active:scale-95
            "
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      )}
    </div>
  );
};
 
export default PDFUpload;
