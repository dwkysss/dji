"use server";

import { createClient } from "@/lib/supabase/server";
import { REGISTERED_MACHINES } from "@/lib/constants";

export interface DesignReportRow {
  no: number;
  tanggalPotong: string;
  rawDate?: string;
  isFromEarlierMonth?: boolean;
  monthBadge?: string;
  designId: string;
  noPot: number;
  totalProdPanel: number;
  gradeA_prod: number;
  gradeA_prod_pct: number;
  gradeA_inspect: number | null;
  gradeA_inspect_pct: number | null;
  gradeB_prod: number;
  gradeB_prod_pct: number;
  gradeB_inspect: number | null;
  gradeB_inspect_pct: number | null;
  status: "INSPECTED" | "MENDED" | "QC_ONLY" | "UNINSPECTED";
}

export interface DesignReportSummary {
  totalPotongan: number;
  totalProdPanel: number;
  inspectedCuts?: number;
  inspectedPanels?: number;
  gradeA_prod: number;
  gradeA_prod_pct: number;
  gradeA_inspect: number;
  gradeA_inspect_pct: number;
  gradeB_prod: number;
  gradeB_prod_pct: number;
  gradeB_inspect: number;
  gradeB_inspect_pct: number;
}

export interface DesignReportGroup {
  designId: string;
  index: number;
  rows: DesignReportRow[];
  summary: DesignReportSummary;
  hasCrossMonthRows?: boolean;
  earlierMonthCount?: number;
}

export async function getDesignReportOptions() {
  try {
    const supabase = await createClient();

    // Ambil daftar design unik
    const { data: headerDesigns } = await supabase
      .from("production_headers")
      .select("design_id")
      .not("design_id", "is", null)
      .limit(3000);

    const designSet = new Set<string>();
    (headerDesigns || []).forEach((h: any) => {
      if (h.design_id && h.design_id.trim() !== "") {
        designSet.add(h.design_id.trim().toUpperCase());
      }
    });

    const currentYear = new Date().getFullYear();
    const years = [
      (currentYear + 1).toString(),
      currentYear.toString(),
      (currentYear - 1).toString(),
      (currentYear - 2).toString(),
    ];

    return {
      success: true,
      data: {
        mesins: [...REGISTERED_MACHINES],
        designs: Array.from(designSet).sort(),
        years,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Gagal memuat opsi filter laporan",
      data: {
        mesins: [...REGISTERED_MACHINES],
        designs: [],
        years: [new Date().getFullYear().toString()],
      },
    };
  }
}

export async function getDesignReportData(
  machine: string,
  year?: string,
  months?: string[] | string,
  designFilter?: string,
  includeCrossMonth: boolean = true
): Promise<{
  success: boolean;
  data?: DesignReportGroup[];
  grandSummary?: DesignReportSummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const mc = machine.trim();
    const targetYear = year || new Date().getFullYear().toString();

    // 1. Parsing & Normalisasi Multi-Bulan
    let selectedMonths: number[] = [];
    if (!months || months === "ALL" || (Array.isArray(months) && months.includes("ALL"))) {
      selectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    } else if (Array.isArray(months)) {
      selectedMonths = months
        .map((m) => parseInt(m, 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 12);
    } else if (typeof months === "string") {
      selectedMonths = months
        .split(",")
        .map((m) => parseInt(m.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 12);
    }

    if (selectedMonths.length === 0) {
      selectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }

    const selectedMonthsSet = new Set(selectedMonths);
    const minMonth = Math.min(...selectedMonths);
    const maxMonth = Math.max(...selectedMonths);
    const isFullYear = selectedMonths.length === 12;

    const startDate = `${targetYear}-${String(minMonth).padStart(2, "0")}-01`;
    const lastDayOfMaxMonth = new Date(Number(targetYear), maxMonth, 0).getDate();
    const endDate = `${targetYear}-${String(maxMonth).padStart(2, "0")}-${String(
      lastDayOfMaxMonth
    ).padStart(2, "0")}`;

    const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    // 2. Tentukan Desain Aktif di bulan terpilih jika includeCrossMonth aktif dan bukan setahun penuh
    let activeDesignSet: Set<string> | null = null;

    if (includeCrossMonth && !isFullYear) {
      activeDesignSet = new Set<string>();

      if (designFilter && designFilter !== "ALL") {
        activeDesignSet.add(designFilter.trim().toUpperCase());
      } else {
        // Cari desain aktif berdasarkan tanggal potong kain aktual (production_headers) di rentang bulan terpilih
        const { data: actH } = await supabase
          .from("production_headers")
          .select("design_id")
          .eq("nomor_mc", mc)
          .gte("tgl", startDate)
          .lte("tgl", endDate)
          .not("design_id", "is", null)
          .limit(3000);

        (actH || []).forEach((h: any) => {
          if (h.design_id && h.design_id.trim() !== "") {
            activeDesignSet!.add(h.design_id.trim().toUpperCase());
          }
        });
      }

      // Jika tidak ada desain aktif sama sekali di bulan ini, kembalikan data kosong langsung
      if (activeDesignSet.size === 0) {
        return {
          success: true,
          data: [],
          grandSummary: {
            totalPotongan: 0,
            totalProdPanel: 0,
            gradeA_prod: 0,
            gradeA_prod_pct: 0,
            gradeA_inspect: 0,
            gradeA_inspect_pct: 0,
            gradeB_prod: 0,
            gradeB_prod_pct: 0,
            gradeB_inspect: 0,
            gradeB_inspect_pct: 0,
          },
        };
      }
    };

    // 3. Ambil final_inspection_batches untuk mesin ini
    let fbQuery = supabase
      .from("final_inspection_batches")
      .select(`
        id,
        nomor_mc,
        design_id,
        potongan_ke,
        pcs_index,
        total_panel,
        final_grade_a,
        final_grade_b,
        final_grade_bs,
        tanggal_final,
        items:final_inspection_items (
          id,
          hasil_final,
          detail:production_details (
            id,
            jml_hasil_produksi,
            kategori_masalah,
            detail_masalah,
            keterangan_cacat,
            is_deleted,
            header:production_headers (
              id,
              design_id,
              potongan_ke,
              panel_no,
              nomor_mc,
              tanggal_potong,
              tgl
            )
          )
        )
      `)
      .eq("nomor_mc", mc);

    if (activeDesignSet && activeDesignSet.size > 0) {
      fbQuery = fbQuery.in("design_id", Array.from(activeDesignSet));
    } else if (designFilter && designFilter !== "ALL") {
      fbQuery = fbQuery.eq("design_id", designFilter.toUpperCase());
    }

    const { data: finalBatches, error: fbErr } = await fbQuery;

    if (fbErr) {
      return { success: false, error: fbErr.message };
    }

    // 4. Ambil mending_batches & qc_inspection_batches sebagai fallback
    const { data: mendingBatches } = await supabase
      .from("mending_batches")
      .select("potongan_ke, design_id, mending_grade_a, mending_grade_b, mending_grade_bs, total_panel, tanggal_mending")
      .eq("nomor_mc", mc);

    const { data: qcBatches } = await supabase
      .from("qc_inspection_batches")
      .select("potongan_ke, design_id, inspeksi_ceklis, inspeksi_silang, berat_kain, tanggal_inspeksi")
      .eq("nomor_mc", mc);

    // 5. Ambil production_headers dengan PAGINATION
    let allHeaders: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Jika includeCrossMonth aktif, tarik dari awal tahun sampai akhir bulan yang dipilih (endDate)
    // agar potongan yang dibuat sebelum bulan terpilih untuk desain yang sama dapat disertakan!
    const queryStartDate = includeCrossMonth && !isFullYear ? `${targetYear}-01-01` : startDate;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let hQuery = supabase
        .from("production_headers")
        .select("id, nomor_mc, design_id, potongan_ke, panel_no, tanggal_potong, tgl")
        .eq("nomor_mc", mc)
        .not("potongan_ke", "is", null)
        .gte("tgl", queryStartDate)
        .lte("tgl", endDate)
        .order("potongan_ke", { ascending: true });

      if (activeDesignSet && activeDesignSet.size > 0) {
        hQuery = hQuery.in("design_id", Array.from(activeDesignSet));
      } else if (designFilter && designFilter !== "ALL") {
        hQuery = hQuery.eq("design_id", designFilter.toUpperCase());
      }

      const { data: hPage, error: hErr } = await hQuery.range(from, to);

      if (hErr) {
        return { success: false, error: hErr.message };
      }

      if (hPage && hPage.length > 0) {
        allHeaders.push(...hPage);
        if (hPage.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const coveredPotMap = new Set<string>();
    const rowList: DesignReportRow[] = [];

    // 6. Proses data dari final_inspection_batches
    (finalBatches || []).forEach((batch: any) => {
      const pNum = Number(batch.potongan_ke);
      const dId = (batch.design_id || "").trim().toUpperCase();
      if (!pNum || !dId) return;

      let tanggalPotong = batch.tanggal_final || "";

      // Ambil items yang valid (tidak dihapus)
      const validItems = (batch.items || []).filter((it: any) => {
        const d = it.detail || {};
        const isDel =
          !!d.is_deleted ||
          (d.keterangan_cacat || "").includes("[DIHAPUS]") ||
          (d.detail_masalah || "").includes("PANEL DIHAPUS") ||
          it.hasil_final === "Dihapus";
        return !isDel;
      });

      let prodA = 0;
      let prodB = 0;
      let inspA = 0;
      let inspB = 0;

      validItems.forEach((it: any) => {
        const d = it.detail || {};
        const h = d.header || {};

        if (h.tanggal_potong && (!tanggalPotong || tanggalPotong === batch.tanggal_final)) {
          tanggalPotong = h.tanggal_potong;
        } else if (h.tgl && !tanggalPotong) {
          tanggalPotong = h.tgl;
        }

        const pNo = String(h.panel_no || "").trim().toUpperCase();
        if (pNo === "METERAN") return;

        const isBs =
          pNo.includes("BS") ||
          pNo.includes("AWAL") ||
          pNo.includes("AKHIR") ||
          d.jml_hasil_produksi === 0 ||
          d.kategori_masalah === "BS";

        const kat = String(d.kategori_masalah || "").toUpperCase().trim();
        const det = String(d.detail_masalah || "").toUpperCase().trim();
        const isIstirahat = kat.includes("ISTIRAHAT") && !det;
        const hasDefect =
          (kat !== "" && kat !== "G" && !isIstirahat && !kat.includes("GAGAL CACAT")) ||
          (det !== "" && !det.includes("GAGAL CACAT"));

        // Sebelum inspek: BS atau cacat produksi masuk ke Grade B (Grade B = B + BS)
        // Panel tambahan QC juga dihitung (jika cacat/BS masuk Grade B, jika bersih masuk Grade A)
        if (isBs || hasDefect) {
          prodB += 1;
        } else {
          prodA += 1;
        }

        // Sesudah inspek: Hasil Final A vs (B + BS)
        if (it.hasil_final === "A") {
          inspA += 1;
        } else {
          inspB += 1;
        }
      });

      // Validasi tanggal berdasarkan multi-bulan & cross-month
      let isFromEarlierMonth = false;
      let monthBadge = "";
      if (tanggalPotong) {
        const parts = tanggalPotong.split("-");
        const rowYear = parts[0];
        const rowMonth = parseInt(parts[1], 10);
        if (rowYear !== targetYear) return;
        if (rowMonth > maxMonth) return;
        if (!selectedMonthsSet.has(rowMonth)) {
          if (!includeCrossMonth) return;
          isFromEarlierMonth = true;
          monthBadge = MONTH_ABBR[rowMonth] || "";
        }
      }

      // Filter Design
      if (designFilter && designFilter !== "ALL" && dId !== designFilter.toUpperCase()) {
        return;
      }

      const potKey = `${dId}__${pNum}`;
      coveredPotMap.add(potKey);

      // Total produksi panel menggunakan total panel aktual (termasuk BS dan panel tambahan di inspek)
      const totalProdPanel = validItems.length > 0 ? validItems.length : Number(batch.total_panel || 0);

      // Fallback jika item tidak ada tapi batch memiliki angka final
      if (inspA === 0 && inspB === 0 && batch.final_grade_a !== undefined) {
        inspA = Number(batch.final_grade_a || 0);
        inspB = Number(batch.final_grade_b || 0) + Number(batch.final_grade_bs || 0);
      }

      // Pastikan kedua total (Prod dan Inspect) selalu seimbang sama persis dengan totalProdPanel
      if (totalProdPanel > 0 && inspA + inspB !== totalProdPanel) {
        inspB = Math.max(0, totalProdPanel - inspA);
      }
      if (totalProdPanel > 0 && prodA + prodB !== totalProdPanel) {
        prodB = Math.max(0, totalProdPanel - prodA);
      }

      const gradeA_prod_pct = totalProdPanel > 0 ? (prodA / totalProdPanel) * 100 : 0;
      const gradeB_prod_pct = totalProdPanel > 0 ? (prodB / totalProdPanel) * 100 : 0;
      const gradeA_inspect_pct = totalProdPanel > 0 ? (inspA / totalProdPanel) * 100 : 0;
      const gradeB_inspect_pct = totalProdPanel > 0 ? (inspB / totalProdPanel) * 100 : 0;

      rowList.push({
        no: 0,
        tanggalPotong: formatDateDisplay(tanggalPotong),
        rawDate: tanggalPotong,
        isFromEarlierMonth,
        monthBadge,
        designId: dId,
        noPot: pNum,
        totalProdPanel,
        gradeA_prod: prodA,
        gradeA_prod_pct: Number(gradeA_prod_pct.toFixed(2)),
        gradeA_inspect: inspA,
        gradeA_inspect_pct: Number(gradeA_inspect_pct.toFixed(2)),
        gradeB_prod: prodB,
        gradeB_prod_pct: Number(gradeB_prod_pct.toFixed(2)),
        gradeB_inspect: inspB,
        gradeB_inspect_pct: Number(gradeB_inspect_pct.toFixed(2)),
        status: "INSPECTED",
      });
    });

    // 7. Proses potongan dari allHeaders yang belum tercakup di final_inspection_batches
    const unfinalizedHeadersMap = new Map<string, { headers: any[]; isFromEarlierMonth: boolean; monthBadge: string }>();
    allHeaders.forEach((h: any) => {
      const pNum = Number(h.potongan_ke);
      const dId = String(h.design_id || "").trim().toUpperCase();
      if (!pNum || !dId) return;

      const potKey = `${dId}__${pNum}`;
      if (coveredPotMap.has(potKey)) return;

      const tgl = h.tanggal_potong || h.tgl || "";
      let isFromEarlier = false;
      let mBadge = "";
      if (tgl) {
        const parts = tgl.split("-");
        const rowYear = parts[0];
        const rowMonth = parseInt(parts[1], 10);
        if (rowYear !== targetYear) return;
        if (rowMonth > maxMonth) return;
        if (!selectedMonthsSet.has(rowMonth)) {
          if (!includeCrossMonth) return;
          isFromEarlier = true;
          mBadge = MONTH_ABBR[rowMonth] || "";
        }
      }

      if (designFilter && designFilter !== "ALL" && dId !== designFilter.toUpperCase()) return;

      if (!unfinalizedHeadersMap.has(potKey)) {
        unfinalizedHeadersMap.set(potKey, {
          headers: [],
          isFromEarlierMonth: isFromEarlier,
          monthBadge: mBadge,
        });
      }
      unfinalizedHeadersMap.get(potKey)!.headers.push(h);
    });

    // Ambil detail secara chunked (maks 150 IDs per chunk)
    const unfinalizedHeaderIds: string[] = [];
    unfinalizedHeadersMap.forEach((entry) => {
      entry.headers.forEach((h) => unfinalizedHeaderIds.push(h.id));
    });

    const unfinalizedDetailsMap = new Map<string, any[]>();
    const chunkSize = 150;
    for (let i = 0; i < unfinalizedHeaderIds.length; i += chunkSize) {
      const chunk = unfinalizedHeaderIds.slice(i, i + chunkSize);
      const { data: chunkDetails } = await supabase
        .from("production_details")
        .select("id, header_id, jml_hasil_produksi, kategori_masalah, detail_masalah, is_deleted")
        .in("header_id", chunk)
        .eq("is_deleted", false);

      (chunkDetails || []).forEach((d: any) => {
        if (!unfinalizedDetailsMap.has(d.header_id)) {
          unfinalizedDetailsMap.set(d.header_id, []);
        }
        unfinalizedDetailsMap.get(d.header_id)!.push(d);
      });
    }

    // Susun baris untuk unfinalized cuts
    unfinalizedHeadersMap.forEach((entry, potKey) => {
      const hdrs = entry.headers;
      const [dId, pNumStr] = potKey.split("__");
      const pNum = Number(pNumStr);
      const firstHdr = hdrs[0];
      const tanggalPotong = firstHdr.tanggal_potong || firstHdr.tgl || "";

      let prodA = 0;
      let prodB = 0;

      hdrs.forEach((h: any) => {
        const pNo = String(h.panel_no || "").trim().toUpperCase();
        if (pNo === "METERAN") return;

        const isBs = pNo.includes("BS") || pNo.includes("AWAL") || pNo.includes("AKHIR");

        const dList = unfinalizedDetailsMap.get(h.id) || [];
        let hasDefect = false;
        dList.forEach((d: any) => {
          const kat = String(d.kategori_masalah || "").toUpperCase().trim();
          const det = String(d.detail_masalah || "").toUpperCase().trim();
          const isIstirahat = kat.includes("ISTIRAHAT") && !det;
          if (
            (kat !== "" && kat !== "G" && !isIstirahat && !kat.includes("GAGAL CACAT")) ||
            (det !== "" && !det.includes("GAGAL CACAT"))
          ) {
            hasDefect = true;
          }
        });

        // BS atau cacat masuk ke Grade B (Grade B = B + BS)
        if (isBs || hasDefect) {
          prodB += 1;
        } else {
          prodA += 1;
        }
      });

      const totalProdPanel = prodA + prodB;

      let inspA = 0;
      let inspB = 0;
      let status: "INSPECTED" | "MENDED" | "QC_ONLY" | "UNINSPECTED" = "UNINSPECTED";

      const mMatch = (mendingBatches || []).find(
        (b: any) => Number(b.potongan_ke) === pNum && String(b.design_id || "").toUpperCase() === dId
      );
      if (mMatch) {
        inspA = Number(mMatch.mending_grade_a || 0);
        inspB = Number(mMatch.mending_grade_b || 0) + Number(mMatch.mending_grade_bs || 0);
        if (inspA + inspB !== totalProdPanel && totalProdPanel > 0) {
          inspB = Math.max(0, totalProdPanel - inspA);
        }
        status = "MENDED";
      } else {
        const qMatch = (qcBatches || []).find(
          (b: any) => Number(b.potongan_ke) === pNum && String(b.design_id || "").toUpperCase() === dId
        );
        if (qMatch) {
          inspA = Number(qMatch.inspeksi_ceklis || 0);
          inspB = Number(qMatch.inspeksi_silang || 0);
          if (inspA + inspB !== totalProdPanel && totalProdPanel > 0) {
            inspB = Math.max(0, totalProdPanel - inspA);
          }
          status = "QC_ONLY";
        } else {
          status = "UNINSPECTED";
        }
      }

      const gradeA_prod_pct = totalProdPanel > 0 ? (prodA / totalProdPanel) * 100 : 0;
      const gradeB_prod_pct = totalProdPanel > 0 ? (prodB / totalProdPanel) * 100 : 0;

      let gradeA_inspect: number | null = null;
      let gradeA_inspect_pct: number | null = null;
      let gradeB_inspect: number | null = null;
      let gradeB_inspect_pct: number | null = null;

      if (status !== "UNINSPECTED") {
        gradeA_inspect = inspA;
        gradeB_inspect = inspB;
        gradeA_inspect_pct = totalProdPanel > 0 ? Number(((inspA / totalProdPanel) * 100).toFixed(2)) : 0;
        gradeB_inspect_pct = totalProdPanel > 0 ? Number(((inspB / totalProdPanel) * 100).toFixed(2)) : 0;
      }

      rowList.push({
        no: 0,
        tanggalPotong: formatDateDisplay(tanggalPotong),
        rawDate: tanggalPotong,
        isFromEarlierMonth: entry.isFromEarlierMonth,
        monthBadge: entry.monthBadge,
        designId: dId,
        noPot: pNum,
        totalProdPanel,
        gradeA_prod: prodA,
        gradeA_prod_pct: Number(gradeA_prod_pct.toFixed(2)),
        gradeA_inspect,
        gradeA_inspect_pct,
        gradeB_prod: prodB,
        gradeB_prod_pct: Number(gradeB_prod_pct.toFixed(2)),
        gradeB_inspect,
        gradeB_inspect_pct,
        status,
      });
    });

    // 7. Kelompokkan rowList per Design (Menyatukan potongan dari berbagai bulan ke desain yang sama!)
    const groupsMap = new Map<string, DesignReportRow[]>();
    rowList.forEach((row) => {
      if (!groupsMap.has(row.designId)) {
        groupsMap.set(row.designId, []);
      }
      groupsMap.get(row.designId)!.push(row);
    });

    const groups: DesignReportGroup[] = [];

    let grandTotalProd = 0;
    let grandProdA = 0;
    let grandProdB = 0;
    let grandInspA = 0;
    let grandInspB = 0;
    let grandInspectedPanels = 0;
    let grandPotCount = 0;

    groupsMap.forEach((rows, dId) => {
      // Validasi: Desain ini WAJIB memiliki setidaknya 1 potongan yang dipotong pada bulan yang dipilih!
      // Jika semua potongan di desain ini berasal dari bulan sebelumnya (100% isFromEarlierMonth), lewati grup ini.
      const hasCutInSelectedMonths = rows.some((r) => !r.isFromEarlierMonth);
      if (!hasCutInSelectedMonths) {
        return;
      }

      // Urutkan nomor potongan menaik (ascending)
      rows.sort((a, b) => a.noPot - b.noPot);

      let totalProdPanel = 0;
      let totalProdA = 0;
      let totalProdB = 0;
      let totalInspA = 0;
      let totalInspB = 0;
      let inspectedPanels = 0;
      let inspectedCuts = 0;
      let earlierMonthCount = 0;

      rows.forEach((r) => {
        if (r.isFromEarlierMonth) {
          earlierMonthCount++;
        }
        totalProdPanel += r.totalProdPanel;
        totalProdA += r.gradeA_prod;
        totalProdB += r.gradeB_prod;

        if (r.status !== "UNINSPECTED" && r.gradeA_inspect !== null && r.gradeB_inspect !== null) {
          totalInspA += r.gradeA_inspect;
          totalInspB += r.gradeB_inspect;
          inspectedPanels += r.totalProdPanel;
          inspectedCuts++;
        }
      });

      const gradeA_prod_pct = totalProdPanel > 0 ? (totalProdA / totalProdPanel) * 100 : 0;
      const gradeB_prod_pct = totalProdPanel > 0 ? (totalProdB / totalProdPanel) * 100 : 0;
      const gradeA_inspect_pct = inspectedPanels > 0 ? (totalInspA / inspectedPanels) * 100 : 0;
      const gradeB_inspect_pct = inspectedPanels > 0 ? (totalInspB / inspectedPanels) * 100 : 0;

      const summary: DesignReportSummary = {
        totalPotongan: rows.length,
        totalProdPanel,
        inspectedCuts,
        inspectedPanels,
        gradeA_prod: totalProdA,
        gradeA_prod_pct: Number(gradeA_prod_pct.toFixed(2)),
        gradeA_inspect: totalInspA,
        gradeA_inspect_pct: Number(gradeA_inspect_pct.toFixed(2)),
        gradeB_prod: totalProdB,
        gradeB_prod_pct: Number(gradeB_prod_pct.toFixed(2)),
        gradeB_inspect: totalInspB,
        gradeB_inspect_pct: Number(gradeB_inspect_pct.toFixed(2)),
      };

      grandTotalProd += totalProdPanel;
      grandProdA += totalProdA;
      grandProdB += totalProdB;
      grandInspA += totalInspA;
      grandInspB += totalInspB;
      grandInspectedPanels += inspectedPanels;
      grandPotCount += rows.length;

      groups.push({
        designId: dId,
        index: 0,
        rows,
        summary,
        hasCrossMonthRows: earlierMonthCount > 0,
        earlierMonthCount,
      });
    });

    // Urutkan antargrup berdasarkan nomor potongan terendah di grup tersebut
    groups.sort((a, b) => {
      const potA = a.rows.length > 0 ? a.rows[0].noPot : 0;
      const potB = b.rows.length > 0 ? b.rows[0].noPot : 0;
      return potA - potB;
    });

    // Re-index nomor grup (NO) agar berurutan 1, 2, 3 sesuai urutan nomor potongan
    groups.forEach((grp, idx) => {
      grp.index = idx + 1;
      grp.rows.forEach((r, rIdx) => {
        r.no = rIdx === 0 ? grp.index : rIdx + 1;
      });
    });

    const grandSummary: DesignReportSummary = {
      totalPotongan: grandPotCount,
      totalProdPanel: grandTotalProd,
      inspectedPanels: grandInspectedPanels,
      gradeA_prod: grandProdA,
      gradeA_prod_pct: grandTotalProd > 0 ? Number(((grandProdA / grandTotalProd) * 100).toFixed(2)) : 0,
      gradeA_inspect: grandInspA,
      gradeA_inspect_pct: grandInspectedPanels > 0 ? Number(((grandInspA / grandInspectedPanels) * 100).toFixed(2)) : 0,
      gradeB_prod: grandProdB,
      gradeB_prod_pct: grandTotalProd > 0 ? Number(((grandProdB / grandTotalProd) * 100).toFixed(2)) : 0,
      gradeB_inspect: grandInspB,
      gradeB_inspect_pct: grandInspectedPanels > 0 ? Number(((grandInspB / grandInspectedPanels) * 100).toFixed(2)) : 0,
    };

    return {
      success: true,
      data: groups,
      grandSummary,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Terjadi kesalahan saat memproses data laporan per design",
    };
  }
}

function formatDateDisplay(dStr?: string): string {
  if (!dStr) return "-";
  try {
    const parts = dStr.split("T")[0].split("-");
    if (parts.length === 3) {
      const day = parts[2].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[0];
      return `${day}/${month}/${year}`;
    }
    return dStr;
  } catch {
    return dStr;
  }
}
