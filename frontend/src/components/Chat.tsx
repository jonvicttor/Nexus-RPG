import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  type: 'chat' | 'roll' | 'info' | 'damage';
  timestamp: string;
  isSecret?: boolean;       
  secretContent?: string;   
  
  // --- NOVAS PROPS PARA COMBATE ---
  targetId?: number | null; 
  isHit?: boolean;          
}

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  role: 'DM' | 'PLAYER';
  onApplyDamage?: (targetId: number, damageExpression: string) => void; // Nova função recebida
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, role, onApplyDamage }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  };

  return (
    <div className="flex flex-col h-full bg-black/80 text-white border-l border-white/10 font-sans text-sm relative">
      <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-3 pb-20">
        {messages.map((msg) => {
          let content = msg.text;
          let styleClass = "text-gray-300";

          if (msg.isSecret) {
             if (role === 'DM') {
                 content = msg.secretContent || msg.text;
                 styleClass = "text-purple-300 bg-purple-900/20 p-1 rounded border border-purple-500/30"; 
             } else {
                 content = "🎲 *Alguém rolou dados misteriosamente...*";
                 styleClass = "text-gray-500 italic opacity-70";
             }
          } else {
             if (msg.type === 'roll') styleClass = "text-cyan-400 font-bold font-mono";
             if (msg.type === 'damage') styleClass = "text-red-400 font-bold bg-red-900/20 p-2 rounded border border-red-500/30";
             if (msg.type === 'info') styleClass = "text-yellow-500 italic";
          }

          return (
            <div key={msg.id} className="break-words animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className={`font-bold text-[10px] uppercase tracking-wider ${msg.sender === 'Mestre' || msg.sender === 'Sistema' ? 'text-yellow-600' : 'text-blue-500'}`}>
                  {msg.sender}
                </span>
                <span className="text-[9px] text-gray-600">{msg.timestamp}</span>
              </div>
              <div className={`text-xs leading-relaxed ${styleClass}`}>
                 <span dangerouslySetInnerHTML={{ __html: formatText(content) }} />
                 
                 {/* --- BOTÃO DE APLICAR DANO APARECE AQUI SE HOUVE ACERTO --- */}
                 {msg.isHit && msg.targetId && onApplyDamage && (role === 'DM' || msg.sender !== 'Mestre') && (
                     <div className="mt-2 flex gap-2">
                         <button 
                             onClick={() => onApplyDamage(msg.targetId as number, "1d8")}
                             className="bg-red-700 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-[10px] uppercase tracking-widest border border-red-500/50 shadow-md active:scale-95 transition-all"
                         >
                             🩸 Dano (1d8)
                         </button>
                         <button 
                             onClick={() => onApplyDamage(msg.targetId as number, "1d6")}
                             className="bg-red-900 hover:bg-red-800 text-white font-bold py-1 px-2 rounded text-[10px] uppercase tracking-widest border border-red-700/50 shadow-md active:scale-95 transition-all"
                         >
                             🗡️ Dano (1d6)
                         </button>
                     </div>
                 )}
                 
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="absolute bottom-0 left-0 w-full p-2 border-t border-white/10 bg-black/90 flex gap-2 backdrop-blur-md z-10">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Mensagem ou /r 1d20..."
          className="flex-grow bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
        />
        <button 
          type="submit" 
          disabled={!inputText.trim()}
          className="bg-yellow-700/80 hover:bg-yellow-600 text-white p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default Chat;