import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/server';

const FALLBACK_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
];

async function generateContentWithFallback(genAIInstance: GoogleGenerativeAI, contentsPayload: any[]) {
  let lastError: any = null;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAIInstance.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contentsPayload);
      const text = result.response.text().trim();
      if (text) {
        return { text, usedModel: modelName };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[DJI AI Fallback] Model ${modelName} failed or hit quota (${err?.message?.substring(0, 80)}). Trying next model...`);
    }
  }
  throw lastError || new Error("All Gemini AI models failed or hit quota limits.");
}

function getJakartaDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchFactoryLiveContext() {
  try {
    const supabase = await createAdminClient();
    const today = getJakartaDate();

    // Fetch in parallel: headers, registered operators, downtime records, and plans
    const [headersRes, operatorsRes, downtimeRes, plansRes] = await Promise.all([
      supabase
        .from("production_headers")
        .select(`
          id,
          tgl,
          tanggal_jam,
          nomor_mc,
          design_id,
          potongan_ke,
          panel_no,
          pcs,
          meter_awal,
          meter_akhir,
          total_produksi_meter,
          total_downtime_detik,
          downtime_events,
          operator_backup,
          pic,
          created_by_name,
          operators (nama_operator),
          groups (nama_grup),
          production_details (
            id,
            pcs_index,
            jml_hasil_produksi,
            status_inspeksi,
            status_mending,
            kategori_masalah,
            detail_masalah,
            keterangan_cacat,
            meter_kain
          )
        `)
        .order("tanggal_jam", { ascending: false })
        .limit(100),

      supabase
        .from("operators")
        .select("id, nama_operator, shift")
        .order("nama_operator", { ascending: true }),

      supabase
        .from("downtime_records")
        .select("kategori, detail, durasi_detik, blok, dikerjakan_oleh")
        .order("created_at", { ascending: false })
        .limit(40),

      supabase
        .from("production_plans")
        .select("id, nomor_mc, target_roll, target_meter, design_id, status")
        .limit(20)
    ]);

    const headers = headersRes.data || [];
    const masterOperators = operatorsRes.data || [];
    const downtimeRecords = downtimeRes.data || [];
    const plans = plansRes.data || [];

    // Aggregate metrics
    let totalPanelsToday = 0;
    let totalMetersToday = 0;
    let totalDefectsToday = 0;
    let totalDowntimeSecsToday = 0;

    const machineStatsToday: Record<string, { panels: number; meters: number; defects: number; downtimeSecs: number; operators: Set<string> }> = {};
    const activeOperatorsTodayMap = new Map<string, { group: string; machines: Set<string>; reportsCount: number }>();
    const defectOccurrences: Record<string, number> = {};
    const downtimeCauses: Record<string, number> = {};

    headers.forEach((h: any) => {
      const isToday = h.tgl === today;
      const mc = (h.nomor_mc || "UNKNOWN").toUpperCase();
      const opr = (h.operators?.nama_operator || h.pic || h.created_by_name || "").trim();
      const grp = h.groups?.nama_grup || "-";

      const meterVal = parseFloat(h.total_produksi_meter || "0") || 0;
      const pcsVal = parseInt(h.pcs || "1") || 1;
      const dtSec = parseInt(h.total_downtime_detik || "0") || 0;

      if (isToday) {
        totalMetersToday += meterVal;
        totalPanelsToday += pcsVal;
        totalDowntimeSecsToday += dtSec;

        if (!machineStatsToday[mc]) {
          machineStatsToday[mc] = { panels: 0, meters: 0, defects: 0, downtimeSecs: 0, operators: new Set() };
        }
        machineStatsToday[mc].meters += meterVal;
        machineStatsToday[mc].panels += pcsVal;
        machineStatsToday[mc].downtimeSecs += dtSec;
        if (opr) machineStatsToday[mc].operators.add(opr);

        if (opr) {
          if (!activeOperatorsTodayMap.has(opr)) {
            activeOperatorsTodayMap.set(opr, { group: grp, machines: new Set([mc]), reportsCount: 1 });
          } else {
            const existing = activeOperatorsTodayMap.get(opr)!;
            existing.machines.add(mc);
            existing.reportsCount += 1;
          }
        }
      }

      (h.production_details || []).forEach((d: any) => {
        if (d.kategori_masalah || d.detail_masalah) {
          const cat = d.kategori_masalah || d.detail_masalah || "Umum";
          defectOccurrences[cat] = (defectOccurrences[cat] || 0) + 1;
          if (isToday) {
            totalDefectsToday += 1;
            if (machineStatsToday[mc]) machineStatsToday[mc].defects += 1;
          }
        }
      });

      // Parse downtime_events JSON from header if present
      try {
        if (h.downtime_events) {
          const parsed = typeof h.downtime_events === 'string' ? JSON.parse(h.downtime_events) : h.downtime_events;
          if (Array.isArray(parsed)) {
            parsed.forEach((e: any) => {
              const cat = e.kategori || "Teknis Mesin";
              const dur = parseInt(e.durasiDetik || "0") || 0;
              downtimeCauses[cat] = (downtimeCauses[cat] || 0) + dur;
            });
          }
        }
      } catch (e) {}
    });

    downtimeRecords.forEach((dr: any) => {
      const dtCat = dr.kategori || "Kendala Mekanik";
      downtimeCauses[dtCat] = (downtimeCauses[dtCat] || 0) + (parseInt(dr.durasi_detik || "0") || 0);
    });

    const activeMachinesToday = Object.keys(machineStatsToday);
    const activeOperatorsTodayList = Array.from(activeOperatorsTodayMap.entries()).map(([opr, info]) => 
      `${opr} (Grup ${info.group}, Mesin ${Array.from(info.machines).join(", ")}, ${info.reportsCount} input)`
    );

    const topDefects = Object.entries(defectOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, count]) => `${cat} (${count} temuan)`);

    const topDowntime = Object.entries(downtimeCauses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, secs]) => `${cat}: ${Math.round(secs / 60)} Menit`);

    // Group master operators by shift
    const masterShiftA = masterOperators.filter((o: any) => o.shift === "A").map((o: any) => o.nama_operator);
    const masterShiftB = masterOperators.filter((o: any) => o.shift === "B").map((o: any) => o.nama_operator);
    const masterShiftC = masterOperators.filter((o: any) => o.shift === "C").map((o: any) => o.nama_operator);

    return {
      today,
      totalPanelsToday,
      totalMetersToday,
      totalDefectsToday,
      totalDowntimeMinutesToday: Math.round(totalDowntimeSecsToday / 60),
      activeMachinesToday,
      machineSummaryToday: Object.entries(machineStatsToday).map(([mc, s]) => 
        `Mesin ${mc}: ${s.panels} Pcs/Roll (${s.meters} Meter), ${s.defects} Defect, Operator: ${Array.from(s.operators).join(", ") || "-"}`
      ),
      activeOperatorsTodayList,
      masterShiftA,
      masterShiftB,
      masterShiftC,
      totalRegisteredOperators: masterOperators.length,
      topDefects: topDefects.length > 0 ? topDefects : ["Tidak ada cacat mayor tercatat"],
      topDowntime: topDowntime.length > 0 ? topDowntime : ["Tidak ada downtime mayor tercatat"],
      plans: plans.map((p: any) => `Mesin ${p.nomor_mc}: Target ${p.target_roll || p.target_meter || '-'} | Status: ${p.status || 'Active'}`)
    };
  } catch (err: any) {
    console.error("Gagal mengambil context pabrik:", err);
    return null;
  }
}

function generateSmartRuleReply(query: string, factoryData: any): string {
  const q = query.toLowerCase();
  
  if (!factoryData) {
    return "Maaf, sistem sedang memuat data operasional. Silakan ulangi pertanyaan Anda beberapa saat lagi.";
  }

  if (q.includes("operator") || q.includes("pegawai") || q.includes("petugas") || q.includes("shift")) {
    let text = `### Daftar Operator Produksi (${factoryData.today})\n\n`;

    if (factoryData.activeOperatorsTodayList.length > 0) {
      text += `**Operator Aktif yang Telah Menginput Data Hari Ini:**\n`;
      text += factoryData.activeOperatorsTodayList.map((op: string) => `• **${op}**`).join("\n") + "\n\n";
    } else {
      text += `*Belum ada operator yang menginput laporan pada tanggal hari ini (${factoryData.today}).*\n\n`;
    }

    text += `**Daftar Master Operator per Shift (Total: ${factoryData.totalRegisteredOperators} Orang):**\n`;
    if (factoryData.masterShiftA.length > 0) text += `• **Shift A**: ${factoryData.masterShiftA.slice(0, 10).join(", ")}${factoryData.masterShiftA.length > 10 ? "..." : ""}\n`;
    if (factoryData.masterShiftB.length > 0) text += `• **Shift B**: ${factoryData.masterShiftB.slice(0, 10).join(", ")}${factoryData.masterShiftB.length > 10 ? "..." : ""}\n`;
    if (factoryData.masterShiftC.length > 0) text += `• **Shift C**: ${factoryData.masterShiftC.slice(0, 10).join(", ")}${factoryData.masterShiftC.length > 10 ? "..." : ""}\n`;

    return text;
  }

  if (q.includes("statistik") || q.includes("produksi") || q.includes("hari ini")) {
    let text = `### Ringkasan Statistik Produksi Hari Ini (${factoryData.today})\n\n` +
      `- **Total Hasil**: ${factoryData.totalPanelsToday} Roll/Panel (${factoryData.totalMetersToday} Meter)\n` +
      `- **Total Temuan Cacat**: ${factoryData.totalDefectsToday} Defect\n` +
      `- **Total Downtime Mesin**: ${factoryData.totalDowntimeMinutesToday} Menit\n` +
      `- **Mesin Aktif Hari Ini**: ${factoryData.activeMachinesToday.join(", ") || "Belum ada laporan mesin aktif"}\n\n`;

    if (factoryData.machineSummaryToday.length > 0) {
      text += `**Rincian per Mesin:**\n` +
        factoryData.machineSummaryToday.map((m: string) => `• ${m}`).join("\n");
    }
    return text;
  }

  if (q.includes("cacat") || q.includes("defect") || q.includes("kualitas") || q.includes("masalah")) {
    return `### Analisis Masalah Kualitas & Cacat Utama\n\n` +
      `- **Total Cacat Hari Ini**: ${factoryData.totalDefectsToday} temuan\n` +
      `**Temuan Paling Sering Muncul:**\n` +
      factoryData.topDefects.map((d: string) => `• ${d}`).join("\n") +
      `\n\n*Rekomendasi Teknis*: Pastikan ketegangan benang dan kondisi jarum rajut diperiksa sebelum start produksi.`;
  }

  if (q.includes("downtime") || q.includes("berhenti") || q.includes("rusak") || q.includes("kendala")) {
    return `### Analisis Downtime Mesin\n\n` +
      `- **Total Durasi Hari Ini**: ${factoryData.totalDowntimeMinutesToday} Menit\n` +
      `**Penyebab Terbanyak:**\n` +
      factoryData.topDowntime.map((dt: string) => `• ${dt}`).join("\n");
  }

  if (q.includes("target") || q.includes("plan") || q.includes("rencana")) {
    return `### Rencana & Target Produksi Aktif\n\n` +
      factoryData.plans.map((p: string) => `• ${p}`).join("\n");
  }

  return `Halo! Saya adalah **DJI Enterprise Assistant AI**.\n\n` +
    `Data ringkas hari ini (${factoryData.today}):\n` +
    `• **Total Produksi**: ${factoryData.totalPanelsToday} Roll/Panel (${factoryData.totalMetersToday} Meter)\n` +
    `• **Operator Aktif**: ${factoryData.activeOperatorsTodayList.length} Orang (${factoryData.activeOperatorsTodayList.slice(0, 3).map((o: string) => o.split(" ")[0]).join(", ")}${factoryData.activeOperatorsTodayList.length > 3 ? "..." : ""})\n` +
    `• **Mesin Aktif**: ${factoryData.activeMachinesToday.join(", ") || "-"}\n\n` +
    `Anda bisa menanyakan statistik mesin, kendala downtime, rincian operator, atau kirim foto cacat kain untuk dianalisa.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, userRole, userName, history = [], image } = body;

    if (!message && !image) {
      return NextResponse.json(
        { reply: "Pesan atau gambar wajib dikirim." },
        { status: 400 }
      );
    }

    const factoryContext = await fetchFactoryLiveContext();
    const apiKey = process.env.GEMINI_API_KEY;

    let aiReply = "";

    if (apiKey && apiKey.trim() !== "") {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);

        const contextString = factoryContext
          ? `
--- DATA OPERASIONAL PABRIK PT DAN LIRIS (DJI) HARI INI (${factoryContext.today}) ---
- Total Hasil Produksi Hari Ini: ${factoryContext.totalPanelsToday} Roll/Panel (${factoryContext.totalMetersToday} Meter)
- Total Temuan Cacat (Defect) Hari Ini: ${factoryContext.totalDefectsToday} temuan
- Total Durasi Downtime Hari Ini: ${factoryContext.totalDowntimeMinutesToday} Menit
- Mesin Aktif Hari Ini: ${factoryContext.activeMachinesToday.join(", ") || "Belum ada laporan"}
- Rincian per Mesin Hari Ini:
${factoryContext.machineSummaryToday.map((m: string) => `  • ${m}`).join("\n")}
- Operator yang Aktif Input Hari Ini:
${factoryContext.activeOperatorsTodayList.length > 0 ? factoryContext.activeOperatorsTodayList.map((o: string) => `  • ${o}`).join("\n") : "  • Belum ada operator yang submit laporan hari ini."}
- Master Daftar Operator per Shift (Total: ${factoryContext.totalRegisteredOperators} Orang):
  • Shift A: ${factoryContext.masterShiftA.join(", ")}
  • Shift B: ${factoryContext.masterShiftB.join(", ")}
  • Shift C: ${factoryContext.masterShiftC.join(", ")}
- Kategori Cacat Terbanyak:
${factoryContext.topDefects.map((d: string) => `  • ${d}`).join("\n")}
- Penyebab Downtime Terbanyak:
${factoryContext.topDowntime.map((dt: string) => `  • ${dt}`).join("\n")}
- Target & Rencana Produksi (Plan):
${factoryContext.plans.map((p: string) => `  • ${p}`).join("\n")}
--- AKHIR DATA OPERASIONAL ---`
          : "Data real-time pabrik sedang dalam proses sinkronisasi.";

        const systemPrompt = `Anda adalah "DJI AI", Enterprise Production & Quality Intelligence Assistant resmi dari PT Dan Liris (DJI) - Pabrik Mesin Rajut (Knitting / Tricot / Renda / Meteran & Panel).

Pengguna yang sedang berinteraksi:
- Nama: ${userName || "Supervisor"}
- Role / Wewenang: ${userRole || "Supervisor"}

Tugas Utama Anda:
1. Menyajikan analitik hasil produksi, rasio cacat, downtime teknisi/mekanik, serta performa shift secara lugas, profesional, akurat, dan ramah dalam bahasa Indonesia.
2. Menggunakan DATA OPERASIONAL PABRIK real-time yang disediakan di bawah ini untuk menjawab pertanyaan spesifik mengenai mesin, operator, target, dan temuan cacat.
3. Memberikan rekomendasi teknis praktis jika ditemukan masalah (misal: jarum patah, setelan tegangan benang, pelumasan mesin, atau downtime berlebih).
4. Gunakan format Markdown (bold, list, bullet points, ringkasan singkat) agar mudah dibaca di layar tablet maupun desktop.
5. Jika pengguna mengunggah foto cacat kain/mesin, analisa visual gambar tersebut, sebutkan kemungkinan kategori cacat (misal: lubang/jarum patah/belang/tarikan benang), dan berikan saran penanganan.

${contextString}`;

        let contents: any[] = [];
        if (image) {
          const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
          contents = [
            systemPrompt,
            ...history.map((h: any) => `${h.sender === 'user' ? 'Supervisor' : 'DJI AI'}: ${h.text}`),
            {
              inlineData: {
                data: base64Data,
                mimeType: "image/jpeg"
              }
            },
            `Supervisor: ${message || "Tolong analisa foto cacat kain / mesin ini."}`
          ];
        } else {
          contents = [
            systemPrompt,
            ...history.map((h: any) => `${h.sender === 'user' ? 'Supervisor' : 'DJI AI'}: ${h.text}`),
            `Supervisor: ${message}`
          ];
        }

        const { text, usedModel } = await generateContentWithFallback(genAI, contents);
        console.log(`[DJI AI Chat] Successfully generated response with model: ${usedModel}`);
        aiReply = text;
      } catch (geminiError: any) {
        console.error("[DJI AI Chat] Gemini API error, executing smart rule fallback:", geminiError?.message || geminiError);
      }
    }

    // Fallback if AI response empty or API key issue
    if (!aiReply) {
      aiReply = generateSmartRuleReply(message || "", factoryContext);
    }

    return NextResponse.json({ reply: aiReply });
  } catch (error: any) {
    console.error("Error in DJI chat API:", error);
    return NextResponse.json(
      { reply: `Maaf, terjadi kendala saat memproses pertanyaan: ${error.message}` },
      { status: 500 }
    );
  }
}
