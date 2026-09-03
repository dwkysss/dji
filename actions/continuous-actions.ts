"use server";

import { continuousFormSchema, ContinuousFormInput } from "@/lib/schemas";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getShiftDate } from "@/lib/shift-utils";

async function resolveAutomaticMeterStart(input: {
  nomorMc?: string | null;
  designId?: string | null;
  potonganKe?: string | null;
}) {
  if (!input.nomorMc) return 0;
  const nomorMcClean = input.nomorMc.trim();
  const potonganKeNum = input.potonganKe ? parseInt(input.potonganKe) : null;

  // Menggunakan createAdminClient agar query mengabaikan RLS & selalu mendapatkan data terbaru
  const supabase = await createAdminClient();

  // 1. Cari record berdasarkan nomor_mc & potongan_ke
  if (potonganKeNum) {
    // Cari laporan meter_akhir resmi yang > 0 untuk potongan ini
    const { data: finishData } = await supabase
      .from("production_headers")
      .select("meter_akhir")
      .ilike("nomor_mc", nomorMcClean)
      .eq("potongan_ke", potonganKeNum)
      .not("meter_akhir", "is", null)
      .gt("meter_akhir", 0)
      .order("tanggal_jam", { ascending: false })
      .limit(1);

    if (finishData && finishData.length > 0 && finishData[0].meter_akhir !== null) {
      const finish = parseFloat(finishData[0].meter_akhir as any);
      if (Number.isFinite(finish) && finish > 0) return finish;
    }

    // Cari laporan meter_awal yang > 0 untuk potongan ini jika meter_akhir belum ada
    const { data: startData } = await supabase
      .from("production_headers")
      .select("meter_awal")
      .ilike("nomor_mc", nomorMcClean)
      .eq("potongan_ke", potonganKeNum)
      .not("meter_awal", "is", null)
      .gt("meter_awal", 0)
      .order("tanggal_jam", { ascending: false })
      .limit(1);

    if (startData && startData.length > 0 && startData[0].meter_awal !== null) {
      const start = parseFloat(startData[0].meter_awal as any);
      if (Number.isFinite(start) && start > 0) return start;
    }

    // Jika potongan ini belum memiliki record meter > 0 (potongan baru), mulai dari 0
    return 0;
  }

  // 2. Fallback: Cari record paling akhir dari mesin ini secara umum
  const { data: latestGeneral } = await supabase
    .from("production_headers")
    .select("tanggal_potong")
    .ilike("nomor_mc", nomorMcClean)
    .order("tanggal_jam", { ascending: false })
    .limit(1);

  if (latestGeneral && latestGeneral.length > 0 && latestGeneral[0].tanggal_potong) {
    return 0;
  }

  const { data: latestFinishGeneral } = await supabase
    .from("production_headers")
    .select("meter_akhir")
    .ilike("nomor_mc", nomorMcClean)
    .not("meter_akhir", "is", null)
    .gt("meter_akhir", 0)
    .order("tanggal_jam", { ascending: false })
    .limit(1);

  if (latestFinishGeneral && latestFinishGeneral.length > 0 && latestFinishGeneral[0].meter_akhir !== null) {
    const finish = parseFloat(latestFinishGeneral[0].meter_akhir as any);
    if (Number.isFinite(finish) && finish > 0) return finish;
  }

  return 0;
}

export async function getLastMeterStartByBatch(input: {
  nomorMc?: string | null;
  designId?: string | null;
  potonganKe?: string | null;
}) {
  try {
    const meterStart = await resolveAutomaticMeterStart(input);
    return { success: true, meterStart };
  } catch (error: any) {
    console.error("Error getLastMeterStartByBatch:", error);
    return {
      success: false,
      meterStart: 0,
      error: error.message || "Gagal mengambil meter start",
    };
  }
}

export async function getOriginalT2ATarget(input: {
  nomorMc?: string | null;
  potonganKe?: string | null;
}) {
  try {
    const potonganKeNum = input.potonganKe ? parseInt(input.potonganKe) : null;
    if (!input.nomorMc || !potonganKeNum) return { success: true, originalTarget: null };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("production_headers")
      .select("meter_awal")
      .eq("nomor_mc", input.nomorMc)
      .eq("potongan_ke", potonganKeNum)
      .not("meter_awal", "is", null)
      .order("tanggal_jam", { ascending: true })
      .limit(1);

    if (error) throw new Error(error.message);
    const firstRecord = data?.[0] as any;
    if (!firstRecord) return { success: true, originalTarget: null };

    const target = parseFloat(firstRecord.meter_awal);
    return { success: true, originalTarget: Number.isFinite(target) ? target : null };
  } catch (error: any) {
    console.error("Error getOriginalT2ATarget:", error);
    return { success: false, originalTarget: null };
  }
}

function generateExcelStyleId(): string {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function parseOptionalMeter(value: string | null | undefined): number | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const num = parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

function expandBlockNumbers(blokInput?: string | null): string[] {
  if (!blokInput || typeof blokInput !== "string") return [];
  const parts = blokInput.split(",").map(p => p.trim()).filter(Boolean);
  const blocks: string[] = [];

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && start <= end && end - start <= 100) {
        for (let b = start; b <= end; b++) {
          blocks.push(String(b));
        }
        continue;
      }
    }
    const numMatch = part.match(/\d+/);
    if (numMatch) {
      blocks.push(numMatch[0]);
    } else if (part) {
      blocks.push(part);
    }
  }

  return Array.from(new Set(blocks));
}

async function applyT2ACutDateUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    nomorMc: string;
    potonganKeNum: number;
    tanggalPotong: string;
    /** Header yang baru di-insert; baris ini sudah punya tanggal potong di sheet POST */
    excludeHeaderId?: string;
  },
) {
  const { data: allHeaders, error: headersError } = await supabase
    .from("production_headers")
    .select("*, production_details(*)")
    .eq("nomor_mc", input.nomorMc)
    .eq("potongan_ke", input.potonganKeNum);

  if (headersError) {
    throw new Error(
      "Gagal mencari data meteran untuk potong kain: " + headersError.message,
    );
  }

  if (!allHeaders || allHeaders.length === 0) {
    return {
      success: false as const,
      error: `Belum ada data meteran untuk Mesin ${input.nomorMc} Potongan ${input.potonganKeNum}. Potong kain hanya bisa update data yang sudah ada.`,
    };
  }

  const previousHeaders = input.excludeHeaderId
    ? allHeaders.filter((h) => h.id !== input.excludeHeaderId)
    : allHeaders;

  if (!input.excludeHeaderId && previousHeaders.length === 0) {
    return {
      success: false as const,
      error: `Belum ada data meteran untuk Mesin ${input.nomorMc} Potongan ${input.potonganKeNum}. Potong kain hanya bisa update data yang sudah ada.`,
    };
  }

  const { error: cutUpdateError } = await supabase
    .from("production_headers")
    .update({ tanggal_potong: input.tanggalPotong })
    .eq("nomor_mc", input.nomorMc)
    .eq("potongan_ke", input.potonganKeNum);

  if (cutUpdateError) {
    throw new Error("Gagal menyimpan tanggal potong: " + cutUpdateError.message);
  }

  const sheetUrl = process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
  if (sheetUrl && previousHeaders.length > 0) {
    type CutSheetHeader = {
      id?: string | null;
      production_details?: { pcs_index?: string | number | null }[];
    };
    const massPayload: {
      id_header: string;
      pcs_index: string | number;
      tanggal_potong: string;
    }[] = [];

    for (const h of previousHeaders as CutSheetHeader[]) {
      const details = h.production_details || [];
      for (const detail of details) {
        massPayload.push({
          id_header: h.id || "",
          pcs_index: detail.pcs_index || "",
          tanggal_potong: input.tanggalPotong,
        });
      }
    }

    if (massPayload.length > 0) {
      fetch(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", data: massPayload }),
      }).catch((err) =>
        console.error("Gagal sinkron tanggal potong Google Sheets:", err),
      );
    }
  }

  return { success: true as const };
}

export async function submitContinuousReport(inputData: ContinuousFormInput) {
  try {
    const validated = continuousFormSchema.parse(inputData);

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tanggalJam = formatter.format(now);
    const tgl = getShiftDate(now);

    const rpmNum = validated.rpm ? parseInt(validated.rpm) : null;
    const potonganKeNum = validated.potonganKe
      ? parseInt(validated.potonganKe)
      : null;
    const finishMeterNum = parseOptionalMeter(validated.meterAkhir);
    const startMeterInput = parseOptionalMeter(validated.meterAwal);
    const autoMeterStart =
      validated.nomorMc === "T2A"
        ? startMeterInput
        : (finishMeterNum !== null
            ? await resolveAutomaticMeterStart({
                nomorMc: validated.nomorMc,
                designId: validated.designId,
                potonganKe: validated.potonganKe,
              })
            : null);

    const effectiveMeterStart = startMeterInput !== null ? startMeterInput : autoMeterStart;

    const totalProduksiMeter =
      finishMeterNum !== null && effectiveMeterStart !== null
        ? (validated.nomorMc === "T2A" ? effectiveMeterStart - finishMeterNum : finishMeterNum - effectiveMeterStart)
        : null;

    if (finishMeterNum !== null && effectiveMeterStart !== null) {
      if (validated.nomorMc === "T2A") {
        if (finishMeterNum > effectiveMeterStart) {
          throw new Error(`Finish Meter (${finishMeterNum}m) tidak boleh lebih besar dari Target (${effectiveMeterStart}m).`);
        }
      } else {
        if (finishMeterNum <= effectiveMeterStart) {
          throw new Error(`Finish Meter (${finishMeterNum}m) harus lebih besar dari Start Meter (${effectiveMeterStart}m).`);
        }
      }
    }

    const headerId = generateExcelStyleId();

    // Hitung total downtime dari array downtimeEvents (jika ada), atau fallback ke input manual lama
    let totalDowntimeMenit = 0;
    if (validated.downtimeEvents && validated.downtimeEvents.length > 0) {
      totalDowntimeMenit = validated.downtimeEvents.reduce((acc, curr) => acc + curr.durasiDetik, 0);
    } else if (validated.totalDowntime && parseInt(validated.totalDowntime) > 0) {
      totalDowntimeMenit = parseInt(validated.totalDowntime);
    }

    const headerData = {
      id: headerId,
      tgl,
      tanggal_jam: tanggalJam,
      operator_id: validated.operatorId && !isNaN(parseInt(validated.operatorId)) ? parseInt(validated.operatorId) : null,
      group_id: parseInt(validated.groupId),
      design_id: validated.designId,
      nomor_mc: validated.nomorMc || null,
      status_matching: validated.statusMatching,
      course: validated.course || null,
      rpm: rpmNum,
      potongan_ke: potonganKeNum,
      panel_no: "METERAN", // Keep panel_no since it's back
      pcs: validated.pcsData.length,
      tanggal_potong: validated.tanggalPotong || null,
      pick: validated.pick || null,
      no_order_barang: validated.noOrderBarang || null,
      no_customer: validated.noCustomer || null,
      jenis_benang_dasar: validated.jenisBenangDasar || null,
      liner: validated.liner || null,
      heavy: validated.heavy || null,
      shadow: validated.shadow || null,
      pinggiran: validated.pinggiran || null,
      foto_before: validated.fotoBefore || null,
      foto_after: validated.fotoAfter || null,
      total_downtime_detik: totalDowntimeMenit,
      meter_awal: autoMeterStart,
      meter_akhir: finishMeterNum,
      total_produksi_meter: totalProduksiMeter,
      idempotency_key: validated.idempotencyKey || null,
      created_by_name: validated.created_by_name || null,
      pic: validated.pic || null,
      downtime_events: validated.downtimeEvents && validated.downtimeEvents.length > 0 ? JSON.stringify(validated.downtimeEvents) : null,
      operator_backup: validated.backupOperator || null,
    };

    const pcsDataToProcess = validated.isPanelGagal 
      ? validated.pcsData.filter(pcs => pcs.isBs) 
      : validated.pcsData;

    const downtimeRecordsData: any[] = [];
    if (validated.downtimeEvents && validated.downtimeEvents.length > 0) {
      validated.downtimeEvents.forEach((dt: any) => {
        if (dt.isSubmitted) return; // Abaikan karena sudah dikirim langsung via auto-submit mekanik
        
        if (dt.problems && Array.isArray(dt.problems)) {
          dt.problems.forEach((p: any) => {
            downtimeRecordsData.push({
              header_id: headerId,
              kategori: p.kategori || dt.kategori,
              detail: p.details ? (Array.isArray(p.details) ? p.details.join(", ") : p.details) : dt.detail,
              durasi_detik: dt.durasiDetik || 0,
              blok: p.blok || dt.blok || null,
              dikerjakan_oleh: dt.dikerjakanOleh || null
            });
          });
        } else if (dt.kategori) {
          downtimeRecordsData.push({
            header_id: headerId,
            kategori: dt.kategori,
            detail: dt.detail,
            durasi_detik: dt.durasiDetik || 0,
            blok: dt.blok || null,
            dikerjakan_oleh: dt.dikerjakanOleh || null
          });
        }
      });
    }

    const productionDefectsData: any[] = [];

    // Cari index PCS yang akan menampung jml_hasil_produksi (jika ada masalah, pilih PCS tersebut, jika tidak pilih PCS pertama)
    let targetYieldIdx = 0;
    const idxWithProblem = pcsDataToProcess.findIndex((pcsItem, idx) => {
      const pcsKey = pcsItem.pcsIndex ? pcsItem.pcsIndex.toString() : (idx + 1).toString();
      const matchedEvents = validated.downtimeEvents 
        ? validated.downtimeEvents.filter(e => (!e.dikerjakanOleh || !e.dikerjakanOleh.startsWith("Mekanik")) && (!e.pcsKe || e.pcsKe === "Semua" || e.pcsKe.split(",").map(x => x.trim()).includes(pcsKey)))
        : [];
      return matchedEvents.length > 0 || pcsDataToProcess[idx].isBs;
    });

    if (idxWithProblem !== -1) {
      targetYieldIdx = idxWithProblem;
    }

    const detailData = pcsDataToProcess.map((pcsItem, idx) => {
      const detailId = generateExcelStyleId() + "-" + idx;
      
      // Filter event khusus untuk PCS ini berdasarkan pcsIndex aktual (bukan posisi array), DAN abaikan downtime Mekanik agar tidak masuk ke cacat Panel
      const actualPcsKey = pcsItem.pcsIndex ? pcsItem.pcsIndex.toString() : (idx + 1).toString();
      const matchedEvents = validated.downtimeEvents 
        ? validated.downtimeEvents.filter(e => (!e.dikerjakanOleh || !e.dikerjakanOleh.startsWith("Mekanik")) && (!e.pcsKe || e.pcsKe === "Semua" || e.pcsKe.split(",").map(x => x.trim()).includes(actualPcsKey)))
        : [];

      let kategoriStr = null;
      let detailStr = null;
      let blokStr = null;
      let indikatorStop = false;

      if (matchedEvents.length > 0) {
        const allCats = new Set<string>();
        const allDetails = new Set<string>();
        const allBloks = new Set<string>();
        
        matchedEvents.forEach((e: any) => {
          if (e.problems && Array.isArray(e.problems)) {
            e.problems.forEach((p: any) => {
              if (p.kategori) allCats.add(p.kategori);
              if (p.blok) allBloks.add(`Blok ${p.blok}`);
              
              let meterForThisPcs = "";
              if (p.meter) {
                if (pcsDataToProcess.length === 1) {
                  meterForThisPcs = p.meter;
                } else {
                  const match = p.meter.match(new RegExp(`PCS ${actualPcsKey}:\\s*([^,]+)`));
                  if (match) meterForThisPcs = match[1].trim();
                }
              }

              if (p.details && Array.isArray(p.details)) {
                p.details.forEach((d: string) => {
                  let detailText = d;
                  if (meterForThisPcs) {
                    detailText += ` (Titik: ${meterForThisPcs}m)`;
                  }
                  allDetails.add(detailText);
                  
                  const expanded = expandBlockNumbers(p.blok);
                  if (expanded.length > 0) {
                    expanded.forEach(b => {
                      productionDefectsData.push({
                        production_detail_id: detailId,
                        kategori: p.kategori,
                        detail: d,
                        meter: meterForThisPcs || null,
                        blok: b
                      });
                    });
                  } else {
                    productionDefectsData.push({
                      production_detail_id: detailId,
                      kategori: p.kategori,
                      detail: d,
                      meter: meterForThisPcs || null,
                      blok: p.blok || null
                    });
                  }
                });
              } else if (p.kategori) {
                const expanded = expandBlockNumbers(p.blok);
                if (expanded.length > 0) {
                  expanded.forEach(b => {
                    productionDefectsData.push({
                      production_detail_id: detailId,
                      kategori: p.kategori,
                      detail: null,
                      meter: meterForThisPcs || null,
                      blok: b
                    });
                  });
                } else {
                  productionDefectsData.push({
                    production_detail_id: detailId,
                    kategori: p.kategori,
                    detail: null,
                    meter: meterForThisPcs || null,
                    blok: p.blok || null
                  });
                }
              }
            });
          } else if (e.kategori) {
            allCats.add(e.kategori);
            if (e.detail) allDetails.add(e.detail);
            if (e.blok) allBloks.add(`Blok ${e.blok}`);
            
            const expanded = expandBlockNumbers(e.blok);
            if (expanded.length > 0) {
              expanded.forEach(b => {
                productionDefectsData.push({
                  production_detail_id: detailId,
                  kategori: e.kategori,
                  detail: e.detail || null,
                  meter: null,
                  blok: b
                });
              });
            } else {
              productionDefectsData.push({
                production_detail_id: detailId,
                kategori: e.kategori,
                detail: e.detail || null,
                meter: null,
                blok: e.blok || null
              });
            }
          }
        });
        
        kategoriStr = Array.from(allCats).join(", ");
        detailStr = Array.from(allDetails).join(", ");
        blokStr = Array.from(allBloks).join(", ");
        indikatorStop = true;
      }

      if (pcsItem.isBs) {
        kategoriStr = "X";
      }

      let keteranganStr: string | null = blokStr || null;
      const hasSpecificEvents = validated.downtimeEvents && validated.downtimeEvents.length > 0;
      if (!hasSpecificEvents || matchedEvents.length > 0) {
        if (validated.jenisLaporan === "Mulai Istirahat") {
          keteranganStr = keteranganStr ? keteranganStr + " [SEBELUM ISTIRAHAT]" : "[SEBELUM ISTIRAHAT]";
        }
        if (validated.jenisLaporan === "Selesai Istirahat") {
          keteranganStr = keteranganStr ? keteranganStr + " [LAPORAN ISTIRAHAT]" : "[LAPORAN ISTIRAHAT]";
        }
      }

      let meterKainVal = pcsItem.meterKain || null;
      if (!meterKainVal && !hasSpecificEvents && (validated.jenisLaporan === "Mulai Istirahat" || validated.jenisLaporan === "Selesai Istirahat")) {
        meterKainVal = pcsDataToProcess[0]?.meterKain || (finishMeterNum !== null ? String(finishMeterNum) : null);
      }

      return {
        id: detailId,
        header_id: headerId,
        pcs_index: parseInt(pcsItem.pcsIndex),
        jml_hasil_produksi: (idx === targetYieldIdx) ? 1 : 0,
        indikator_stop: indikatorStop,
        kategori_masalah: kategoriStr,
        detail_masalah: detailStr,
        spesifik_masalah: null,
        keterangan_cacat: keteranganStr,
        meter_kain: meterKainVal,
        roll_no: pcsItem.rollNo || null,
      };
    });

    // Filter out completely empty rows (no yield and no problems) to prevent cluttering the database and QC table
    const finalDetailData = detailData.filter(d => {
      if (d.jml_hasil_produksi > 0) return true;
      if (d.kategori_masalah || d.detail_masalah || d.indikator_stop) return true;
      if (d.keterangan_cacat && (d.keterangan_cacat.includes("ISTIRAHAT"))) return true;
      if (validated.meterAkhir) return true;
      return false;
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      supabaseUrl &&
      supabaseAnonKey &&
      supabaseAnonKey !== "your_supabase_anon_key_here"
    ) {
      const supabase = await createClient();

      // Ambil nama penanggung jawab berdasarkan akun login
      try {
        if (validated.created_by_name) {
          headerData.created_by_name = validated.created_by_name;
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const adminSupabase = await createAdminClient();
            const { data: profile } = await adminSupabase
              .from("user_profiles")
              .select("full_name")
              .eq("id", user.id)
              .single();
            if (profile) {
              headerData.created_by_name = profile.full_name;
            }
          }
        }
      } catch (err) {
        console.error("Gagal mendapatkan PIC nama:", err);
      }

      // Check if this is a pure finish/meter update for an existing session to avoid inserting redundant duplicate headers
      let targetHeaderId = headerId;
      const isPureFinishReport = finishMeterNum !== null && finalDetailData.length === 0 && (!validated.downtimeEvents || validated.downtimeEvents.length === 0);

      if (isPureFinishReport && headerData.nomor_mc && headerData.potongan_ke) {
        const { data: existingFinish } = await supabase
          .from("production_headers")
          .select("id, meter_akhir")
          .eq("nomor_mc", headerData.nomor_mc)
          .eq("potongan_ke", headerData.potongan_ke)
          .eq("tgl", headerData.tgl)
          .order("tanggal_jam", { ascending: false })
          .limit(1);

        if (existingFinish && existingFinish.length > 0 && existingFinish[0].id) {
          targetHeaderId = existingFinish[0].id;
          await supabase
            .from("production_headers")
            .update({
              meter_akhir: headerData.meter_akhir,
              total_produksi_meter: headerData.total_produksi_meter,
              tanggal_potong: headerData.tanggal_potong || undefined,
              total_downtime_detik: headerData.total_downtime_detik,
            })
            .eq("id", targetHeaderId);
        } else {
          const { error: insertHeaderError } = await supabase
            .from("production_headers")
            .insert(headerData);

          if (insertHeaderError) {
            if (insertHeaderError.code === "23505") {
              console.warn("Idempotency key duplicate detected. Returning success.");
              return { success: true };
            }
            throw new Error("Failed to insert continuous header: " + insertHeaderError.message);
          }
        }
      } else {
        const { error: insertHeaderError } = await supabase
          .from("production_headers")
          .insert(headerData);

        if (insertHeaderError) {
          if (insertHeaderError.code === "23505") {
            console.warn("Idempotency key duplicate detected. Returning success.");
            return { success: true };
          }
          throw new Error("Failed to insert continuous header: " + insertHeaderError.message);
        }
      }
      if (finalDetailData.length > 0) {
        const { error: detailError } = await supabase
          .from("production_details")
          .insert(finalDetailData as any);

        if (detailError)
          throw new Error(`Gagal menyimpan detail: ${detailError.message}`);
      }

      // Filter defects that belong to finalDetailData only (in case empty details were stripped)
      const validDetailIds = new Set(finalDetailData.map(d => d.id));
      const filteredDefects = productionDefectsData.filter(d => validDetailIds.has(d.production_detail_id));

      if (filteredDefects.length > 0) {
        const { error: defectError } = await supabase
          .from("production_defects")
          .insert(filteredDefects);
        if (defectError) {
          console.error("Gagal menyimpan continuous production_defects:", defectError);
        }
      }

      if (downtimeRecordsData.length > 0) {
        const { error: downtimeError } = await supabase
          .from("downtime_records")
          .insert(downtimeRecordsData);
        if (downtimeError) {
          console.error("Gagal menyimpan continuous downtime_records:", downtimeError);
        }
      }

      // Update tanggal potong massal untuk semua laporan potongan yang sama
      if (validated.tanggalPotong && validated.nomorMc && potonganKeNum) {
        const cutResult = await applyT2ACutDateUpdate(supabase, {
          nomorMc: validated.nomorMc,
          potonganKeNum,
          tanggalPotong: validated.tanggalPotong,
          excludeHeaderId: headerId,
        });

        if (!cutResult.success) {
          return cutResult;
        }
      }

      // C. Google Sheets sync is now handled exclusively by the background auto-sync cron job
      // to ensure lightning fast UX and prevent duplicate data race conditions.

      revalidatePath("/(employee)/history");
      return { success: true, productionId: headerId };
    }

    // Fallback/Mock Mode Trigger Google Sheets
    const sheetUrlMock = process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
    if (sheetUrlMock) {
      const payloadMock = finalDetailData.map((detail: any) => ({
        "ID Laporan": headerId,
        "Tanggal Produksi": tgl || "",
        "Tanggal & Jam": tanggalJam,
        "Tanggal Potong": validated.tanggalPotong || "",
        Mesin: validated.nomorMc || "",
        Pick: validated.pick || "",
        Course: validated.course || "",
        RPM: validated.rpm ?? "",
        Operator: validated.pic || validated.operatorId || "",
        Grup: validated.grupName || validated.groupId || "",
        Design: validated.designName || validated.designId || "",
        Panel: "METERAN",
        "Potongan Ke": validated.potonganKe ?? "",
        "No Order": validated.noOrderBarang || "",
        "No Customer": validated.noCustomer || "",
        "Total Downtime (Detik)": totalDowntimeMenit ?? 0,
        "Meter Awal": autoMeterStart ?? "",
        "Meter Akhir": finishMeterNum ?? "",
        "Total Produksi Meter": totalProduksiMeter ?? "",
        "PCS Ke": detail.pcs_index || "",
        "Hasil PCS": detail.jml_hasil_produksi ?? 0,
        "Meter Kain": detail.meter_kain ?? "",
        "Roll No": detail.roll_no || "",
        "Mesin Stop?": detail.indikator_stop ? "Ya" : "Tidak",
        "Kategori Masalah": detail.kategori_masalah || "",
        "Keterangan Cacat": detail.keterangan_cacat || "",
      }));

      fetch(sheetUrlMock, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadMock),
      }).catch((err) => console.error("Gagal sinkron Google Sheets:", err));
    }

    revalidatePath("/(employee)/history");
    return { success: true, productionId: headerId };
  } catch (error: any) {
    console.error("Error submitContinuousReport:", error);
    return { success: false, error: error.message || "Gagal menyimpan data" };
  }
}
export async function updateContinuousReport(
  headerId: string,
  data: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      "UPDATE CONTINUOUS REPORT DATA:",
      JSON.stringify(data, null, 2),
    );
    const supabase = await createClient();

    // Parse values
    const rpmNum = data.rpm ? parseInt(data.rpm) : null;
    const potonganKeNum = data.potonganKe ? parseInt(data.potonganKe) : null;
    // Hitung total downtime dari array downtimeEvents (jika ada), atau fallback ke input manual lama
    let totalDowntimeNum = 0;
    if (data.downtimeEvents && data.downtimeEvents.length > 0) {
      totalDowntimeNum = data.downtimeEvents.reduce((acc: number, curr: any) => acc + curr.durasiDetik, 0);
    } else if (data.totalDowntime && parseInt(data.totalDowntime) > 0) {
      totalDowntimeNum = parseInt(data.totalDowntime);
    }

    // 1. Update Header
    const { error: headerError } = await supabase
      .from("production_headers")
      .update({
        operator_id:
          data.operatorId && !isNaN(parseInt(data.operatorId))
            ? parseInt(data.operatorId)
            : null,
        group_id: data.groupId,
        design_id: data.designId,
        nomor_mc: data.nomorMc || null,
        course: data.course || null,
        rpm: rpmNum,
        potongan_ke: potonganKeNum,
        panel_no: "METERAN",
        pcs: data.pcsData?.length || 0,
        tanggal_potong: data.tanggalPotong || null,
        pick: data.pick || null,
        pic: data.pic || null,
        created_by_name: data.created_by_name || null,
        no_order_barang: data.noOrderBarang || null,
        no_customer: data.noCustomer || null,
        jenis_benang_dasar: data.jenisBenangDasar || null,
        liner: data.liner || null,
        heavy: data.heavy || null,
        shadow: data.shadow || null,
        pinggiran: data.pinggiran || null,
        total_downtime_detik: totalDowntimeNum,
        downtime_events: data.downtimeEvents && data.downtimeEvents.length > 0 ? JSON.stringify(data.downtimeEvents) : null,
        meter_awal: data.meterAwal ? parseFloat(data.meterAwal) : null,
        meter_akhir: data.meterAkhir ? parseFloat(data.meterAkhir) : null,
        total_produksi_meter: data.hasilProduksiMeter
          ? parseFloat(data.hasilProduksiMeter)
          : null,
      })
      .eq("id", headerId);

    if (headerError) throw new Error(headerError.message);

    // 2. Fetch old details to preserve downstream data
    const { data: oldDetails } = await supabase
      .from("production_details")
      .select("*")
      .eq("header_id", headerId);

    if (oldDetails && oldDetails.length > 0) {
      const oldDetailIds = oldDetails.map((d: any) => d.id);
      await supabase
        .from("production_defects")
        .delete()
        .in("production_detail_id", oldDetailIds);
    }

    // Delete old downtime records
    await supabase.from("downtime_records").delete().eq("header_id", headerId);

    const downtimeRecordsData: any[] = [];
    if (data.downtimeEvents && data.downtimeEvents.length > 0) {
      data.downtimeEvents.forEach((dt: any) => {
        if (dt.problems && Array.isArray(dt.problems)) {
          dt.problems.forEach((p: any) => {
            downtimeRecordsData.push({
              header_id: headerId,
              kategori: p.kategori || dt.kategori,
              detail: p.details ? (Array.isArray(p.details) ? p.details.join(", ") : p.details) : dt.detail,
              durasi_detik: dt.durasiDetik || 0,
              blok: p.blok || dt.blok || null
            });
          });
        } else if (dt.kategori) {
          downtimeRecordsData.push({
            header_id: headerId,
            kategori: dt.kategori,
            detail: dt.detail,
            durasi_detik: dt.durasiDetik || 0,
            blok: dt.blok || null
          });
        }
      });
    }

    const productionDefectsData: any[] = [];
    
    // 3. Prepare details
    if (data.pcsData && data.pcsData.length > 0) {
      const detailData = data.pcsData.map((pcsItem: any, idx: number) => {
        const detailId = generateExcelStyleId() + "-" + idx;
        const jmlHasilNum = pcsItem.jmlHasilProduksi
          ? parseInt(pcsItem.jmlHasilProduksi)
          : null;
        const pcsIndexNum = pcsItem.pcsIndex
          ? parseInt(pcsItem.pcsIndex)
          : null;

        const oldDetail = oldDetails?.find((d: any) => d.pcs_index === pcsIndexNum) || {};

        // Filter event khusus untuk PCS ini berdasarkan pcsIndex aktual (bukan posisi array)
        const actualPcsKey = pcsItem.pcsIndex ? pcsItem.pcsIndex.toString() : (idx + 1).toString();
        const matchedEvents = data.downtimeEvents 
          ? data.downtimeEvents.filter((e: any) => !e.pcsKe || e.pcsKe === "Semua" || e.pcsKe.split(",").map((x: string) => x.trim()).includes(actualPcsKey))
          : [];

        let kategoriStr = null;
        let detailStr = null;
        let blokStr = null;
        let indikatorStop = false;

        if (matchedEvents.length > 0) {
          const allCats = new Set<string>();
          const allDetails = new Set<string>();
          const allBloks = new Set<string>();
          
          matchedEvents.forEach((e: any) => {
            if (e.problems && Array.isArray(e.problems)) {
              e.problems.forEach((p: any) => {
                if (p.kategori) allCats.add(p.kategori);
                if (p.blok) allBloks.add(`Blok ${p.blok}`);
                
                let meterForThisPcs = "";
                if (p.meter) {
                  if (data.pcsData.length === 1) {
                    meterForThisPcs = p.meter;
                  } else {
                    const match = p.meter.match(new RegExp(`PCS ${actualPcsKey}:\\s*([^,]+)`));
                    if (match) meterForThisPcs = match[1].trim();
                  }
                }

                if (p.details && Array.isArray(p.details)) {
                  p.details.forEach((d: string) => {
                    let detailText = d;
                    if (meterForThisPcs) {
                      detailText += ` (Titik: ${meterForThisPcs}m)`;
                    }
                    allDetails.add(detailText);
                    
                    productionDefectsData.push({
                      production_detail_id: oldDetail.id || detailId,
                      kategori: p.kategori,
                      detail: d,
                      meter: meterForThisPcs || null,
                      blok: p.blok || null
                    });
                  });
                } else if (p.kategori) {
                  productionDefectsData.push({
                    production_detail_id: oldDetail.id || detailId,
                    kategori: p.kategori,
                    detail: null,
                    meter: meterForThisPcs || null,
                    blok: p.blok || null
                  });
                }
              });
            } else if (e.kategori) {
              allCats.add(e.kategori);
              if (e.detail) allDetails.add(e.detail);
              if (e.blok) allBloks.add(`Blok ${e.blok}`);
              
              productionDefectsData.push({
                production_detail_id: oldDetail.id || detailId,
                kategori: e.kategori,
                detail: e.detail || null,
                meter: e.meter || null,
                blok: e.blok || null
              });
            }
          });
          
          kategoriStr = Array.from(allCats).join(", ");
          detailStr = Array.from(allDetails).join(", ");
          blokStr = Array.from(allBloks).join(", ");
          indikatorStop = true;
        }

        if (pcsItem.isBs) {
          kategoriStr = "X";
        }

        let keteranganStr: string | null = null;
        if (blokStr) {
          keteranganStr = blokStr;
        }
        if (data.jenisLaporan === "Mulai Istirahat") {
          keteranganStr = keteranganStr ? keteranganStr + " [SEBELUM ISTIRAHAT]" : "[SEBELUM ISTIRAHAT]";
        }
        if (data.jenisLaporan === "Selesai Istirahat") {
          keteranganStr = keteranganStr ? keteranganStr + " [LAPORAN ISTIRAHAT]" : "[LAPORAN ISTIRAHAT]";
        }

        if (oldDetail.keterangan_cacat && oldDetail.keterangan_cacat.includes("[TAMBAHAN QC]")) {
          keteranganStr = keteranganStr ? keteranganStr + " [TAMBAHAN QC]" : "[TAMBAHAN QC]";
        }

        return {
          ...oldDetail,
          id: oldDetail.id || detailId,
          header_id: headerId,
          pcs_index: pcsIndexNum,
          jml_hasil_produksi: jmlHasilNum,
          indikator_stop: indikatorStop,
          kategori_masalah: kategoriStr,
          detail_masalah: detailStr,
          keterangan_cacat: keteranganStr || null,
          meter_kain: pcsItem.meterKain || ((data.jenisLaporan === "Mulai Istirahat" || data.jenisLaporan === "Selesai Istirahat") ? data.meterAkhir : null) || null,
          roll_no: pcsItem.rollNo || oldDetail.roll_no || null,
        };
      });

      // Delete details for any removed PCS indices
      const newPcsIndices = (data.pcsData || []).map((p: any) => p.pcsIndex ? parseInt(p.pcsIndex) : null).filter(Boolean);
      const removedDetails = (oldDetails || []).filter((d: any) => !newPcsIndices.includes(d.pcs_index));
      const removedDetailIds = removedDetails.map((d: any) => d.id);

      if (removedDetailIds.length > 0) {
        await supabase.from("mending_items").delete().in("production_detail_id", removedDetailIds);
        await supabase.from("qc_inspection_items").delete().in("production_detail_id", removedDetailIds);
        await supabase.from("production_defects").delete().in("production_detail_id", removedDetailIds);
        await supabase.from("production_details").delete().in("id", removedDetailIds);
      }

      // Upsert details so existing IDs & FK constraints remain valid
      const { error: upsertError } = await supabase
        .from("production_details")
        .upsert(detailData, { onConflict: "id" });

      if (upsertError) throw new Error(upsertError.message);

      if (productionDefectsData.length > 0) {
        const { error: defectError } = await supabase
          .from("production_defects")
          .insert(productionDefectsData);
        
        if (defectError) {
          console.error("Gagal menyimpan production_defects pada update:", defectError);
        }
      }

      if (downtimeRecordsData.length > 0) {
        const { error: downtimeError } = await supabase
          .from("downtime_records")
          .insert(downtimeRecordsData);
        if (downtimeError) {
          console.error("Gagal menyimpan downtime_records pada update:", downtimeError);
        }
      }

      const sheetUrl = process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
      if (sheetUrl) {
        const payload = detailData.map((detail: any) => ({
          "ID Laporan": headerId,
          "Tanggal Produksi":
            data.tgl ||
            new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Asia/Jakarta",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })
              .format(new Date())
              .split(" ")[0],
          "Tanggal & Jam":
            data.tanggalJam ||
            new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Asia/Jakarta",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).format(new Date()),
          "Tanggal Potong": data.tanggalPotong || "",
          Mesin: data.nomorMc || "",
          Pick: data.pick || "",
          Course: data.course || "",
          RPM: data.rpm ?? "",
          Operator: data.pic || data.operatorId || "",
          Grup: data.groupId || "",
          Design: data.designId || "",
          "Status Matching": data.statusMatching || "",
          Panel: data.panelNo || "",
          "Potongan Ke": data.potonganKe ?? "",
          "No Order": data.noOrderBarang || "",
          "No Customer": data.noCustomer || "",
          "Total Downtime (Detik)": data.totalDowntime ?? 0,
          "Meter Awal": data.meterAwal ?? "",
          "Meter Akhir": data.meterAkhir ?? "",
          "Total Produksi Meter": data.hasilProduksiMeter ?? "",
          "PCS Ke": detail.pcs_index || "",
          "Hasil PCS": detail.jml_hasil_produksi ?? 0,
          "Meter Kain": detail.meter_kain ?? "",
          "Roll No": detail.roll_no || "",
          "Mesin Stop?": detail.indikator_stop ? "Ya" : "Tidak",
          "Kategori Masalah": detail.kategori_masalah || "",
          "Keterangan Cacat": detail.keterangan_cacat || "",
        }));

        fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id_header: headerId,
            data: payload,
          }),
        })
          .then(async (res) => {
            if (res.ok) {
              const client = await createClient();
              await client
                .from("production_headers")
                .update({ is_synced_to_sheet: true })
                .eq("id", headerId);
            }
          })
          .catch((err) => console.error("Gagal sinkron Google Sheets:", err));
      }
    }

    revalidatePath("/(employee)/history");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating continuous report:", err);
    return {
      success: false,
      error: err.message || "Gagal memperbarui data laporan.",
    };
  }
}

export async function getRecentShiftInputHistory(
  nomorMc?: string,
  limitCount: number = 25,
  panelType?: "METERAN" | "PANEL" | "ALL",
  potonganKe?: string | number
): Promise<{
  success: boolean;
  data: any[];
  error?: string;
}> {
  try {
    const supabase = await createAdminClient();
    let query = supabase
      .from("production_headers")
      .select(`
        id,
        tgl,
        tanggal_jam,
        nomor_mc,
        group_id,
        design_id,
        course,
        rpm,
        panel_no,
        potongan_ke,
        pcs,
        tanggal_potong,
        meter_awal,
        meter_akhir,
        total_produksi_meter,
        total_downtime_detik,
        created_by_name,
        pic,
        operator_backup,
        operators (id, nama_operator),
        groups (id, nama_grup),
        downtime_events,
        production_details (
          *,
          production_defects (*)
        )
      `)
      .order("tanggal_jam", { ascending: false })
      .limit(limitCount);

    if (panelType === "METERAN") {
      query = query.eq("panel_no", "METERAN");
    } else if (panelType === "PANEL") {
      query = query.neq("panel_no", "METERAN");
    }

    if (potonganKe && !isNaN(parseInt(potonganKe.toString()))) {
      query = query.eq("potongan_ke", parseInt(potonganKe.toString()));
    }

    if (nomorMc && nomorMc.trim() !== "") {
      const cleanMc = nomorMc.trim();
      const numOnly = cleanMc.replace(/[^0-9]/g, "");
      if (numOnly) {
        query = query.or(`nomor_mc.ilike.*${cleanMc}*,nomor_mc.eq.${numOnly},nomor_mc.eq.R${numOnly},nomor_mc.eq.R0${numOnly}`);
      } else {
        query = query.ilike("nomor_mc", `%${cleanMc}%`);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching shift input history:", error);
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("Failed to get shift input history:", err);
    return { success: false, data: [], error: err.message };
  }
}

export async function updateInstantPanelDefectStatus(params: {
  headerId: string;
  detailId?: string | null;
  pcsIndex: number;
  targetStatus: "NORMAL" | "DEFECT";
  defectData?: {
    kategori: string;
    detail: string;
    blok?: string | null;
  };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient();
    const { headerId, detailId, pcsIndex, targetStatus, defectData } = params;

    if (!headerId) {
      return { success: false, error: "Header ID tidak ditemukan" };
    }

    if (targetStatus === "DEFECT") {
      if (!defectData || !defectData.kategori) {
        return { success: false, error: "Data kategori cacat wajib diisi" };
      }

      let targetDetailId = detailId;

      // Cek apakah production_detail sudah ada
      if (!targetDetailId) {
        const { data: existingDetails } = await supabase
          .from("production_details")
          .select("id")
          .eq("header_id", headerId)
          .eq("pcs_index", pcsIndex)
          .limit(1);

        if (existingDetails && existingDetails.length > 0) {
          targetDetailId = existingDetails[0].id;
        }
      }

      const kategoriVal = defectData.kategori.trim();
      const detailVal = defectData.detail.trim();
      const blokVal = defectData.blok ? defectData.blok.trim() : null;
      const keteranganVal = blokVal ? `Blok ${blokVal}` : (detailVal || null);

      if (targetDetailId) {
        const { error: updateError } = await supabase
          .from("production_details")
          .update({
            indikator_stop: true,
            kategori_masalah: kategoriVal,
            detail_masalah: detailVal,
            keterangan_cacat: keteranganVal,
          })
          .eq("id", targetDetailId);

        if (updateError) throw updateError;

        await supabase
          .from("production_defects")
          .delete()
          .eq("production_detail_id", targetDetailId);

        const rawBlocks = blokVal ? blokVal.split(",").map(b => b.replace(/blok\s*/gi, "").trim()).filter(Boolean) : [];
        if (rawBlocks.length > 0) {
          const rows = rawBlocks.map(b => ({
            production_detail_id: targetDetailId,
            kategori: kategoriVal,
            detail: detailVal,
            blok: b,
          }));
          await supabase.from("production_defects").insert(rows);
        } else {
          await supabase.from("production_defects").insert({
            production_detail_id: targetDetailId,
            kategori: kategoriVal,
            detail: detailVal,
            blok: null,
          });
        }
      } else {
        const newDetailId = `${headerId}-quick-${pcsIndex}-${Date.now().toString(36)}`;
        const { error: insertError } = await supabase
          .from("production_details")
          .insert({
            id: newDetailId,
            header_id: headerId,
            pcs_index: pcsIndex,
            jml_hasil_produksi: 1,
            indikator_stop: true,
            kategori_masalah: kategoriVal,
            detail_masalah: detailVal,
            keterangan_cacat: keteranganVal,
          });

        if (insertError) throw insertError;

        const rawBlocks = blokVal ? blokVal.split(",").map(b => b.replace(/blok\s*/gi, "").trim()).filter(Boolean) : [];
        if (rawBlocks.length > 0) {
          const rows = rawBlocks.map(b => ({
            production_detail_id: newDetailId,
            kategori: kategoriVal,
            detail: detailVal,
            blok: b,
          }));
          await supabase.from("production_defects").insert(rows);
        } else {
          await supabase.from("production_defects").insert({
            production_detail_id: newDetailId,
            kategori: kategoriVal,
            detail: detailVal,
            blok: null,
          });
        }
      }
    } else {
      // Mengubah jadi NORMAL
      if (detailId) {
        await supabase
          .from("production_defects")
          .delete()
          .eq("production_detail_id", detailId);

        const { error: cleanError } = await supabase
          .from("production_details")
          .update({
            indikator_stop: false,
            kategori_masalah: null,
            detail_masalah: null,
            keterangan_cacat: null,
            spesifik_masalah: null,
          })
          .eq("id", detailId);

        if (cleanError) throw cleanError;
      }
    }

    revalidatePath("/history");
    return { success: true };
  } catch (err: any) {
    console.error("Error updateInstantPanelDefectStatus:", err);
    return { success: false, error: err.message || "Gagal mengubah status cacat" };
  }
}

export async function cleanupDuplicateMeterFinishHeaders(params: {
  nomorMc: string;
  potonganKe: number;
}): Promise<{ success: boolean; deletedHeadersCount?: number; error?: string }> {
  try {
    const supabase = await createAdminClient();

    // 1. Fetch all headers for this machine and potongan
    const { data: headers, error: headersError } = await supabase
      .from("production_headers")
      .select("*, production_details(*, production_defects(*)), downtime_records(*)")
      .ilike("nomor_mc", params.nomorMc)
      .eq("potongan_ke", params.potonganKe)
      .order("tanggal_jam", { ascending: true });

    if (headersError) throw headersError;
    if (!headers || headers.length <= 1) {
      return { success: true, deletedHeadersCount: 0 };
    }

    // 2. Identify pure finish headers (headers that have meter_akhir, no defects, and no downtime events)
    const seenFinishKey = new Set<string>();
    const headerIdsToDelete: string[] = [];
    const detailIdsToDelete: string[] = [];

    headers.forEach((h: any) => {
      const details = h.production_details || [];
      const downtimes = h.downtime_records || [];

      const hasRealDefects = details.some((d: any) => {
        const defects = d.production_defects || [];
        return (
          defects.length > 0 ||
          (d.kategori_masalah && !d.kategori_masalah.includes("ISTIRAHAT")) ||
          (d.detail_masalah && !d.detail_masalah.includes("ISTIRAHAT"))
        );
      });

      const isIstirahat =
        details.some(
          (d: any) =>
            (d.keterangan_cacat || "").includes("ISTIRAHAT") ||
            (d.kategori_masalah || "").includes("ISTIRAHAT"),
        ) ||
        (h.operator_backup !== null &&
          h.operator_backup !== undefined &&
          String(h.operator_backup).trim() !== "");

      const isFinish =
        h.meter_akhir !== null &&
        h.meter_akhir !== undefined &&
        String(h.meter_akhir).trim() !== "";

      // If it is a pure finish header without any defects or istirahat records
      if (isFinish && !hasRealDefects && !isIstirahat && downtimes.length === 0) {
        const oprKey = `${h.operator_id || h.pic || ""}_${h.group_id || ""}_${h.tgl || ""}_${h.meter_akhir}`;
        if (seenFinishKey.has(oprKey)) {
          // This is a redundant duplicate finish header!
          headerIdsToDelete.push(h.id);
          details.forEach((d: any) => detailIdsToDelete.push(d.id));
        } else {
          seenFinishKey.add(oprKey);
        }
      }
    });

    if (headerIdsToDelete.length > 0) {
      // Delete child records first
      if (detailIdsToDelete.length > 0) {
        await supabase
          .from("production_defects")
          .delete()
          .in("production_detail_id", detailIdsToDelete);

        await supabase
          .from("production_details")
          .delete()
          .in("id", detailIdsToDelete);
      }

      await supabase
        .from("production_headers")
        .delete()
        .in("id", headerIdsToDelete);
    }

    revalidatePath("/history");
    return { success: true, deletedHeadersCount: headerIdsToDelete.length };
  } catch (err: any) {
    console.error("Error cleanupDuplicateMeterFinishHeaders:", err);
    return { success: false, error: err.message || "Gagal membersihkan data duplikat" };
  }
}

