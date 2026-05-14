import { useEffect, useRef, useState } from 'react';
import { ai } from '../lib/api.js';

// ── Markdown renderer ─────────────────────────────────────────────────────────
// Handles **bold**, line breaks, and ordered/unordered list items.

function renderMarkdown(text) {
  const paragraphs = text.split(/\n{2,}/);

  return paragraphs.map((para, pi) => {
    const lines = para.split('\n');
    const isListBlock = lines.every(l => /^(\d+\.|[-•*])\s/.test(l.trim()) || l.trim() === '');

    if (isListBlock) {
      const items = lines.filter(l => l.trim());
      const ordered = /^\d+\./.test(items[0]?.trim() ?? '');
      const Tag     = ordered ? 'ol' : 'ul';
      return (
        <Tag key={pi} className={`${ordered ? 'list-decimal' : 'list-disc'} list-inside space-y-0.5 ${pi > 0 ? 'mt-2' : ''}`}>
          {items.map((item, ii) => {
            const content = item.replace(/^(\d+\.|[-•*])\s+/, '');
            return <li key={ii}>{renderInline(content)}</li>;
          })}
        </Tag>
      );
    }

    return (
      <p key={pi} className={pi > 0 ? 'mt-2' : ''}>
        {lines.map((line, li) => (
          <span key={li}>
            {renderInline(line)}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-100 rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 bg-gray-400 rounded-full inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mr-2 mt-0.5"
          style={{ background: 'linear-gradient(135deg,#47c8ff,#6366f1)', color: '#0d0d0d' }}>
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-brand-500 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
          }`}
      >
        {isUser ? content : renderMarkdown(content)}
      </div>
    </div>
  );
}

// ── Main AIChat component ─────────────────────────────────────────────────────

export default function AIChat({ isOpen, onClose, prefillMessage }) {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [typing,    setTyping]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load chat history once when opened for the first time
  useEffect(() => {
    if (!isOpen || messages.length > 0) return;
    setLoading(true);
    ai.chatHistory(40)
      .then(history => setMessages(history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Prefill from ConflictAlerts "Ask AI" button
  useEffect(() => {
    if (prefillMessage && isOpen) {
      setInput(prefillMessage);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [prefillMessage, isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typing, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || typing) return;

    setInput('');
    const optimisticUser = { role: 'user', content: text, id: `tmp-${Date.now()}` };
    setMessages(m => [...m, optimisticUser]);
    setTyping(true);

    try {
      const { response } = await ai.chat(text);
      setMessages(m => [
        ...m.filter(msg => msg.id !== optimisticUser.id),
        { role: 'user',      content: text,     id: `u-${Date.now()}` },
        { role: 'assistant', content: response, id: `a-${Date.now()}` },
      ]);
    } catch (err) {
      setMessages(m => [
        ...m.filter(msg => msg.id !== optimisticUser.id),
        { role: 'user',      content: text, id: `u-${Date.now()}` },
        { role: 'assistant', content: `Sorry, something went wrong: ${err.message}`, id: `e-${Date.now()}` },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed inset-y-0 right-0 z-50
          w-full sm:w-96
          bg-white shadow-2xl flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#0d0d0d,#1a0d2e)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#47c8ff,#6366f1)' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="#0d0d0d"/>
                <rect x="9" y="2" width="5" height="5" rx="1" fill="#0d0d0d"/>
                <rect x="2" y="9" width="12" height="5" rx="1" fill="#0d0d0d"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">ScheduleAI Assistant</h3>
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Online · knows your schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-lg"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-2xl mb-3">
                🏗️
              </div>
              <h4 className="font-medium text-gray-700 mb-1">Your AI Scheduling Assistant</h4>
              <p className="text-xs text-gray-400">
                Ask me about conflicts, crew availability, job status, or get help drafting documents.
              </p>
              <div className="mt-4 space-y-2 w-full">
                {[
                  'Who is available tomorrow?',
                  'Any conflicts this week?',
                  'Draft a client update for my kitchen remodel',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="w-full text-left text-xs border border-gray-200 hover:border-brand-300 rounded-lg px-3 py-2 text-gray-600 hover:text-brand-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={msg.id ?? i} role={msg.role} content={msg.content} />
          ))}

          {typing && (
            <div className="flex items-start">
              <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mr-2 mt-0.5">
                AI
              </div>
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-gray-200 p-3 flex gap-2 flex-shrink-0 bg-white">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your schedule…"
            rows={1}
            disabled={typing}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm
              focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
              disabled:opacity-50 placeholder:text-gray-400
              min-h-[42px] max-h-32 overflow-y-auto"
            style={{ height: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="w-10 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40
              flex items-center justify-center text-white transition-colors flex-shrink-0 self-end"
          >
            {typing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
        </form>
      </div>
    </>
  );
}
