"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Send,
  Bot,
  User,
  CornerDownLeft,
  Image as ImageIcon,
  X,
  RotateCcw,
  Copy,
  Check,
  Zap,
  Activity,
  Cpu,
  AlertCircle,
  BarChart3,
  Users,
  ArrowRight,
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

  const userName = user?.fullName?.replace(" (Demo)", "") || "Supervisor";

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
          text: `Halo **${userName}**, saya adalah **DJI AI**.\n\nSaya siap menyajikan data analitik produksi mesin rajut, rasio deviasi cacat kain, rekap downtime mekanik/operator, dan identifikasi visual temuan masalah harian secara real-time.\n\nSilakan pilih topik analitik di bawah atau tanyakan apa saja seputar operasional pabrik.`,
          timestamp: "Baru saja",
        },
      ]);
    }
    setIsLoaded(true);
  }, [user, userName]);

  // Save history to sessionStorage whenever messages update
  useEffect(() => {
    if (isLoaded) {
      sessionStorage.setItem("dji_chatbot_history", JSON.stringify(messages));
    }
  }, [messages, isLoaded]);

  // Quick suggestions questions
  const quickSuggestions = [
    "Statistik produksi hari ini",
    "Mesin paling sering downtime",
    "Penyebab cacat terbanyak",
    "Daftar operator aktif",
    "Target produksi mesin",
  ];

  const capabilities = [
    {
      title: "Statistik Hasil Produksi",
      desc: "Total roll, meter kain, & mesin rajut yang sedang aktif beroperasi hari ini.",
      icon: BarChart3,
      prompt: "Bagaimana statistik hasil produksi hari ini?",
      badge: "Output Produksi",
      accent: "text-[#0070bc] bg-sky-50 border-sky-200",
      gradient: "from-[#0070bc] to-sky-500",
    },
    {
      title: "Analisa Cacat Dominan",
      desc: "Evaluasi deviasi jarum, bolong, garis, serta rekomendasi pencegahan.",
      icon: AlertCircle,
      prompt: "Analisa penyebab cacat kain terbanyak hari ini",
      badge: "Quality Control",
      accent: "text-rose-600 bg-rose-50 border-rose-200",
      gradient: "from-rose-500 to-red-600",
    },
    {
      title: "Monitoring Kendala & Downtime",
      desc: "Durasi mesin berhenti, penanganan teknisi mekanik, dan rincian masalah.",
      icon: Activity,
      prompt: "Mesin mana yang paling banyak mengalami kendala/downtime?",
      badge: "Downtime Mesin",
      accent: "text-amber-600 bg-amber-50 border-amber-200",
      gradient: "from-amber-500 to-orange-600",
    },
    {
      title: "Operator & Shift Kerja",
      desc: "Daftar operator yang bertugas per shift dan progres input laporan.",
      icon: Users,
      prompt: "Tampilkan daftar operator yang aktif hari ini",
      badge: "Shift Personel",
      accent: "text-emerald-600 bg-emerald-50 border-emerald-200",
      gradient: "from-emerald-500 to-teal-600",
    },
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
      text: `Riwayat percakapan telah dibersihkan.\n\nHalo **${userName}**, silakan pilih kartu analitik di bawah atau ketik pertanyaan seputar produksi dan kendala mesin.`,
      timestamp:
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB",
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
      // 2. Kirim request ke API Route AI
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: textToSend,
          userRole: user?.role,
          userName: user?.fullName,
          history: messages.slice(-8),
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
        text: "Maaf, gagal menghubungi server AI. Silakan periksa koneksi dan coba lagi.",
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

  const renderInline = (text: string, isAi: boolean, keyPrefix: string) => {
    // Tokenize: bold-italic (***), bold (**), italic (*), and inline code (`)
    const regex = /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|\*[^\*\n]+?\*|`[^`\n]+?`)/g;
    const parts = text.split(regex);

    return parts.map((part, pIdx) => {
      if (!part) return null;

      if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
        return (
          <strong
            key={`${keyPrefix}-${pIdx}`}
            className={`font-black italic ${isAi ? "text-slate-900" : "text-white"
              }`}
          >
            {part.slice(3, -3)}
          </strong>
        );
      }

      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong
            key={`${keyPrefix}-${pIdx}`}
            className={`font-black ${isAi ? "text-slate-900" : "text-white"
              }`}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return (
          <em
            key={`${keyPrefix}-${pIdx}`}
            className={`italic font-semibold ${isAi ? "text-slate-700" : "text-sky-100"
              }`}
          >
            {part.slice(1, -1)}
          </em>
        );
      }

      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={`${keyPrefix}-${pIdx}`}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold ${isAi
                ? "bg-sky-50 text-[#0070bc] border border-sky-200/70"
                : "bg-white/20 text-white border border-white/30"
              }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return part;
    });
  };

  const renderFormattedMarkdown = (content: string, isAi: boolean) => {
    const lines = content.split("\n");

    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Horizontal rule divider (--- or *** or ___)
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        return (
          <hr
            key={idx}
            className={`my-3 border-t ${isAi ? "border-slate-200" : "border-white/20"
              }`}
          />
        );
      }

      // Heading 3
      if (line.startsWith("### ")) {
        return (
          <h4
            key={idx}
            className={`font-black text-sm sm:text-base mt-3.5 mb-2 pb-1 border-b ${isAi
                ? "text-[#0070bc] border-sky-100"
                : "text-white border-white/20"
              }`}
          >
            {renderInline(line.replace("### ", ""), isAi, `h3-${idx}`)}
          </h4>
        );
      }

      // Heading 2
      if (line.startsWith("## ")) {
        return (
          <h3
            key={idx}
            className={`font-black text-base sm:text-lg mt-4 mb-2 pb-1 border-b ${isAi
                ? "text-slate-900 border-slate-200"
                : "text-white border-white/30"
              }`}
          >
            {renderInline(line.replace("## ", ""), isAi, `h2-${idx}`)}
          </h3>
        );
      }

      // Heading 1
      if (line.startsWith("# ")) {
        return (
          <h2
            key={idx}
            className={`font-black text-lg sm:text-xl mt-4 mb-2 pb-1 border-b ${isAi
                ? "text-slate-900 border-slate-200"
                : "text-white border-white/30"
              }`}
          >
            {renderInline(line.replace("# ", ""), isAi, `h1-${idx}`)}
          </h2>
        );
      }

      // Numbered lists (e.g. "1. ", "2. ")
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        const num = numMatch[1];
        const rest = numMatch[2];
        return (
          <div key={idx} className="flex items-start gap-2 my-1.5 pl-0.5">
            <span
              className={`font-black text-xs sm:text-sm shrink-0 min-w-[18px] ${isAi ? "text-[#0070bc]" : "text-sky-200"
                }`}
            >
              {num}.
            </span>
            <div className="flex-1 leading-relaxed text-xs sm:text-sm">
              {renderInline(rest, isAi, `num-${idx}`)}
            </div>
          </div>
        );
      }

      // Bullet points (- , • , * )
      const isBullet =
        trimmed.startsWith("- ") ||
        trimmed.startsWith("• ") ||
        (trimmed.startsWith("* ") && !trimmed.endsWith("*"));

      if (isBullet) {
        const cleanLine = trimmed.replace(/^[-•*]\s+/, "");
        return (
          <div key={idx} className="flex items-start gap-2.5 my-1 pl-1">
            <span
              className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isAi ? "bg-[#0070bc]" : "bg-sky-200"
                }`}
            />
            <span className="flex-1 leading-relaxed text-xs sm:text-sm">
              {renderInline(cleanLine, isAi, `bullet-${idx}`)}
            </span>
          </div>
        );
      }

      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="leading-relaxed my-1 text-xs sm:text-sm">
          {renderInline(line, isAi, `p-${idx}`)}
        </p>
      );
    });
  };

  const isInitialState = messages.length <= 1;

  return (
    <div className="flex-1 flex flex-col bg-white border border-slate-200/90 rounded-3xl h-[calc(100vh-110px)] overflow-hidden shadow-xl relative">
      {/* Top Accent Gradient Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 shrink-0" />

      {/* Modern Header Chat */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-150 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0070bc] via-sky-600 to-indigo-600 text-white shadow-lg shadow-[#0070bc]/25 ring-4 ring-sky-50 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none">
              DJI AI
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearHistory}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 active:scale-95 shadow-2xs"
            title="Bersihkan Riwayat Chat"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Reset Sesi</span>
          </button>
        </div>
      </div>

      {/* Messages Feed Area with subtle pattern */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 flex flex-col bg-slate-50/60 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] custom-scrollbar">
        {/* HERO WELCOME HUB (Tampil elegan saat sesi percakapan awal) */}
        {isInitialState && (
          <div className="max-w-3xl mx-auto w-full py-3 sm:py-6 animate-fadeIn">
            {/* Greeting Hero Card */}
            <div className="bg-gradient-to-br from-white via-sky-50/40 to-white border border-sky-100/90 rounded-3xl p-6 sm:p-7 shadow-sm relative overflow-hidden mb-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-sky-200/30 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0070bc] via-sky-500 to-indigo-600 text-white shadow-xl shadow-[#0070bc]/20 ring-8 ring-white flex items-center justify-center shrink-0">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Halo, {userName}! Apa yang ingin Anda analisa hari ini?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed">
                    Pilih salah satu modul pertanyaan cepat di bawah atau tanyakan apa saja mengenai statistik mesin, temuan cacat kain, dan rekap downtime mekanik.
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Interactive Capabilities Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-2">
              {capabilities.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(cap.prompt)}
                    className="group bg-white hover:bg-sky-50/40 border border-slate-200/90 hover:border-[#0070bc]/40 rounded-2xl p-4.5 text-left transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between active:scale-[0.99]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${cap.gradient} text-white flex items-center justify-center shadow-md shadow-slate-200 group-hover:scale-105 transition-transform`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${cap.accent}`}>
                          {cap.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-800 group-hover:text-[#0070bc] transition-colors">
                        {cap.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2 leading-relaxed">
                        {cap.desc}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-[#0070bc] transition-colors">
                      <span className="text-[11px]">Tanyakan sekarang</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Render Conversation Messages (if more than initial or after first reply) */}
        {!isInitialState &&
          messages.map((msg) => {
            const isAi = msg.sender === "ai";
            const isCopied = copiedMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[92%] sm:max-w-[85%] ${isAi ? "self-start" : "self-end flex-row-reverse"
                  } animate-fadeIn`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-sm ring-2 ${isAi
                    ? "bg-gradient-to-br from-[#0070bc] to-sky-600 text-white ring-sky-100"
                    : "bg-slate-800 border-slate-700 text-white ring-slate-200"
                    }`}
                >
                  {isAi ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>

                {/* Message Bubble Container */}
                <div className="space-y-1.5 group max-w-full">
                  <div
                    className={`p-4 sm:p-5 rounded-2xl shadow-sm relative transition-all ${isAi
                      ? "bg-white border border-slate-200/90 text-slate-800 rounded-tl-sm"
                      : "bg-gradient-to-r from-[#0070bc] to-sky-600 text-white border border-sky-600 rounded-tr-sm"
                      }`}
                  >
                    {/* Floating Copy Button for AI response */}
                    {isAi && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Salin Respon"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* Attached Image Preview if any */}
                    {msg.image && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 max-w-xs shadow-sm bg-black/5">
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
                  </div>

                  <div
                    className={`text-[10px] text-slate-400 font-bold px-1 flex items-center gap-1.5 ${!isAi && "justify-end"
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0070bc] to-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm ring-2 ring-sky-100">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white border border-slate-200/90 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2.5 shadow-sm">
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
              <span className="text-xs font-bold text-slate-500 ml-1">
                DJI AI sedang menganalisa data pabrik...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Prompts Bar (Tampil di atas input bar untuk memudahkan pertanyaan lanjutan) */}
      {!isInitialState && !isTyping && (
        <div className="px-5 py-2.5 bg-slate-50/90 border-t border-slate-150 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-[#0070bc]" /> Saran Topik:
          </span>
          <div className="flex items-center gap-2">
            {quickSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="text-[11px] font-bold text-slate-700 hover:text-[#0070bc] hover:bg-sky-50 bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview Selected Image before Send */}
      {selectedImage && (
        <div className="px-5 py-2.5 bg-sky-50/70 border-t border-sky-100 flex items-center justify-between shrink-0 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-sky-200 shadow-sm relative shrink-0">
              <img
                src={selectedImage}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="text-xs font-black text-slate-800 block">
                Foto Cacat Kain Terlampir
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                DJI AI akan mengidentifikasi visual jenis cacat pada foto ini
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            title="Hapus Lampiran"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Elevated Modern Composer Dock */}
      <div className="p-3.5 sm:p-4 border-t border-slate-150 bg-white shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        <div className="relative flex items-center gap-2 max-w-5xl mx-auto bg-slate-50/80 border border-slate-200 rounded-2xl p-1.5 focus-within:border-[#0070bc] focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100/60 transition-all shadow-xs">
          {/* Upload Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${selectedImage
              ? "bg-sky-100 text-[#0070bc] border border-sky-300"
              : "text-slate-500 hover:text-[#0070bc] hover:bg-slate-200/60"
              }`}
            title="Unggah Foto Cacat Kain / Mesin"
          >
            <ImageIcon className="w-5 h-5" />
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

          <div className="flex items-center gap-2 pr-1">
            <span className="hidden sm:flex items-center gap-1 text-[9px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
              Enter <CornerDownLeft className="w-2.5 h-2.5 text-slate-400" />
            </span>
            <button
              onClick={() => handleSend(inputText)}
              disabled={isTyping || (!inputText.trim() && !selectedImage)}
              className="p-2.5 sm:px-4 rounded-xl bg-gradient-to-r from-[#0070bc] to-sky-600 hover:from-sky-600 hover:to-blue-700 active:scale-95 disabled:opacity-40 disabled:scale-100 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#0070bc]/20"
              title="Kirim Pesan"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-black tracking-wide">Kirim</span>
            </button>
          </div>
        </div>

        <div className="text-center mt-2">

        </div>
      </div>
    </div>
  );
}
