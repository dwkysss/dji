"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Send,
  Bot,
  User,
  Sparkles,
  CornerDownLeft,
  Image as ImageIcon,
  X,
  RotateCcw,
  Copy,
  Check,
  Zap,
  Activity,
  Cpu,
  AlertCircle
} from "lucide-react";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  image?: string | null;
}

export default function ChatbotPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("dji_chatbot_history");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        setMessages([]);
      }
    } else {
      setMessages([
        {
          id: "1",
          sender: "ai",
          text: `Halo **${user?.fullName?.replace(" (Demo)", "") || "Supervisor"}**, saya adalah **DJI Enterprise Assistant AI**.\n\nSaya dapat menyajikan data real-time analitik produksi mesin rajut, rasio deviasi cacat kain, rekap downtime mekanik/operator, dan identifikasi visual temuan masalah mesin rajut harian.\n\nAda yang bisa saya bantu hari ini?`,
          timestamp: "Baru saja",
        },
      ]);
    }
    setIsLoaded(true);
  }, [user]);

  // Save history to sessionStorage whenever messages update
  useEffect(() => {
    if (isLoaded) {
      sessionStorage.setItem("dji_chatbot_history", JSON.stringify(messages));
    }
  }, [messages, isLoaded]);

  // Quick suggestions questions
  const suggestions = [
    "Bagaimana statistik hasil produksi hari ini?",
    "Mesin mana yang paling banyak mengalami kendala/downtime?",
    "Tampilkan daftar operator yang aktif hari ini",
    "Analisa penyebab cacat kain terbanyak",
    "Berapa target produksi mesin saat ini?",
  ];

  // Auto Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Hanya file gambar yang diperbolehkan.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setSelectedImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClearHistory = () => {
    const defaultMsg: Message = {
      id: Date.now().toString(),
      sender: "ai",
      text: `Riwayat percakapan telah dibersihkan.\n\nHalo **${user?.fullName?.replace(" (Demo)", "") || "Supervisor"}**, silakan tanyakan analitik produksi pabrik atau unggah foto cacat kain untuk dianalisa.`,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
    };
    setMessages([defaultMsg]);
    sessionStorage.removeItem("dji_chatbot_history");
  };

  const handleCopyText = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() && !selectedImage) return;

    const timestamp =
      new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB";

    const currentImage = selectedImage;

    // 1. Tambahkan pesan user ke chat feed
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend.trim(),
      timestamp,
      image: currentImage,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputText("");
    setSelectedImage(null);
    setIsTyping(true);

    try {
      // 2. Kirim request ke API Route AI Gemini
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: textToSend,
          userRole: user?.role,
          userName: user?.fullName,
          history: messages.slice(-8), // Send recent context
          image: currentImage,
        }),
      });

      const data = await res.json();

      const newAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.reply || "Terjadi kesalahan yang tidak diketahui.",
        timestamp:
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }) + " WIB",
      };

      setMessages((prev) => [...prev, newAiMessage]);
    } catch (error) {
      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "Maaf, gagal menghubungi server AI. Silakan coba lagi.",
        timestamp:
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }) + " WIB",
      };
      setMessages((prev) => [...prev, errorAiMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend(inputText);
    }
  };

  const renderFormattedMarkdown = (content: string, isAi: boolean) => {
    const lines = content.split("\n");

    return lines.map((line, idx) => {
      // Heading 3
      if (line.startsWith("### ")) {
        return (
          <h4
            key={idx}
            className={`font-black text-sm mt-3 mb-1.5 ${
              isAi ? "text-[#0070bc]" : "text-white"
            }`}
          >
            {line.replace("### ", "")}
          </h4>
        );
      }

      // Heading 2
      if (line.startsWith("## ")) {
        return (
          <h3
            key={idx}
            className={`font-black text-base mt-3 mb-1.5 ${
              isAi ? "text-slate-900" : "text-white"
            }`}
          >
            {line.replace("## ", "")}
          </h3>
        );
      }

      // Bullet points
      const isBullet =
        line.trim().startsWith("- ") ||
        line.trim().startsWith("• ") ||
        line.trim().startsWith("* ");
      const cleanLine = isBullet
        ? line.trim().replace(/^[-•*]\s*/, "")
        : line;

      // Parse bold segments **text**
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const boldText = part.slice(2, -2);
          return (
            <strong
              key={pIdx}
              className={
                isAi
                  ? "font-extrabold text-slate-900"
                  : "font-extrabold text-white"
              }
            >
              {boldText}
            </strong>
          );
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-2 my-0.5 pl-1">
            <span
              className={`font-black shrink-0 ${
                isAi ? "text-[#0070bc]" : "text-sky-200"
              }`}
            >
              •
            </span>
            <span className="flex-1 leading-relaxed">{renderedParts}</span>
          </div>
        );
      }

      if (!cleanLine.trim()) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="leading-relaxed my-0.5">
          {renderedParts}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-3xl h-[calc(100vh-120px)] overflow-hidden shadow-xl relative">
      {/* Header Chat */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xs">
            <Bot className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white leading-none">
                DJI Enterprise AI
              </h3>
              <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" /> Gemini Native
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Asisten Cerdas Analitik Produksi & Diagnosa Mesin Rajut
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearHistory}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700 active:scale-95"
            title="Bersihkan Riwayat Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Messages Feed Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 flex flex-col bg-slate-50/50 custom-scrollbar">
        {messages.map((msg) => {
          const isAi = msg.sender === "ai";
          const isCopied = copiedMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[92%] sm:max-w-[85%] ${
                isAi ? "self-start" : "self-end flex-row-reverse"
              } animate-fadeIn`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 text-xs shadow-xs ${
                  isAi
                    ? "bg-[#0070bc] border-[#0070bc] text-white"
                    : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {isAi ? <Bot className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
              </div>

              {/* Message Bubble Container */}
              <div className="space-y-1.5 group">
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm border shadow-xs relative ${
                    isAi
                      ? "bg-white border-slate-200/80 text-slate-700 rounded-tl-none"
                      : "bg-[#0070bc] border-sky-600 text-white rounded-tr-none font-normal"
                  }`}
                >
                  {/* Attached Image Preview if any */}
                  {msg.image && (
                    <div className="mb-3 rounded-xl overflow-hidden border border-white/20 max-w-xs shadow-sm bg-black/5">
                      <img
                        src={msg.image}
                        alt="Uploaded Attachment"
                        className="w-full h-auto max-h-48 object-cover"
                      />
                    </div>
                  )}

                  {/* Render Formatted Text */}
                  <div className="text-xs sm:text-sm">
                    {renderFormattedMarkdown(msg.text, isAi)}
                  </div>

                  {/* Copy Button for AI response */}
                  {isAi && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Salin Respon"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                <div
                  className={`text-[9px] text-slate-400 font-bold px-1 flex items-center gap-1.5 ${
                    !isAi && "justify-end"
                  }`}
                >
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* AI Typing Indicator */}
        {isTyping && (
          <div className="flex gap-3 self-start max-w-[80%] animate-fadeIn">
            <div className="w-8 h-8 rounded-xl bg-[#0070bc] border border-[#0070bc] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none flex items-center gap-2 h-11 shadow-xs">
              <span
                className="w-2 h-2 rounded-full bg-[#0070bc] animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-[#0070bc] animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-[#0070bc] animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
              <span className="text-[11px] font-bold text-slate-400 ml-1">
                DJI AI sedang menganalisa data...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Prompts Bar */}
      {messages.length <= 2 && !isTyping && (
        <div className="px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-col gap-1.5 shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#0070bc]" /> Pertanyaan Cepat Analitik:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="text-[11px] font-bold text-slate-700 hover:text-[#0070bc] hover:bg-sky-50 bg-white border border-slate-200 rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 text-left"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview Selected Image before Send */}
      {selectedImage && (
        <div className="px-5 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 relative shrink-0">
              <img
                src={selectedImage}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="text-xs font-black text-slate-800 block">
                Foto Cacat Terlampir
              </span>
              <span className="text-[10px] text-slate-500">
                AI Vision akan menganalisis temuan masalah pada foto ini
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
            title="Hapus Lampiran"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Bar Area */}
      <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        <div className="relative flex items-center gap-2 max-w-5xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-[#0070bc] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0070bc]/10 transition-all shadow-xs">
          {/* Upload Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
              selectedImage
                ? "bg-sky-100 text-[#0070bc] border border-sky-300"
                : "text-slate-500 hover:text-[#0070bc] hover:bg-slate-200/60"
            }`}
            title="Unggah Foto Cacat Kain / Mesin"
          >
            <ImageIcon className="w-4.5 h-4.5" />
          </button>

          <input
            type="text"
            disabled={isTyping}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 bg-transparent text-slate-800 text-xs sm:text-sm outline-none border-none py-1.5 px-1 focus:ring-0 placeholder:text-slate-400 font-medium"
            placeholder="Tanyakan analitik produksi, kendala mesin rajut, atau kirim foto cacat kain..."
          />

          <div className="flex items-center gap-1.5 pr-1">
            <span className="hidden sm:flex items-center gap-0.5 text-[9px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
              Enter <CornerDownLeft className="w-2.5 h-2.5 text-slate-400" />
            </span>
            <button
              onClick={() => handleSend(inputText)}
              disabled={isTyping || (!inputText.trim() && !selectedImage)}
              className="p-2.5 rounded-xl bg-[#0070bc] hover:bg-sky-700 active:scale-95 disabled:opacity-40 disabled:hover:bg-[#0070bc] disabled:scale-100 text-white transition-all cursor-pointer flex items-center justify-center shadow-xs"
              title="Kirim Pesan"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
