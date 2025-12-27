import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export interface MessageCardProps {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'code' | 'analysis';
}

export default function MessageCard({
  id,
  text,
  sender,
  timestamp,
  type = 'text',
}: MessageCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = sender === 'user';

  const baseClasses = `max-w-xl px-5 py-3 rounded-2xl transition-all glass glass-hover text-white ${
    isUser ? 'rounded-br-none' : 'rounded-bl-none'

  }`;

  const renderContent = () => {
    if (type === 'code') {
      return (
        <div
          className={`glass text-purple-100 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-white/20 backdrop-blur-sm ${
            !isUser ? 'mt-3' : ''
          }`}
        >
          <pre className="whitespace-pre-wrap text-purple-200">{text}</pre>
        </div>
      );
    }

    if (type === 'analysis') {
      return (
        <div
          className={`${
            !isUser ? 'bg-purple-600/20 p-3 rounded-lg mt-2 border-l-4 border-purple-400 backdrop-blur-sm' : ''
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-purple-100">{text}</p>
        </div>
      );
    }

    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={baseClasses}>
        {renderContent()}
        <div className="flex items-center justify-between mt-2 gap-2">
          <span
            className={`text-xs ${
              isUser ? 'text-purple-200/60' : 'text-purple-300/50'
            }`}
          >
            {timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {!isUser && type === 'code' && (
            <button
              onClick={handleCopy}
              className="text-xs text-purple-300/60 hover:text-purple-200 transition flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check size={14} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
