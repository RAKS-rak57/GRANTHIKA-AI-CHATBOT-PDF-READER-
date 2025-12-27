import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Upload, X } from 'lucide-react';
import { askGemini } from "./lib/gemini.ts";


import Sidebar from './components/Sidebar';
import MessageCard from './components/MessageCard';
import PDFUpload from './components/PDFUpload';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'code' | 'analysis';
}

interface UploadedFile {
  file: File;
  timestamp: Date;
}

function App() {
  const [activeMode, setActiveMode] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: 'Welcome to Cosmic Chat! Select a mode from the sidebar to get started.',
      sender: 'bot',
      timestamp: new Date(),
      type: 'text',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
 
  
  /* ---------------------------------- */
  /* Utilities                           */
  /* ---------------------------------- */

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getModeGreeting = () => {
    switch (activeMode) {
      case 'chat':
        return 'Chat mode activated. How can I help you today?';
      case 'code':
        return 'Code mode activated. Ask me about programming or debugging.';
      case 'analysis':
        return 'Analysis mode activated. Upload PDFs or ask questions.';
      case 'settings':
        return 'Settings mode activated.';
      default:
        return 'Mode activated!';
    }
  };

  /* ---------------------------------- */
  /* Mode Change                         */
  /* ---------------------------------- */

  const handleModeChange = (mode: string) => {
    setActiveMode(mode);
    setMessages([
      {
        id: Date.now().toString(),
        text: getModeGreeting(),
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
      },
    ]);
  };

  /* ---------------------------------- */
  /* Bot Response Logic (TEMP)           */
  /* Gemini-ready structure              */
  /* ---------------------------------- */

  




  /* ---------------------------------- */
  /* Messaging                           */
  /* ---------------------------------- */

  const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim()) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    text: input,
    sender: 'user',
    timestamp: new Date(),
    type: 'text',
  };

  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);

  try {
    const reply = await askGemini(userMessage.text);

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: reply,
      sender: 'bot',
      timestamp: new Date(),
      type: 'text',
    };

    setMessages(prev => [...prev, botMessage]);
  } catch (err) {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        text: '⚠️ Failed to contact Gemini.',
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
      }
    ]);
  } finally {
    setIsLoading(false);
  }
};


  /* ---------------------------------- */
  /* File Upload                         */
  /* ---------------------------------- */

  const handleFileSelect = (file: File) => {
    const newFile: UploadedFile = {
      file,
      timestamp: new Date(),
    };

    setUploadedFiles((prev) => [...prev, newFile]);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: `File uploaded: ${file.name}`,
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
      },
    ]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* ---------------------------------- */
  /* Clear Chat                          */
  /* ---------------------------------- */

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        text: getModeGreeting(),
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
      },
    ]);
  };

  /* ---------------------------------- */
  /* Render                              */
  /* ---------------------------------- */

  return (
    <div className="app-container">
      <Sidebar activeMode={activeMode} onModeChange={handleModeChange} />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="glass px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">
              {activeMode.charAt(0).toUpperCase() + activeMode.slice(1)}
            </h1>
            <p className="text-sm text-purple-200/70">
              {getModeGreeting()}
            </p>
          </div>

          <button
            onClick={handleClearChat}
            className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-300"
            title="Clear chat"
          >
            <Trash2 size={20} />
          </button>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <PDFUpload onFileSelect={handleFileSelect} disabled={isLoading} />

            {uploadedFiles.length > 0 && (
              <div className="glass-soft p-4 rounded-2xl">
                <h3 className="text-sm font-semibold text-purple-200 mb-3">
                  Uploaded Files
                </h3>
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 px-3 py-2 rounded-lg"
                    >
                      <Upload size={14} />
                      <span className="text-sm">{item.file.name}</span>
                      <button onClick={() => removeFile(index)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <MessageCard key={msg.id} {...msg} />
            ))}

            {isLoading && (
              <div className="glass-soft px-4 py-3 rounded-2xl w-fit">
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Footer */}
        <footer className="glass-soft px-8 py-4">
          <form onSubmit={handleSendMessage} className="flex gap-3 max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-full bg-purple-600/20 border border-purple-500/30"
            >
              <Upload size={18} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 glass-soft px-4 py-3 rounded-full"
            />

            <button
              type="submit"
              disabled={!input.trim()}
              className="p-3 rounded-full bg-gradient-to-r from-purple-600 to-violet-600"
            >
              <Send size={18} />
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}

export default App;
