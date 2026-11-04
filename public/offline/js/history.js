/**
 * History Drawer (1:1 Identical with ContinuousHistoryDrawer.tsx & MeterHistoryTable.tsx & PanelHistoryTable.tsx)
 * Flexible based on Total PCS (e.g. PCS 1, PCS 2, PCS 3...)
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { KEYS, getApiBaseUrl } = window.DJIConfig;
  const { appState } = window.DJIState;

  let filterMcOnly = true;
  let filterPotonganOnly = true;
  let lastFetchedData = [];
  let isFetchingLive = false;

  function toggleFilterMc() {
    filterMcOnly = !filterMcOnly;
    updateFilterButtonUI();
    renderHistoryDrawer();
  }

  function toggleFilterPot() {
    filterPotonganOnly = !filterPotonganOnly;
    updateFilterButtonUI();
    renderHistoryDrawer();
  }

  function updateFilterButtonUI() {
    const btnMc = document.getElementById("btnFilterHistoryMc");
    const txtMc = document.getElementById("txtFilterHistoryMc");
    const btnPot = document.getElementById("btnFilterHistoryPot");
    const txtPot = document.getElementById("txtFilterHistoryPot");

    const curMc = (appState.selectedMc || "R1").toUpperCase();
    const curPot = String(appState.selectedPotongan || 1);

    if (btnMc && txtMc) {
      if (filterMcOnly) {
        btnMc.classList.add("active");
        txtMc.textContent = `MC ${curMc}`;
      } else {
        btnMc.classList.remove("active");
        txtMc.textContent = "Semua Mesin";
      }
    }

    if (btnPot && txtPot) {
      if (!filterMcOnly) {
        btnPot.style.display = "none";
      } else {
        btnPot.style.display = "flex";
        if (filterPotonganOnly) {
          btnPot.classList.add("active");
          txtPot.textContent = `Pot. #${curPot}`;
        } else {
          btnPot.classList.remove("active");
          txtPot.textContent = "Semua Pot.";
        }
      }
    }
  }

  async function refreshHistory() {
    const icon = document.getElementById("iconRefreshHistory");
    if (icon) icon.classList.add("spin-animation");

    await fetchServerHistory(true);

    if (icon) icon.classList.remove("spin-animation");
    renderHistoryDrawer();
  }

  async function fetchServerHistory(force = false) {
    if (!navigator.onLine) return;
    const curMc = (appState.selectedMc || "R1").toUpperCase();
    const curPot = String(appState.selectedPotongan || 1);
    const baseUrl = getApiBaseUrl ? getApiBaseUrl() : "";

    isFetchingLive = true;
    try {
      let url = `${baseUrl}/api/mobile/history?nomorMc=${encodeURIComponent(curMc)}&limit=100`;
      if (filterPotonganOnly && curPot) {
        url += `&potonganKe=${encodeURIComponent(curPot)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          lastFetchedData = json.data;
          try {
            localStorage.setItem(`dji_hist_cache_${curMc}`, JSON.stringify(json.data));
            if (curPot) {
              localStorage.setItem(`dji_hist_cache_${curMc}_${curPot}`, JSON.stringify(json.data));
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Gagal fetch live history, fallback ke cache/snapshot:", err);
    } finally {
      isFetchingLive = false;
    }
  }

  function getCombinedHistoryData() {
    const curMc = (appState.selectedMc || "R1").toUpperCase();
    const curPot = String(appState.selectedPotongan || 1);

    // 1. Ambil antrean lokal di HP (dji_offline_queue)
    let localQueueItems = [];
    try {
      const rawQ = localStorage.getItem(KEYS.QUEUE);
      if (rawQ) {
        const parsed = JSON.parse(rawQ);
        parsed.forEach(item => {
          const isMeter = item.inputType === "METER" || item.type === "continuous" || ["R11", "R12", "R13", "R16", "T2A"].includes(String(item.nomorMc || curMc).toUpperCase());
          const prodDetails = [];

          if (item.data && Array.isArray(item.data.pcsData) && item.data.pcsData.length > 0) {
            item.data.pcsData.forEach(p => {
              prodDetails.push({
                pcs_index: parseInt(p.pcsIndex || 1, 10),
                jml_hasil_produksi: parseInt(p.jmlHasilProduksi || 0, 10),
                meter_kain: p.meterKain || null,
                is_bs: Boolean(p.isBs),
                detail_masalah: item.keteranganCacat || item.detailMasalah || (item.data && (item.data.keteranganCacat || item.data.detailMasalah)) || null,
                kategori_masalah: item.kategoriMasalah || (item.data && item.data.kategoriMasalah) || null,
                keterangan_cacat: item.jenisLaporan || (item.isPanelBs ? "Panel BS" : "NORMAL"),
                production_defects: item.productionDefects || []
              });
            });
          } else if (isMeter) {
            const curPcsTotal = appState.currentPcs || (["R11", "R12", "R13", "R16"].includes(curMc) ? 3 : 2);
            for (let pi = 1; pi <= curPcsTotal; pi++) {
              prodDetails.push({
                pcs_index: pi,
                jml_hasil_produksi: (item.isPanelBs || item.isBs) ? 0 : 1,
                meter_kain: item.meterAkhir || item.meterAwal || null,
                is_bs: Boolean(item.isPanelBs || item.isBs),
                detail_masalah: item.keteranganCacat || item.detailMasalah || null,
                kategori_masalah: item.kategoriMasalah || null,
                keterangan_cacat: item.jenisLaporan || (item.isPanelBs ? "Panel BS" : "NORMAL"),
                production_defects: item.productionDefects || []
              });
            }
          } else {
            prodDetails.push({
              pcs_index: 1,
              jml_hasil_produksi: (item.isPanelBs || item.isBs) ? 0 : 1,
              is_bs: Boolean(item.isPanelBs || item.isBs),
              detail_masalah: item.keteranganCacat || item.detailMasalah || null,
              keterangan_cacat: item.jenisLaporan || (item.isPanelBs ? "Panel BS" : "NORMAL")
            });
          }

          localQueueItems.push({
            ...item,
            isLocalQueue: true,
            id: item.localId || item.id || `local-${Math.random()}`,
            panel_no: isMeter ? "METERAN" : (item.panelNo || item.panel_no),
            nomor_mc: item.nomorMc,
            potongan_ke: item.potonganKe,
            tanggal_jam: item.timestamp || new Date().toISOString(),
            tgl: (item.timestamp ? item.timestamp.split("T")[0] : new Date().toISOString().split("T")[0]),
            operators: { nama_operator: item.operatorName || "-" },
            operatorName: item.operatorName || "-",
            groups: { nama_grup: item.grupName || "A" },
            grupName: item.grupName || "A",
            operator_backup: item.operatorBackup || null,
            meter_awal: item.meterAwal !== undefined ? item.meterAwal : (item.data?.meterAwal ?? null),
            meter_akhir: item.meterAkhir !== undefined ? item.meterAkhir : (item.data?.meterAkhir ?? null),
            pcs: isMeter ? (item.pcs || prodDetails.length) : (item.pcs || 1),
            production_details: prodDetails,
            downtime_events: item.downtimeEvents || []
          });

          // Jika item antrean lokal bertanda Potong Kain (dan bukan meteran), tampilkan baris BS AKHIR di riwayat lokal
          if (item.isPotongKain && !isMeter) {
            localQueueItems.push({
              isLocalQueue: true,
              id: `local-bs-akhir-${item.id || Math.random()}`,
              panel_no: "BS AKHIR",
              nomor_mc: item.nomorMc,
              potongan_ke: item.potonganKe,
              tanggal_jam: item.timestamp || new Date().toISOString(),
              tgl: (item.timestamp ? item.timestamp.split("T")[0] : new Date().toISOString().split("T")[0]),
              operators: { nama_operator: item.operatorName || "-" },
              groups: { nama_grup: item.grupName || "A" },
              production_details: [
                {
                  pcs_index: 1,
                  jml_hasil_produksi: 0,
                  is_bs: true,
                  detail_masalah: "Sisa Akhir Potongan",
                  keterangan_cacat: "Sisa Akhir Potongan"
                }
              ],
              downtime_events: []
            });
          }
        });
      }
    } catch (e) {}

    // 2. Ambil data server (dari live fetch, atau cache localStorage, atau snapshot bootstrap)
    let serverData = null;
    if (lastFetchedData && Array.isArray(lastFetchedData) && lastFetchedData.length > 0) {
      const matchPot = lastFetchedData.some(item => 
        String(item.nomor_mc || item.nomorMc || "").toUpperCase() === curMc &&
        String(item.potongan_ke || item.potonganKe || "") === curPot
      );
      if (matchPot || !filterPotonganOnly) {
        serverData = lastFetchedData;
      }
    }

    if (!serverData || serverData.length === 0) {
      try {
        const rawCachedPot = localStorage.getItem(`dji_hist_cache_${curMc}_${curPot}`);
        if (rawCachedPot) {
          serverData = JSON.parse(rawCachedPot);
        } else {
          const rawCached = localStorage.getItem(`dji_hist_cache_${curMc}`);
          if (rawCached) serverData = JSON.parse(rawCached);
        }
      } catch (e) {}
    }

    if (!serverData || serverData.length === 0) {
      const snap = appState.bootstrap?.snapshots?.[curMc];
      const recent = snap?.recentItems || [];
      serverData = recent.map((r, i) => {
        const opName = r.operators?.nama_operator || r.operatorName || (i === 0 ? snap.operatorName : "-") || "-";
        const grpName = r.groups?.nama_grup || r.groupName || snap.groupId || "A";
        const prodDets = (r.production_details && r.production_details.length > 0)
          ? r.production_details
          : [
              {
                id: `snap-det-${i}`,
                pcs_index: 1,
                jml_hasil_produksi: r.isBs ? 0 : 1,
                is_bs: Boolean(r.isBs),
                detail_masalah: r.detail_masalah || r.detailMasalah || null,
                kategori_masalah: r.kategori_masalah || r.kategoriMasalah || null,
                keterangan_cacat: r.keterangan_cacat || r.jenisLaporan || (r.isBs ? "Panel BS" : "NORMAL"),
                production_defects: r.production_defects || []
              }
            ];
        return {
          id: r.id || `snap-${i}`,
          panel_no: r.panelNo || r.panel_no,
          nomor_mc: r.nomorMc || r.nomor_mc || curMc,
          potongan_ke: r.potonganKe || r.potongan_ke || curPot,
          tanggal_jam: r.tanggalJam || r.tanggal_jam,
          tgl: r.tgl || (r.tanggalJam ? r.tanggalJam.split("T")[0] : "-"),
          operators: r.operators || { nama_operator: opName },
          operatorName: opName,
          groups: r.groups || { nama_grup: grpName },
          groupName: grpName,
          operator_backup: r.operator_backup || null,
          meter_awal: r.meter_awal || r.meterAwal || null,
          meter_akhir: r.meter_akhir || r.meterAkhir || null,
          pcs: r.pcs || prodDets.length || 1,
          production_details: prodDets,
          downtime_events: r.downtime_events || []
        };
      });
    }

    const rawAll = [...localQueueItems, ...(serverData || [])];

    // Saring Laporan Downtime Khusus (Mesin Berhenti Total / Downtime Mekanik Direct)
    let specialDowntimePanels = rawAll.filter(item => {
      const pNo = String(item.panel_no || item.panelNo || "").trim();
      const type = String(item.type || "").toLowerCase();
      return pNo === "Downtime Mekanik (Direct)" || type === "special_downtime" || pNo.toLowerCase().includes("downtime mekanik");
    });
    if (filterMcOnly) {
      specialDowntimePanels = specialDowntimePanels.filter(item => String(item.nomor_mc || item.nomorMc || "").toUpperCase() === curMc);
    }

    // 3. Terapkan filter MC, Potongan, dan Saring DUMMY HEADER untuk tabel produksi
    let all = rawAll.filter(item => {
      const pNo = String(item.panel_no || item.panelNo || "").trim();
      if (pNo === "Downtime Mekanik (Direct)" || pNo === "BERHENTI" || pNo.toLowerCase().includes("downtime mekanik")) {
        return false;
      }
      if (item.pcs === 0 || item.pcs === "0") return false;
      return true;
    });

    if (filterMcOnly) {
      all = all.filter(item => String(item.nomor_mc || item.nomorMc || "").toUpperCase() === curMc);
      if (filterPotonganOnly) {
        all = all.filter(item => String(item.potongan_ke || item.potonganKe || "") === curPot);
      }
    }

    return { all, specialDowntimePanels, localCount: localQueueItems.length, serverCount: (serverData || []).length };
  }

  function cleanMeterVal(val) {
    if (val === null || val === undefined) return "";
    const str = String(val);
    const clean = str.replace(/PCS\s*\d+\s*:\s*/gi, "");
    const trimmed = clean.replace(/[a-zA-Z\s]+$/g, "").trim();
    return trimmed.replace(/\b0+(\d+)\b/g, "$1");
  }

  function formatWibTime(dateVal) {
    if (!dateVal || dateVal === "-" || dateVal === "—") return "-";
    try {
      let str = String(dateVal).trim();
      if (!str) return "-";
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
        return str.substring(0, 5);
      }
      if (str.includes(" ") && !str.includes("Z") && !str.includes("+") && !str.includes("-", 10)) {
        const timePart = str.split(" ")[1];
        if (timePart && timePart.includes(":")) {
          return timePart.substring(0, 5);
        }
      }
      const dt = new Date(str);
      if (isNaN(dt.getTime())) return "-";
      return dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
    } catch (e) {
      return "-";
    }
  }

  function formatTime(isoStr) {
    return formatWibTime(isoStr);
  }

  function formatDate(isoStr) {
    if (!isoStr || isoStr === "-") return "-";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}/.test(isoStr)) {
          return isoStr.split("T")[0];
        }
        return isoStr;
      }
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return isoStr;
    }
  }

  function parseDowntimeEvents(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function parseProductionDetails(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function formatDefectLinesWithNumbering(rawLines) {
    if (!rawLines || rawLines.length === 0) return [];
    const defectLines = rawLines.filter(line => {
      const trimmed = String(line || "").trim();
      if (!trimmed) return false;
      const isSpecial = trimmed.includes("Sisa Awal Potongan") ||
        trimmed.includes("Sisa Akhir Potongan") ||
        trimmed.startsWith("[Panel Dihapus]") ||
        trimmed === "[TAMBAHAN QC]" ||
        trimmed.startsWith("[DIHAPUS]") ||
        trimmed.startsWith("QC:");
      return !isSpecial;
    });

    const shouldNumber = defectLines.length > 1;
    let defectIndex = 1;
    return rawLines.map(line => {
      const trimmed = String(line || "").trim();
      if (!trimmed) return trimmed;
      const isSpecial = trimmed.includes("Sisa Awal Potongan") ||
        trimmed.includes("Sisa Akhir Potongan") ||
        trimmed.startsWith("[Panel Dihapus]") ||
        trimmed === "[TAMBAHAN QC]" ||
        trimmed.startsWith("[DIHAPUS]") ||
        trimmed.startsWith("QC:");
      if (isSpecial) return line;

      const isQcPrefix = trimmed.startsWith("[QC] ") || trimmed.startsWith("[TAMBAHAN QC] ");
      const qcTag = isQcPrefix ? (trimmed.startsWith("[QC] ") ? "[QC] " : "[TAMBAHAN QC] ") : "";
      let clean = (isQcPrefix ? trimmed.slice(qcTag.length) : trimmed).trim();
      clean = clean.replace(/^(\d+[\.\-]\s*|[A-Z0-9]\s*[\.\-]\s*|Kode\s*[A-Z0-9]+:\s*)+/i, "").trim();

      const numPrefix = shouldNumber ? `${defectIndex}. ` : "";
      defectIndex++;
      return `${qcTag}${numPrefix}${clean}`;
    });
  }

  function renderHistoryDrawer() {
    const container = document.getElementById("historyListContainer");
    const subTitle = document.getElementById("lblHistorySubtitle");
    const txtTotal = document.getElementById("txtHistoryTotalCount");
    const badgeQueue = document.getElementById("txtHistoryQueueBadge");

    if (!container) return;
    container.innerHTML = "";
    container.style.display = "block";
    container.style.overflowY = "auto";
    container.style.overflowX = "hidden";
    container.style.webkitOverflowScrolling = "touch";
    container.style.flex = "1 1 auto";
    container.style.minHeight = "0";
    container.style.height = "100%";

    const curMc = (appState.selectedMc || "R1").toUpperCase();
    const curPot = String(appState.selectedPotongan || 1);

    if (subTitle) {
      subTitle.textContent = `Mesin ${curMc} • Potongan #${curPot}`;
    }

    updateFilterButtonUI();

    const { all, specialDowntimePanels, localCount, serverCount } = getCombinedHistoryData();

    if (txtTotal) txtTotal.textContent = all.length;
    if (badgeQueue) {
      if (localCount > 0) {
        badgeQueue.style.display = "inline-flex";
        badgeQueue.textContent = `${localCount} antrean lokal di HP`;
      } else {
        badgeQueue.style.display = "none";
      }
    }

    if (all.length === 0 && (!specialDowntimePanels || specialDowntimePanels.length === 0)) {
      container.innerHTML = `
        <div style="text-align:center; padding: 48px 16px; color:#94a3b8; font-size:13px; font-weight:700; display:flex; flex-direction:column; align-items:center; gap:10px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.8" style="width:48px; height:48px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style="color:#334155; font-size:14px; font-weight:900;">Belum Ada Data Input</span>
          <p style="margin:0; font-size:12px; font-weight:500; color:#64748b; max-width:320px;">
            ${filterMcOnly ? `Belum ada riwayat inputan untuk Mesin ${curMc} ${filterPotonganOnly ? `Potongan #${curPot}` : ''}.` : 'Belum ada laporan input produksi yang tersimpan.'}
          </p>
        </div>
      `;
      return;
    }

    // 1:1 Matching Logic from ContinuousHistoryDrawer.tsx
    const pcsGroups = {};

    const uniqueById = new Map();
    all.forEach((panel) => {
      if (!uniqueById.has(panel.id)) {
        uniqueById.set(panel.id, { ...panel, production_details: [...(panel.production_details || [])] });
      }
    });

    const deduplicatedPanels = Array.from(uniqueById.values());
    const finalPanels = [];
    const seenPanelNo = new Map();

    deduplicatedPanels.forEach((panel) => {
      if (panel.panel_no === "METERAN") {
        finalPanels.push(panel);
      } else {
        const key = panel.panel_no;
        const existing = seenPanelNo.get(key);
        if (existing) {
          existing.production_details.push(...(panel.production_details || []));
          let existingDt = [];
          try {
            const parsed = typeof existing.downtime_events === 'string' ? JSON.parse(existing.downtime_events) : existing.downtime_events;
            existingDt = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            existingDt = [];
          }
          let newDt = [];
          try {
            const parsed = typeof panel.downtime_events === 'string' ? JSON.parse(panel.downtime_events) : panel.downtime_events;
            newDt = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            newDt = [];
          }
          existing.downtime_events = [...existingDt, ...newDt];

          const existingPcs = parseInt(existing.pcs || "1", 10);
          const newPcs = parseInt(panel.pcs || "1", 10);
          if (newPcs > existingPcs) existing.pcs = newPcs.toString();
        } else {
          seenPanelNo.set(key, panel);
        }
      }
    });

    finalPanels.push(...Array.from(seenPanelNo.values()));

    // CRITICAL: SORT BY TIME ASCENDING (OLDEST FIRST) FOR CORRECT TIMELINE ORDER!
    const oldestPanelIdByOperator = new Map();
    const sortedByTime = [...finalPanels].sort((a, b) => String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || "")));
    sortedByTime.forEach((p) => {
      const opr = p.operators?.nama_operator || p.operatorName || p.pic || p.created_by_name || "";
      const grp = p.groups?.nama_grup || p.grupName || p.group_id || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;
      if (!oldestPanelIdByOperator.has(operatorStr)) {
        oldestPanelIdByOperator.set(operatorStr, p.id);
      }
    });

    let maxBatchPcs = appState.currentPcs || 1;
    if (["R11", "R12", "R13", "R16"].includes(curMc)) maxBatchPcs = Math.max(maxBatchPcs, 3);
    else if (["T2", "T2A"].includes(curMc)) maxBatchPcs = Math.max(maxBatchPcs, 2);

    finalPanels.forEach((p) => {
      const pPcs = parseInt(p.pcs || "1", 10);
      if (pPcs > maxBatchPcs) maxBatchPcs = pPcs;
      if (p.production_details && Array.isArray(p.production_details)) {
        p.production_details.forEach((d) => {
          const dPcs = d.pcs_index ? parseInt(d.pcs_index, 10) : 1;
          if (dPcs > maxBatchPcs) maxBatchPcs = dPcs;
        });
      }
    });

    finalPanels.forEach((panel) => {
      if (panel.panel_no === "Downtime Mekanik (Direct)" || panel.pcs === 0 || panel.pcs === "0") {
        return;
      }
      const isMeterInput = panel.panel_no === "METERAN";
      const totalPcs = isMeterInput ? Math.max(maxBatchPcs, parseInt(panel.pcs ?? "1", 10)) : parseInt(panel.pcs ?? "1", 10);
      for (let i = 1; i <= totalPcs; i++) {
        const pcsKey = i.toString();
        if (!pcsGroups[pcsKey]) pcsGroups[pcsKey] = [];

        const panelClone = { ...panel };

        let dtEvents = [];
        try {
          if (typeof panelClone.downtime_events === 'string') {
            const parsed = JSON.parse(panelClone.downtime_events);
            dtEvents = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(panelClone.downtime_events)) {
            dtEvents = panelClone.downtime_events;
          }
        } catch (e) {
          dtEvents = [];
        }

        const matchedEvents = dtEvents.filter((e) => {
          if (!e.pcsKe || e.pcsKe === "Semua") return true;
          if (Array.isArray(e.pcsKe)) {
            return e.pcsKe.length === 0 || e.pcsKe.map((x) => String(x).trim()).includes(pcsKey);
          }
          return String(e.pcsKe).split(",").map((x) => x.trim()).includes(pcsKey);
        });

        let hasDetails = false;
        if (panelClone.production_details) {
          const filteredDetails = panelClone.production_details.filter((d) => {
            const pIndex = d.pcs_index ? parseInt(d.pcs_index, 10) : 1;
            return pIndex === i;
          });
          const hasErrors = filteredDetails.some((d) => d.kategori_masalah || d.keterangan_cacat || (d.production_defects && d.production_defects.length > 0));
          if (hasErrors) {
            hasDetails = true;
            panelClone.production_details = filteredDetails;
          } else {
            panelClone.production_details = [];
          }
        }

        const isIstirahat = panelClone.production_details?.some((d) => d.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT")) ||
          dtEvents.some((e) => e.kategori?.toUpperCase().includes("ISTIRAHAT"));

        const opr = panelClone.operators?.nama_operator || panelClone.operatorName || panelClone.pic || panelClone.created_by_name || "";
        const grp = panelClone.groups?.nama_grup || panelClone.grupName || panelClone.group_id || "";
        const operatorStr = (grp ? `(${grp}) ` : '') + opr;
        const isOldest = oldestPanelIdByOperator.get(operatorStr) === panelClone.id;
        const isFinishReport = isMeterInput && panelClone.meter_akhir !== null && panelClone.meter_akhir !== undefined && String(panelClone.meter_akhir).trim() !== "";

        if (isMeterInput) {
          if (isOldest || isFinishReport || matchedEvents.length > 0 || hasDetails || isIstirahat) {
            pcsGroups[pcsKey].push(panelClone);
          }
        } else {
          if (panelClone.production_details.length === 0) {
            panelClone.production_details = panel.production_details?.filter((d) => {
              const pIndex = d.pcs_index ? parseInt(d.pcs_index, 10) : 1;
              return pIndex === i;
            }) || [];
          }
          pcsGroups[pcsKey].push(panelClone);
        }
      }
    });

    const sortedPcsKeys = Object.keys(pcsGroups).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const isMeterReport = appState.currentMode === "METER" ||
      ["R11", "R12", "R13", "R16", "T2A"].includes(curMc) ||
      all.some(p => String(p.panel_no || p.panelNo || "").toUpperCase() === "METERAN" || p.inputType === "METER");

    if (sortedPcsKeys.length === 0) return;
    // Card Ringkasan Waktu Operasional Mesin (Waktu Jalan vs Downtime)
    const statsHtml = buildOperationalStatsCardHtml(all, curPot);
    if (statsHtml) {
      const statsWrapper = document.createElement("div");
      statsWrapper.innerHTML = statsHtml;
      if (statsWrapper.firstElementChild) {
        container.appendChild(statsWrapper.firstElementChild);
      }
    }


    if (isMeterReport) {
      // Horizontal Scroll Multi-PCS Row persis ContinuousHistoryDrawer.tsx
      const scrollWrapper = document.createElement("div");
      scrollWrapper.className = "history-multi-pcs-wrapper";

      const rowWrapper = document.createElement("div");
      rowWrapper.className = "history-multi-pcs-row";

      sortedPcsKeys.forEach((pcsKey) => {
        // SORT ASCENDING CHRONOLOGICALLY PER PCS
        const panels = pcsGroups[pcsKey].sort((a, b) => {
          return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
        });

        const pcsCard = document.createElement("div");
        pcsCard.className = "history-pcs-card-meter";

        const pcsHeaderTitle = "RIWAYAT INPUT METERAN";

        pcsCard.innerHTML = `
          <div class="history-pcs-header-meter">${pcsHeaderTitle}</div>
          <div class="history-table-wrapper">
            ${buildMeterTableHtml(panels, parseInt(pcsKey, 10))}
          </div>
        `;
        rowWrapper.appendChild(pcsCard);
      });

      scrollWrapper.appendChild(rowWrapper);
      container.appendChild(scrollWrapper);

      // Section Laporan Downtime Khusus (1:1 Gambar 4)
      if (specialDowntimePanels && specialDowntimePanels.length > 0) {
        const dtSection = document.createElement("div");
        dtSection.className = "history-special-downtime-container";
        dtSection.innerHTML = buildSpecialDowntimeHtml(specialDowntimePanels);
        container.appendChild(dtSection);
      }
    } else {
      // Panel Mode
      for (const pcsKey of sortedPcsKeys) {
        const panels = pcsGroups[pcsKey];
        const card = document.createElement("div");
        card.className = "history-pcs-card";
        card.innerHTML = `<div class="history-pcs-header">PCS ${pcsKey}</div>`;

        const tableWrapper = document.createElement("div");
        tableWrapper.className = "history-table-wrapper";
        tableWrapper.innerHTML = buildPanelTableHtml(panels, parseInt(pcsKey, 10));

        card.appendChild(tableWrapper);
        container.appendChild(card);
      }
    }
  }

  /**
   * 1:1 Implementation of MeterHistoryTable.tsx
   * Handles START, FINISH, Defect Points, Gagal Cacat, Downtime, and Shift Total calculations
   */
  function buildMeterTableHtml(panels, pcsKeyNum) {
    const pcsKey = String(pcsKeyNum);

    // 1. Ekstrak detailsToDisplay untuk PCS ini (1:1 MeterHistoryTable.tsx lines 82-153)
    const detailsToDisplay = [];
    panels.forEach((p) => {
      const details = p.production_details || [];
      if (details.length === 0) {
        let dtEvents = [];
        try {
          dtEvents = typeof p.downtime_events === 'string' ? JSON.parse(p.downtime_events) : (p.downtime_events || []);
        } catch (e) {}

        const matchedEvents = dtEvents.filter((e) => {
          if (!e.pcsKe || e.pcsKe === "Semua") return true;
          if (Array.isArray(e.pcsKe)) {
            return e.pcsKe.length === 0 || e.pcsKe.map((x) => String(x).trim()).includes(pcsKey);
          }
          return String(e.pcsKe).split(",").map((x) => x.trim()).includes(pcsKey);
        });

        const problemsForThisPcs = [];
        matchedEvents.forEach((e, evIdx) => {
          if (e.problems && Array.isArray(e.problems)) {
            e.problems.forEach((prob, probIdx) => {
              let meterVal = "";
              if (prob.meter) {
                const match = prob.meter.match(new RegExp(`PCS\\s*${pcsKey}:\\s*([^,]+)`, "i"));
                if (match) meterVal = match[1].trim();
                else if (!prob.meter.includes("PCS")) meterVal = prob.meter.trim();
              }
              const detailText = Array.isArray(prob.details) ? prob.details.join(", ") : (prob.details || "");
              const probUniqueId = prob.id || `dtevent::${p.id}::${e.id || evIdx}::${probIdx}`;
              problemsForThisPcs.push({
                id: probUniqueId,
                raw_prob_id: prob.id || null,
                event_id: e.id || null,
                prob_idx: probIdx,
                header_id: p.id,
                kategori_masalah: prob.kategori || e.kategori || "A",
                detail_masalah: detailText + (meterVal ? ` (Titik: ${meterVal}m)` : ""),
                keterangan_cacat: prob.blok ? `Blok ${prob.blok}` : null,
                meter_kain: meterVal || null,
                durasi_detik: e.durasiDetik || e.duration || 0,
              });
            });
          }
        });

        if (problemsForThisPcs.length > 0) {
          problemsForThisPcs.forEach((prob) => {
            detailsToDisplay.push({
              ...prob,
              production_headers: p,
              final_inspection_id: p.final_inspection_id || 1,
            });
          });
        } else {
          detailsToDisplay.push({
            production_headers: p,
            final_inspection_id: p.final_inspection_id || 1,
          });
        }
      } else {
        details.forEach((d) => {
          detailsToDisplay.push({
            ...d,
            production_headers: p,
            final_inspection_id: d.final_inspection_id ?? p.final_inspection_id ?? 1,
          });
        });
      }
    });

    // 2. Filter detailsToDisplay (1:1 MeterHistoryTable.tsx lines 155-191)
    const filtered = detailsToDisplay.filter((item) => {
      const h = item.production_headers || {};
      let hasRealDefects = false;
      if (item.production_defects && Array.isArray(item.production_defects)) {
        item.production_defects.forEach((d) => {
          const k = (d.kategori || "").toUpperCase();
          const det = (d.detail || "").toUpperCase();
          if (!k.includes("ISTIRAHAT") && !det.includes("ISTIRAHAT")) {
            hasRealDefects = true;
          }
        });
      }
      if (!item.production_defects || item.production_defects.length === 0) {
        if (item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) {
          hasRealDefects = true;
        }
      }
      const hasIstirahatRaw = Boolean(
        (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.detail_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.keterangan_cacat || "").toUpperCase().includes("MASUK") || 
        (item.detail_masalah || "").toUpperCase().includes("MASUK") || 
        (item.detail_masalah || "").toUpperCase().includes("OPLOS SHIFT") || 
        (item.detail_masalah || "").toUpperCase().includes("GANTI OPERATOR") ||
        (h.jenis_laporan || "").toUpperCase().includes("ISTIRAHAT") ||
        (h.jenis_laporan || "").toUpperCase().includes("MASUK")
      );
      const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
      const isIstirahat = hasIstirahat && (!item.kategori_masalah || item.kategori_masalah === "G" || (item.detail_masalah && item.detail_masalah.toUpperCase().includes("GAGAL CACAT")));

      if (!isIstirahat) return true;
      const hasMeter = (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") ||
                       (h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "") ||
                       (h.meter_awal !== null && h.meter_awal !== undefined && String(h.meter_awal).trim() !== "");
      return hasMeter;
    });

    // 3. Mapping processed items (1:1 MeterHistoryTable.tsx lines 193-245)
    const processed = filtered.map((item) => {
      const h = item.production_headers || {};
      const opr = h.operators?.nama_operator || h.operatorName || h.pic || h.created_by_name || "-";
      const grp = h.groups?.nama_grup || h.grupName || h.group_id || "A";
      const tgl = h.tgl || (h.tanggal_jam ? h.tanggal_jam.split("T")[0] : "-");
      const rawJam = h.tanggal_jam || h.created_at || item.tanggal_jam || item.created_at || "";
      const jamStr = rawJam ? formatWibTime(rawJam) : "-";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;

      let hasRealDefectsMap = false;
      if (item.production_defects && Array.isArray(item.production_defects)) {
        item.production_defects.forEach((d) => {
          const k = (d.kategori || "").toUpperCase();
          const det = (d.detail || "").toUpperCase();
          if (!k.includes("ISTIRAHAT") && !det.includes("ISTIRAHAT")) {
            hasRealDefectsMap = true;
          }
        });
      }
      if (!item.production_defects || item.production_defects.length === 0) {
        if (item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) {
          hasRealDefectsMap = true;
        }
      }
      const hasIstirahatRaw = Boolean(
        (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") ||
        (item.detail_masalah || "").toUpperCase().includes("ISTIRAHAT") ||
        (item.keterangan_cacat || "").toUpperCase().includes("MASUK") || 
        (item.detail_masalah || "").toUpperCase().includes("MASUK") ||
        (item.detail_masalah || "").toUpperCase().includes("OPLOS SHIFT") ||
        (item.detail_masalah || "").toUpperCase().includes("GANTI OPERATOR") ||
        (h.jenis_laporan || "").toUpperCase().includes("ISTIRAHAT") ||
        (h.jenis_laporan || "").toUpperCase().includes("MASUK")
      );
      const hasIstirahat = hasIstirahatRaw && !hasRealDefectsMap;
      const isIstirahat = hasIstirahat && !item.kategori_masalah && !item.detail_masalah;
      
      const isFinish = !hasIstirahat && (item.keterangan_cacat === "FINISH" || item.panel_no === "FINISH" || (h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== ""));
      const isStart = item.keterangan_cacat === "START" || item.panel_no === "START";
      const isGradable = !hasIstirahat && !isFinish && !isStart;

      return {
        item,
        isIstirahat,
        isGradable,
        opr,
        grp,
        tgl,
        jamStr,
        rawJam,
        operatorStr,
        hasIstirahat,
        hasIstirahatRaw,
        backupOp: h.operator_backup || item.operatorBackup || null,
      };
    });

    const getMeterNumericVal = (p) => {
      const { item, hasIstirahat } = p;
      const h = item.production_headers || {};
      const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";

      let defectMeterStr = "";
      if (item.production_defects && Array.isArray(item.production_defects)) {
        for (const defect of item.production_defects) {
          if (defect.meter) {
            defectMeterStr = defect.meter;
            break;
          }
        }
      }

      let meterDisplay = "-";
      if (hasIstirahat || isFinishReport) {
        if (h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "") {
          meterDisplay = cleanMeterVal(h.meter_akhir);
        } else if (h.meter_awal !== null && h.meter_awal !== undefined && String(h.meter_awal).trim() !== "") {
          meterDisplay = cleanMeterVal(h.meter_awal);
        } else if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
          meterDisplay = cleanMeterVal(item.meter_kain);
        }
      } else {
        if (item.detail_masalah) {
          const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
          if (meterMatch && meterMatch[1] && meterMatch[1].includes("-")) {
            meterDisplay = cleanMeterVal(meterMatch[1]);
          }
        }
        if (meterDisplay === "-") {
          if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
            meterDisplay = cleanMeterVal(item.meter_kain);
          } else if (defectMeterStr) {
            meterDisplay = cleanMeterVal(defectMeterStr);
          } else if (item.detail_masalah) {
            const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
            if (meterMatch && meterMatch[1]) {
              meterDisplay = cleanMeterVal(meterMatch[1]);
            }
          }
        }

        if (meterDisplay === "-") {
          if (h.meter_akhir || h.meter_awal) {
            meterDisplay = cleanMeterVal(h.meter_akhir || h.meter_awal);
          }
        }
      }

      const clean = cleanMeterVal(meterDisplay);
      const firstPart = clean.split("-")[0].trim();
      const num = parseFloat(firstPart);
      return isNaN(num) ? 0 : num;
    };

    // 4. Kelompokkan per Shift Operator (1:1 MeterHistoryTable.tsx lines 305-360)
    const shiftGroups = [];
    processed.forEach((p) => {
      const currentShift = shiftGroups[shiftGroups.length - 1];
      if (!currentShift || currentShift.operatorStr !== p.operatorStr) {
        shiftGroups.push({
          operatorStr: p.operatorStr,
          items: [p],
        });
      } else {
        currentShift.items.push(p);
      }
    });

    shiftGroups.forEach((sg) => {
      sg.items.sort((a, b) => {
        const mA = getMeterNumericVal(a);
        const mB = getMeterNumericVal(b);
        if (mA !== mB) return mA - mB;
        const rawJamA = String(a.rawJam || a.item.created_at || "");
        const rawJamB = String(b.rawJam || b.item.created_at || "");
        return rawJamA.localeCompare(rawJamB);
      });

      let istirahatSeqInShift = 0;
      sg.items.forEach((p) => {
        if (p.hasIstirahat) {
          const ket = (p.item.keterangan_cacat || "").toUpperCase();
          const det = (p.item.detail_masalah || "").toUpperCase();
          const isExplicitSebelum = ket.includes("SEBELUM ISTIRAHAT") || det.includes("SEBELUM ISTIRAHAT") || ket.includes("MULAI ISTIRAHAT") || det.includes("MULAI ISTIRAHAT");
          const isExplicitLaporan = ket.includes("LAPORAN ISTIRAHAT") || det.includes("LAPORAN ISTIRAHAT") || ket.includes("SELESAI ISTIRAHAT") || det.includes("SELESAI ISTIRAHAT") || ket.includes("[MASUK]") || det.includes("[MASUK]");

          let isMasuk = false;
          if (isExplicitLaporan) {
            isMasuk = true;
          } else if (isExplicitSebelum) {
            isMasuk = false;
          } else {
            isMasuk = istirahatSeqInShift % 2 === 1;
          }

          p.isMasuk = isMasuk;
          p.isMulaiIstirahat = !isMasuk;
          istirahatSeqInShift++;
        } else {
          p.isMasuk = false;
          p.isMulaiIstirahat = false;
        }
      });
    });

    const sortedProcessed = shiftGroups.flatMap((sg) => sg.items);

    // 5. Susun Baris-baris Riwayat Lengkap (1:1 MeterHistoryTable.tsx lines 364-980)
    const items = [];
    let currentOpStartMeter = null;
    let currentOpLastMeter = null;
    let prevOperatorLastMeter = null;
    let globalRowCount = 0;
    let isSameAsPrev = false;
    let lastOprString = "";

    sortedProcessed.forEach((p, idx) => {
      const { item, isIstirahat, isGradable, opr, grp, tgl, jamStr, operatorStr, hasIstirahat, backupOp } = p;
      const h = item.production_headers || {};

      let cacatLines = [];
      let defectMeterStr = "";
      
      const katsRaw = item.kategori_masalah;
      const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : String(katsRaw).split(",").map(s => s.trim())) : [];
      
      if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
        const groupedMap = new Map();
        const orderList = [];

        item.production_defects.forEach((defect) => {
          if ((defect.kategori || "").toUpperCase().includes("ISTIRAHAT") || (defect.detail || "").toUpperCase().includes("ISTIRAHAT")) return;
          const k = defect.kategori || "";
          const rawDet = defect.detail || "";
          
          const splitDetails = (rawDet.includes(",") || rawDet.includes("\n"))
            ? rawDet.split(/,|\n/).map(s => s.replace(/^\d+[\.\-]\s*/, "").trim()).filter(Boolean)
            : [rawDet];

          splitDetails.forEach((det) => {
            const key = k && det ? `${k} - ${det}` : (k || det);
            if (!key) return;

            if (!groupedMap.has(key)) {
              groupedMap.set(key, new Set());
              orderList.push(key);
            }

            if (defect.blok) {
              const cleanB = String(defect.blok).replace(/blok\s*/gi, "").trim();
              if (cleanB) {
                cleanB.split(",").forEach((bStr) => {
                  const trimmed = bStr.trim();
                  if (trimmed) groupedMap.get(key).add(trimmed);
                });
              }
            }
          });

          if (defect.meter) defectMeterStr = defect.meter;
        });

        cacatLines = orderList.map((key) => {
          const blocks = Array.from(groupedMap.get(key) || []);
          if (blocks.length > 0) {
            return `${key} (Blok ${blocks.join(", ")})`;
          }
          return key;
        });

        let ketCacat = item.keterangan_cacat || "";
        const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
        if (hasTambahanQC) {
          if (cacatLines.length === 0) cacatLines.push("[TAMBAHAN QC]");
          else cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
        }
      } else {
        let cleanD = item.detail_masalah 
          ? String(item.detail_masalah).replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").replace(/\|\s*$/, "").replace(/,\s*$/, "").trim()
          : "";

        if (kats.length > 0 && cleanD) {
          const dets = (cleanD.includes(",") || cleanD.includes("\n"))
            ? cleanD.split(/,|\n/).map(s => s.replace(/^\d+[\.\-]\s*/, "").trim()).filter(Boolean)
            : [cleanD];
          dets.forEach((d) => {
            cacatLines.push(d);
          });
        } else if (cleanD) {
          cacatLines.push(cleanD);
        } else if (kats.length > 0) {
          cacatLines.push(kats.join(", "));
        }

        let ketCacat = item.keterangan_cacat || "";
        const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
        ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
        ketCacat = ketCacat.replace(/\[?MASUK\]?/gi, "").trim();
        ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
        ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");

        if (ketCacat.toUpperCase() === "START" || ketCacat.toUpperCase() === "FINISH" || ketCacat.toUpperCase() === "MASUK") {
          ketCacat = "";
        }

        if (ketCacat) {
          const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
          const cleanBLower = cleanB.toLowerCase();
          const isNotBlock = cleanBLower.includes("start") ||
            cleanBLower.includes("finish") ||
            cleanBLower.includes("backup") ||
            cleanBLower.includes("istirahat") ||
            cleanBLower.includes("masuk") ||
            cleanBLower.includes("gagal") ||
            cleanBLower.includes("cacat") ||
            cleanBLower.includes("normal") ||
            cleanBLower.includes("panel") ||
            cleanB === "()" ||
            cleanB === "-";

          if (cleanB && !isNotBlock) {
            if (cacatLines.length > 0) {
              cacatLines = cacatLines.map(line => line.includes("(Blok") ? line : `${line} (Blok ${cleanB})`);
            } else {
              cacatLines.push(`(Blok ${cleanB})`);
            }
          }
        }

        if (hasTambahanQC) {
          if (cacatLines.length === 0) cacatLines.push("[TAMBAHAN QC]");
          else cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
        }
      }

      const isFinishReport = !hasIstirahat && h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
      const isStartRow = item.keterangan_cacat === "START" || (!item.kategori_masalah && !item.detail_masalah && item.meter_kain === 0 && !isIstirahat);

      let meterDisplay = "-";
      if (hasIstirahat || isFinishReport) {
        if (h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "") {
          meterDisplay = cleanMeterVal(h.meter_akhir);
        } else if (h.meter_awal !== null && h.meter_awal !== undefined && String(h.meter_awal).trim() !== "") {
          meterDisplay = cleanMeterVal(h.meter_awal);
        } else if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
          meterDisplay = cleanMeterVal(item.meter_kain);
        } else if (defectMeterStr) {
          meterDisplay = cleanMeterVal(defectMeterStr);
        }
      } else {
        if (item.detail_masalah) {
          const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
          if (meterMatch && meterMatch[1] && meterMatch[1].includes("-")) {
            meterDisplay = cleanMeterVal(meterMatch[1]);
          }
        }
        if (meterDisplay === "-") {
          if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
            meterDisplay = cleanMeterVal(item.meter_kain);
          } else if (defectMeterStr) {
            meterDisplay = cleanMeterVal(defectMeterStr);
          } else if (item.detail_masalah) {
            const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
            if (meterMatch && meterMatch[1]) {
              meterDisplay = cleanMeterVal(meterMatch[1]);
            }
          }
        }

        if (meterDisplay === "-") {
          if (h.meter_akhir || h.meter_awal) {
            meterDisplay = cleanMeterVal(h.meter_akhir || h.meter_awal);
          }
        }
      }

      if (idx === 0) {
        lastOprString = operatorStr;
      }

      // Pergantian Operator -> Tambahkan Baris FINISH (jika ada) dan Subtotal Produksi
      if (operatorStr !== lastOprString && items.length > 0) {
        const [prevGrp, prevOpr] = lastOprString.includes(") ") 
          ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
          : ["", lastOprString];

        const prevOpItems = items.filter((it) => !it.isTotalRow && it.oprStr === prevOpr);
        const hasFinish = prevOpItems.some((it) => it.cacatDisplay === "FINISH");
        const prevItem = sortedProcessed[idx - 1];
        const lastOpHeader = prevItem?.item?.production_headers;

        if (!hasFinish && lastOpHeader?.meter_akhir && !prevItem?.hasIstirahat) {
          items.push({
            id: `finish-${lastOprString}-${Math.random()}`,
            isStartRow: false,
            isMeter: true,
            displayNo: (globalRowCount + 1).toString(),
            tglStr: prevItem?.tgl || "-",
            jamStr: prevItem?.jamStr || "-",
            grpStr: prevGrp,
            oprStr: prevOpr,
            meterDisplay: cleanMeterVal(lastOpHeader.meter_akhir),
            cacatDisplay: "FINISH",
            backupOpName: "",
            isGradable: false,
            showTgl: false,
            showGrp: false,
            showOpr: false,
            hasErrorDetail: false,
            isIstirahat: false,
            hasIstirahat: false,
            downtimeDisplay: "-",
          });
          globalRowCount += 1;
        }

        const totalMeter = currentOpLastMeter !== null && currentOpStartMeter !== null
          ? Math.abs(currentOpLastMeter - currentOpStartMeter)
          : null;

        items.push({
          id: `total-${lastOprString}-${Math.random()}`,
          isTotalRow: true,
          totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
          totalMeter: totalMeter !== null ? `${totalMeter} Meter` : "-",
        });
        prevOperatorLastMeter = currentOpLastMeter;
        currentOpStartMeter = null;
        currentOpLastMeter = null;
        lastOprString = operatorStr;
        isSameAsPrev = false;
      } else if (items.length > 0) {
        isSameAsPrev = true;
      }

      // Baris START Operator
      if (!isSameAsPrev) {
        const startTglStr = h.tgl || "-";
        const startMeter = prevOperatorLastMeter !== null
          ? String(prevOperatorLastMeter)
          : (h.meter_awal !== undefined && h.meter_awal !== null ? cleanMeterVal(h.meter_awal) : "0");

        items.push({
          id: `start-${idx}-${Math.random()}`,
          isStartRow: true,
          isMeter: true,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: startTglStr,
          jamStr,
          grpStr: grp,
          oprStr: opr,
          meterDisplay: startMeter,
          cacatDisplay: "START",
          isGradable: false,
          showTgl: true,
          showGrp: true,
          showOpr: true,
          hasErrorDetail: false,
          downtimeDisplay: "-",
        });
        globalRowCount += 1;
        const startMeterVal = parseFloat(cleanMeterVal(startMeter));
        if (!isNaN(startMeterVal)) {
          if (currentOpStartMeter === null) currentOpStartMeter = startMeterVal;
          currentOpLastMeter = startMeterVal;
        }
        isSameAsPrev = true;
      }

      const meterVal = parseFloat(meterDisplay);
      if (!isNaN(meterVal)) {
        if (currentOpStartMeter === null) currentOpStartMeter = meterVal;
        currentOpLastMeter = meterVal;
      }

      let showTgl = true;
      let showGrp = true;
      let showOpr = true;

      let prevTgl = "";
      let prevGrp = "";
      let prevActualOprStr = "-";
      for (let k = items.length - 1; k >= 0; k--) {
        const pItem = items[k];
        if (!pItem.isTotalRow) {
          if (!prevTgl) prevTgl = pItem.tglStr;
          if (!prevGrp) prevGrp = pItem.grpStr;
          if (prevActualOprStr === "-") prevActualOprStr = pItem.oprStr || "-";
          if (prevTgl && prevGrp && prevActualOprStr !== "-") break;
        }
      }

      const cleanedCacatLines = formatDefectLinesWithNumbering(
        cacatLines
          .map((line) => line.replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim())
          .filter(Boolean)
      );

      const isLastItemOfThisOp = sortedProcessed.slice(idx + 1).every((nextItem) => {
        const nextOpr = nextItem.opr || (nextItem.item?.production_headers?.pic || "").trim();
        return nextOpr !== opr;
      });

      const isLastItemOfTable = idx === sortedProcessed.length - 1;
      const isIstirahatFinish = hasIstirahat && isFinishReport && (isLastItemOfThisOp || isLastItemOfTable);
      const isTrueFinish = isFinishReport && !hasIstirahat && (isLastItemOfThisOp || isLastItemOfTable);

      let cacatText = isStartRow 
        ? "START" 
        : (cleanedCacatLines.length > 0 ? cleanedCacatLines.join("\n") : (isTrueFinish ? "FINISH" : "-"));

      let backupOpName = "";
      if (backupOp) {
        backupOpName = backupOp;
      } else if (h.operator_backup) {
        backupOpName = h.operator_backup;
      } else if (hasIstirahat) {
        const searchStr = `${h.operator_backup || ""} ${h.pic || ""} ${h.jenis_laporan || ""} ${item.keterangan_cacat || ""} ${item.detail_masalah || ""}`;
        const match = searchStr.match(/Backup:\s*([^)\],]+)/i);
        if (match && match[1]) {
          backupOpName = match[1].trim();
        }
      }

      if (opr === prevActualOprStr) showOpr = false;
      if (tgl === prevTgl) showTgl = false;
      if (grp === prevGrp && !showOpr) showGrp = false;

      const hasErrorDetail = !!item.kategori_masalah || !!item.detail_masalah;

      // Hitung Downtime (1:1 MeterHistoryTable.tsx lines 763-855)
      let downtimeDisplay = "-";
      if (!isStartRow && !isIstirahat) {
        let dtEvents = [];
        try {
          if (h.downtime_events) {
            dtEvents = typeof h.downtime_events === 'string'
              ? JSON.parse(h.downtime_events)
              : h.downtime_events;
          }
        } catch (e) { }

        let totalDowntimeSecs = 0;

        if (dtEvents && dtEvents.length > 0) {
          const detailDefects = item.production_defects || [];
          const metersInThisRow = new Set();

          detailDefects.forEach((d) => {
            if (d.meter) metersInThisRow.add(cleanMeterVal(d.meter));
          });
          if (defectMeterStr) metersInThisRow.add(cleanMeterVal(defectMeterStr));
          if (meterDisplay && meterDisplay !== "-") {
            metersInThisRow.add(cleanMeterVal(meterDisplay));
          }

          if (metersInThisRow.size > 0) {
            dtEvents.forEach((e) => {
              if (!e.problems || !Array.isArray(e.problems)) return;
              const hasMatch = e.problems.some((prob) => {
                const rawMeter = prob?.meter || e?.meter;
                if (!rawMeter) return false;

                if (metersInThisRow.has(cleanMeterVal(rawMeter))) return true;

                if (String(rawMeter).includes("PCS")) {
                  const pcsMatch = String(rawMeter).match(new RegExp(`PCS\\s*${pcsKey}:\\s*([^,]+)`, "i"));
                  if (pcsMatch && metersInThisRow.has(cleanMeterVal(pcsMatch[1]))) {
                    return true;
                  }
                }

                const meterTokens = String(rawMeter).split(",").map((s) => cleanMeterVal(s));
                if (meterTokens.some((token) => metersInThisRow.has(token))) {
                  return true;
                }

                return false;
              });
              if (hasMatch) {
                totalDowntimeSecs += parseInt(e.durasiDetik || e.duration || 0, 10) || 0;
              }
            });
          }

          if (totalDowntimeSecs === 0) {
            const firstActiveIdx = sortedProcessed.findIndex((pp) => {
              const ppH = pp.item.production_headers || {};
              return ppH.id === h.id && !pp.isIstirahat;
            });
            if (idx === firstActiveIdx) {
              const matchedEventsForPcs = dtEvents.filter(
                (e) =>
                  !e.pcsKe ||
                  e.pcsKe === "Semua" ||
                  String(e.pcsKe).split(",").map((x) => x.trim()).includes(pcsKey)
              );
              totalDowntimeSecs = (matchedEventsForPcs.length > 0 ? matchedEventsForPcs : dtEvents).reduce(
                (acc, e) => acc + (parseInt(e.durasiDetik || e.duration || 0, 10) || 0),
                0
              );
            }
          }
        }

        // Fallback dari total_downtime_detik header jika durasi masih 0
        if (totalDowntimeSecs === 0 && h.total_downtime_detik) {
          const firstActiveIdx = sortedProcessed.findIndex((pp) => {
            const ppH = pp.item.production_headers || {};
            return ppH.id === h.id && !pp.isIstirahat;
          });
          if (idx === firstActiveIdx) {
            totalDowntimeSecs = parseInt(h.total_downtime_detik, 10) || 0;
          }
        }

        if (totalDowntimeSecs > 0) {
          const mins = Math.floor(totalDowntimeSecs / 60);
          const secs = totalDowntimeSecs % 60;
          downtimeDisplay = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        }
      }

      const isPlaceholder = meterDisplay === "-" && !hasErrorDetail && !isIstirahat && !isFinishReport && !isStartRow;

      const isDuplicateFinish = (cacatText === "FINISH") && items.some(
        (it) => !it.isTotalRow && it.oprStr === opr && it.cacatDisplay === "FINISH"
      );

      if (!isPlaceholder && !isDuplicateFinish) {
        items.push({
          ...item,
          id: item.id || `item-${idx}-${Math.random()}`,
          isStartRow: false,
          isMeter: true,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: tgl,
          jamStr,
          grpStr: grp,
          oprStr: opr,
          meterDisplay,
          cacatDisplay: cacatText,
          backupOpName,
          isGradable,
          showTgl,
          showGrp,
          showOpr,
          hasErrorDetail,
          isIstirahat,
          hasIstirahat,
          hasIstirahatRaw: Boolean(p.hasIstirahatRaw),
          isMasuk: Boolean(p.isMasuk),
          isMulaiIstirahat: Boolean(p.isMulaiIstirahat),
          isIstirahatFinish,
          isLastItemOfTable,
          downtimeDisplay,
          isLocalQueue: Boolean(item.isLocalQueue || h.isLocalQueue),
        });
        globalRowCount += 1;

        if (isFinishReport && !hasIstirahat && cleanedCacatLines.length > 0 && (isLastItemOfThisOp || isLastItemOfTable)) {
          const isDup = items.some(
            (it) => !it.isTotalRow && it.oprStr === opr && it.cacatDisplay === "FINISH"
          );
          if (!isDup) {
            items.push({
              id: `finish-${item.id || idx}-${Math.random()}`,
              isStartRow: false,
              isMeter: true,
              displayNo: (globalRowCount + 1).toString(),
              tglStr: tgl,
              jamStr,
              grpStr: grp,
              oprStr: opr,
              meterDisplay: cleanMeterVal(h.meter_akhir),
              cacatDisplay: "FINISH",
              backupOpName: "",
              isGradable: false,
              showTgl: false,
              showGrp: false,
              showOpr: false,
              hasErrorDetail: false,
              isIstirahat: false,
              hasIstirahat: false,
              downtimeDisplay: "-",
            });
            globalRowCount += 1;
          }
        }
      }
    });

    if (items.length > 0 && currentOpStartMeter !== null && currentOpLastMeter !== null) {
      const [lastGrp, lastOprOnly] = lastOprString.includes(") ") 
        ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
        : ["", lastOprString];

      const currentOpItems = items.filter((it) => !it.isTotalRow && it.oprStr === lastOprOnly);
      const hasFinish = currentOpItems.some((it) => it.cacatDisplay === "FINISH");
      const lastItem = sortedProcessed[sortedProcessed.length - 1];
      const lastOpHeader = lastItem?.item?.production_headers;

      if (!hasFinish && lastOpHeader?.meter_akhir && !lastItem?.hasIstirahat) {
        items.push({
          id: `finish-last-${lastOprString}-${Math.random()}`,
          isStartRow: false,
          isMeter: true,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: lastItem?.tgl || "-",
          jamStr: lastItem?.jamStr || "-",
          grpStr: lastGrp,
          oprStr: lastOprOnly,
          meterDisplay: cleanMeterVal(lastOpHeader.meter_akhir),
          cacatDisplay: "FINISH",
          backupOpName: "",
          isGradable: false,
          showTgl: false,
          showGrp: false,
          showOpr: false,
          hasErrorDetail: false,
          isIstirahat: false,
          hasIstirahat: false,
          downtimeDisplay: "-",
        });
        globalRowCount += 1;
      }

      const totalMeter = Math.abs(currentOpLastMeter - currentOpStartMeter);
      items.push({
        id: `total-last-${lastOprString}-${Math.random()}`,
        isTotalRow: true,
        totalLabel: `Total Produksi${lastGrp ? ` (${lastGrp})` : ""} ${lastOprOnly}:`,
        totalMeter: `${totalMeter} Meter`,
      });
    }

    // 6. Generate Table HTML (10 Kolom 1:1 MeterHistoryTable.tsx)
    let rowsHtml = "";

    items.forEach((item) => {
      if (item.isTotalRow) {
        rowsHtml += `
          <tr class="row-total-operator" style="background:#f1f5f9; border-top:2px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">
            <td colspan="10" style="padding:8px 12px; text-align:center; font-size:11px; font-weight:700; color:#475569;">
              ${item.totalLabel} <span style="font-weight:900; color:#0f172a; font-size:12px; margin-left:4px;">${item.totalMeter}</span>
            </td>
          </tr>
        `;
        return;
      }

      if (item.isStartRow) {
        rowsHtml += `
          <tr style="transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <td style="padding:6px 8px; font-weight:800; color:#0f172a; text-align:center; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              ${item.displayNo}
            </td>
            <td style="padding:6px 8px; color:#475569; white-space:nowrap; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              ${item.tglStr}
            </td>
            <td style="padding:6px 8px; color:#475569; text-align:center; font-family:monospace; font-size:11px; font-weight:700; white-space:nowrap; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              ${item.jamStr || "-"}
            </td>
            <td style="padding:6px 8px; font-weight:800; color:#334155; text-align:center; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              ${item.grpStr}
            </td>
            <td style="padding:6px 8px; font-weight:700; color:#1e293b; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              ${item.oprStr}
            </td>
            <td style="padding:6px 8px; text-align:center; font-weight:800; color:#0f172a; font-size:12px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              ${item.meterDisplay}
            </td>
            <td style="padding:6px 8px; text-align:center; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;"></td>
            <td style="padding:6px 10px; font-size:11px; font-weight:600; color:#94a3b8; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              START
            </td>
            <td style="padding:6px 8px; text-align:center; font-size:11px; color:#94a3b8; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
              -
            </td>
            <td style="padding:6px 8px; text-align:center; border-b:1px solid #f1f5f9;">
              <span style="color:#0284c7; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Edit Start Meter" onclick="DJIHistory.editMeterRow('${item.meterDisplay}', '${item.oprStr}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </span>
            </td>
          </tr>
        `;
        return;
      }

      // Baris Reguler: Defect, Normal, Istirahat, Finish
      let hasRealError = false;
      if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
        hasRealError = item.production_defects.some((d) => {
          const k = (d.kategori || "").toUpperCase().trim();
          const det = (d.detail || "").toUpperCase().trim();
          if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
          if (det.includes("GAGAL CACAT") || k === "G") return false;
          return true;
        });
      } else {
        const katStr = (item.kategori_masalah || "").toUpperCase().trim();
        const detStr = (item.detail_masalah || "").toUpperCase().trim();
        if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT") && !katStr.includes("GAGAL CACAT")) {
          hasRealError = true;
        }
        if (detStr && !detStr.includes("ISTIRAHAT") && !detStr.includes("START") && !detStr.includes("FINISH") && !detStr.includes("GAGAL CACAT")) {
          hasRealError = true;
        }
      }
      if ((item.keterangan_cacat || "").includes("[TAMBAHAN QC]") || item.hasTambahanQC) {
        hasRealError = true;
      }
      if (!hasRealError && item.cacatDisplay && item.cacatDisplay !== "-" && item.cacatDisplay !== "START" && item.cacatDisplay !== "FINISH" && !item.hasIstirahat) {
        const upper = item.cacatDisplay.toUpperCase();
        if (!upper.includes("GAGAL CACAT") && !upper.includes("ISTIRAHAT")) {
          hasRealError = true;
        }
      }

      const isGagalCacatOnly = (
        (item.detail_masalah || "").toUpperCase().includes("GAGAL CACAT") ||
        (item.keterangan_cacat || "").toUpperCase().includes("GAGAL CACAT") ||
        (item.kategori_masalah || "").toUpperCase() === "G" ||
        (item.cacatDisplay && item.cacatDisplay.toUpperCase().includes("GAGAL CACAT"))
      ) && !hasRealError;

      const isRowQcModified = item.hasTambahanQC || Boolean(item.keterangan_cacat?.includes("[TAMBAHAN QC]") || item.keterangan_cacat?.includes("+ QC"));

      let rowBgStyle = "background:transparent;";
      if (isRowQcModified) rowBgStyle = "background:rgba(224, 242, 254, 0.6);";
      else if (item.isMasuk) rowBgStyle = "background:rgba(236, 253, 245, 0.45);";
      else if (item.hasIstirahat) rowBgStyle = "background:rgba(254, 243, 199, 0.45);";
      else if (item.isLocalQueue) rowBgStyle = "background:#fffbeb;";

      const cacatRawLines = (item.cacatDisplay && item.cacatDisplay !== "-")
        ? item.cacatDisplay.split("\n").map((l) => l.trim()).filter(Boolean)
        : [];

      const parsedCacatItems = cacatRawLines.map((line) => {
        const isLineQc = line.includes("[QC]") || line.includes("[TAMBAHAN QC]") || line.includes("[TAMBAHAN MENDING]") || item.hasTambahanQC;
        const cleanText = line
          .replace(/\[QC\]/gi, "")
          .replace(/\[TAMBAHAN QC\]/gi, "")
          .replace(/\[TAMBAHAN MENDING\]/gi, "")
          .replace(/^([A-Z0-9]\s*[-.]\s*|\d+\.\s*|\d+-\s*)/i, "")
          .trim();
        return { isLineQc, text: cleanText };
      }).filter((c) => c.text.length > 0 && c.text !== "-");

      // Format Icon KET ✓/X (1:1 MeterHistoryTable.tsx lines 1259-1268)
      let ketIconHtml = "";
      if (!item.isStartRow && item.cacatDisplay !== "START" && !item.hasIstirahat && item.cacatDisplay !== "ISTIRAHAT" && item.cacatDisplay !== "FINISH" && !item.cacatDisplay?.toUpperCase().includes("FINISH")) {
        if (hasRealError || isRowQcModified) {
          ketIconHtml = `
            <span style="color:#e11d48; font-weight:900; font-size:14px; display:inline-flex; align-items:center; justify-content:center;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </span>
          `;
        } else {
          ketIconHtml = `
            <span style="color:#10b981; font-weight:900; font-size:14px; display:inline-flex; align-items:center; justify-content:center;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            </span>
          `;
        }
      }

      // Keterangan Cacat Cell (1:1 MeterHistoryTable.tsx lines 1270-1312)
      let ketCacatContent = "";
      if (item.hasIstirahat || item.hasIstirahatRaw) {
        if (item.isMasuk) {
          ketCacatContent = '<span style="color:#94a3b8;">-</span>';
        } else if (item.backupOpName && item.backupOpName.trim().toLowerCase() !== (item.oprStr || "").trim().toLowerCase()) {
          ketCacatContent = `<span style="color:#334155; font-weight:700;">${item.backupOpName}</span>`;
        } else if (item.showOpr) {
          ketCacatContent = '<span style="color:#334155; font-weight:700;">ISTIRAHAT</span>';
        } else {
          ketCacatContent = `<span style="color:#334155; font-weight:700;">${item.backupOpName || "-"}</span>`;
        }
        if (item.isIstirahatFinish) {
          ketCacatContent += ' <span style="font-size:9px; font-weight:900; background:#dcfce7; color:#166534; padding:1px 5px; border-radius:4px; border:1px solid #bbf7d0;">FINISH</span>';
        }
      } else if (parsedCacatItems.length > 0) {
        ketCacatContent = `
          <div style="display:flex; flex-direction:column; gap:2px;">
            ${parsedCacatItems.map((cItem, i) => {
              const numPrefix = parsedCacatItems.length > 1 ? `${i + 1}. ` : "";
              let color = "#e11d48";
              let fw = "600";
              if (cItem.text.toUpperCase() === "FINISH") {
                color = "#0f172a";
                fw = "800";
              } else if (cItem.isLineQc) {
                color = "#0070bc";
                fw = "700";
              } else if (isGagalCacatOnly) {
                color = "#475569";
                fw = "500";
              }
              return `<div style="color:${color}; font-weight:${fw}; line-height:1.3;">${numPrefix}${cItem.text}</div>`;
            }).join("")}
          </div>
        `;
      } else {
        ketCacatContent = '<span style="color:#94a3b8;">-</span>';
      }

      rowsHtml += `
        <tr style="${rowBgStyle} transition:background 0.15s;" onmouseover="this.style.filter='brightness(0.97)'" onmouseout="this.style.filter='none'">
          <td style="padding:6px 8px; font-weight:800; color:#0f172a; text-align:center; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <span>${item.displayNo}</span>
              ${isRowQcModified ? '<span style="font-size:8px; font-weight:900; background:#e0f2fe; color:#0070bc; padding:1px 4px; border-radius:3px; margin-top:2px; border:1px solid #bae6fd;">+ QC</span>' : ''}
              ${item.isLocalQueue ? '<span class="badge-local-queue" style="font-size:7.5px; padding:1px 3px; margin:2px 0 0 0;" title="Menunggu sinkronisasi">ANTREAN HP</span>' : ''}
            </div>
          </td>
          <td style="padding:6px 8px; color:#475569; white-space:nowrap; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${item.showTgl ? item.tglStr : ""}
          </td>
          <td style="padding:6px 8px; color:#475569; text-align:center; font-family:monospace; font-size:11px; font-weight:700; white-space:nowrap; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${item.jamStr || "-"}
          </td>
          <td style="padding:6px 8px; font-weight:800; color:#334155; text-align:center; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${item.showGrp ? item.grpStr : ""}
          </td>
          <td style="padding:6px 8px; font-weight:700; color:#1e293b; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${item.showOpr ? item.oprStr : (item.hasIstirahat ? (item.isMasuk ? '<span style="color:#047857; font-weight:700; font-style:italic;">Masuk</span>' : '<span style="color:#b45309; font-weight:700; font-style:italic;">Istirahat</span>') : '')}
          </td>
          <td style="padding:6px 8px; text-align:center; font-weight:800; color:#0f172a; font-size:12px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${item.meterDisplay}
          </td>
          <td style="padding:6px 8px; text-align:center; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${ketIconHtml}
          </td>
          <td style="padding:6px 10px; font-size:11px; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${ketCacatContent}
          </td>
          <td style="padding:6px 8px; text-align:center; font-size:11px; font-weight:700; border-r:1px solid #f1f5f9; border-b:1px solid #f1f5f9;">
            ${item.downtimeDisplay && item.downtimeDisplay !== "-" 
              ? `<span style="color:#e11d48; font-weight:800; font-size:11px; white-space:nowrap;">${item.downtimeDisplay}</span>` 
              : '<span style="color:#94a3b8;">-</span>'}
          </td>
          <td style="padding:6px 8px; text-align:center; border-b:1px solid #f1f5f9;">
            <span style="color:#0284c7; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Edit Meter" onclick="DJIHistory.editMeterRow('${item.meterDisplay}', '${item.oprStr}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </span>
          </td>
        </tr>
      `;
    });

    return `
      <table class="table-history-exact table-meter-exact">
        <thead>
          <tr>
            <th style="width:34px; text-align:center;">NO</th>
            <th style="width:82px;">TGL</th>
            <th style="width:58px; text-align:center;">JAM</th>
            <th style="width:44px; text-align:center;">GROUP</th>
            <th style="width:100px;">OPERATOR</th>
            <th style="width:54px; text-align:center;">METER</th>
            <th style="width:54px; text-align:center;">KET ✓/X</th>
            <th style="min-width:240px;">KETERANGAN CACAT</th>
            <th style="width:70px; text-align:center;">DOWNTIME</th>
            <th style="width:48px; text-align:center;">AKSI</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  /**
   * Section Laporan Downtime Khusus (1:1 Gambar 4 & History Detail)
   */
  function buildSpecialDowntimeHtml(panels) {
    if (!panels || panels.length === 0) return "";

    let rowsHtml = "";
    panels.forEach((p) => {
      const timeStr = formatTime(p.tanggal_jam || p.timestamp);
      const dateStr = formatDate(p.tgl || p.tanggal_jam || p.timestamp);
      const pic = p.operators?.nama_operator || p.operatorName || p.pic || p.created_by_name || "Mekanik";
      const initial = (pic.charAt(0) || "M").toUpperCase();
      const shift = p.shift || p.groups?.nama_grup || p.grupName || "A";
      const panelNo = p.panel_no || p.panelNo || "Panel Downtime Mekanik (Direct)";

      let durasiSec = p.total_downtime_detik || 0;
      let katStr = "F";
      let detailStr = "";

      const dtEvents = parseDowntimeEvents(p.downtime_events);
      if (dtEvents.length > 0) {
        durasiSec = dtEvents.reduce((acc, ev) => acc + (ev.duration || ev.durasiDetik || ev.durasi_detik || 0), 0);
        const ev0 = dtEvents[0] || {};
        katStr = ev0.kategori || ev0.category || "F";
        detailStr = ev0.alasan || ev0.detailMasalah || ev0.detail || ev0.description || (ev0.problems && ev0.problems[0]?.details?.join(", ")) || "";
      } else {
        detailStr = p.keteranganCacat || p.detailMasalah || "Mesin Berhenti Total";
      }

      let durasiDisplay = "-";
      if (durasiSec > 0) {
        const hours = Math.floor(durasiSec / 3600);
        const mins = Math.floor((durasiSec % 3600) / 60);
        if (hours > 0 && mins > 0) durasiDisplay = `${hours} Jam ${mins} Mnt`;
        else if (hours > 0) durasiDisplay = `${hours} Jam`;
        else if (mins > 0) durasiDisplay = `${mins} Mnt`;
        else durasiDisplay = `${durasiSec} Dtk`;
      }

      rowsHtml += `
        <div class="special-dt-row">
          <div class="special-dt-time-col">
            <div class="special-dt-dot"></div>
            <div>
              ${dateStr && dateStr !== "-" ? `<span class="special-dt-date">${dateStr}</span>` : ""}
              <span class="special-dt-time">${timeStr}</span>
            </div>
          </div>
          <div class="special-dt-pic-col">
            <div class="special-dt-avatar">${initial}</div>
            <div>
              <div class="special-dt-pic-name">${pic}</div>
              <div class="special-dt-pic-role">Penanggung Jawab</div>
            </div>
          </div>
          <div class="special-dt-badges-col">
            <span class="badge-shift">${shift}</span>
            <span class="badge-panel-direct">${panelNo}</span>
          </div>
          <div class="special-dt-right-col">
            <div class="special-dt-duration-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${durasiDisplay}</span>
            </div>
            <div class="special-dt-detail-box">
              <span class="badge-category">${katStr === "-" ? "Problem" : `Kategori ${katStr}`}</span>
              <span class="special-dt-desc" title="${detailStr}">${detailStr}</span>
            </div>
          </div>
        </div>
      `;
    });

    return `
      <div class="history-special-downtime-card">
        <div class="history-special-downtime-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="special-dt-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div>
              <h3 class="special-dt-title">Laporan Downtime Khusus</h3>
              <p class="special-dt-subtitle">Mesin berhenti total — tanpa produksi</p>
            </div>
          </div>
          <div class="special-dt-count-badge">${panels.length} laporan</div>
        </div>
        <div class="history-special-downtime-body">
          ${rowsHtml}
        </div>
      </div>
    `;
  }

  function buildPanelTableHtml(rawItems, pcsIndex) {
    const flatItems = [];
    rawItems.forEach(item => {
      const pNo = String(item.panel_no || item.panelNo || "").trim();
      if (pNo === "Downtime Mekanik (Direct)" || pNo === "BERHENTI" || pNo.toLowerCase().includes("downtime mekanik")) {
        return;
      }
      if (item.pcs === 0 || item.pcs === "0") return;

      const prodDetails = parseProductionDetails(item.production_details);
      const matchedDetails = prodDetails.filter(d => (d.pcs_index ? parseInt(d.pcs_index, 10) : 1) === pcsIndex);
      if (matchedDetails.length === 0) {
        flatItems.push({
          ...item,
          firstDet: prodDetails[0] || {
            jml_hasil_produksi: (item.isPanelBs || item.isBs) ? 0 : 1,
            detail_masalah: item.keteranganCacat || item.detailMasalah || null,
            kategori_masalah: item.kategoriMasalah || null,
            keterangan_cacat: item.jenisLaporan || (item.isPanelBs ? "Panel BS" : "NORMAL"),
            production_defects: []
          }
        });
      } else {
        matchedDetails.forEach(d => {
          flatItems.push({
            ...item,
            firstDet: d
          });
        });
      }
    });

    const sorted = [...flatItems].sort((a, b) => {
      const pAStr = String(a.panel_no || a.panelNo || "").trim().toUpperCase();
      const pBStr = String(b.panel_no || b.panelNo || "").trim().toUpperCase();

      const isAwalA = pAStr.includes("AWAL");
      const isAwalB = pBStr.includes("AWAL");
      if (isAwalA && !isAwalB) return -1;
      if (!isAwalA && isAwalB) return 1;

      const isAkhirA = pAStr.includes("AKHIR");
      const isAkhirB = pBStr.includes("AKHIR");
      if (isAkhirA && !isAkhirB) return 1;
      if (!isAkhirA && isAkhirB) return -1;

      const numA = parseInt(pAStr.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(pBStr.replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;

      return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
    });

    const panelCounts = {};
    sorted.forEach(it => {
      const pNo = String(it.panel_no || it.panelNo || "").trim().toUpperCase();
      if (!pNo.includes("AWAL") && !pNo.includes("AKHIR")) {
        const clean = pNo.replace(/\s*\((BS|GAGAL)\)/gi, "").trim();
        if (clean && clean !== "-") {
          panelCounts[clean] = (panelCounts[clean] || 0) + 1;
        }
      }
    });

    let html = `
      <table class="table-history-exact">
        <thead>
          <tr>
            <th style="width: 52px; text-align: center;">PNL</th>
            <th style="width: 85px;">TGL</th>
            <th style="width: 60px; text-align: center;">JAM</th>
            <th style="width: 50px; text-align: center;">GROUP</th>
            <th style="width: 130px;">OPERATOR</th>
            <th style="width: 65px; text-align: center;">KET ✓/X</th>
            <th style="min-width: 200px;">KETERANGAN CACAT</th>
            <th style="width: 85px; text-align: center;">DOWNTIME</th>
            <th style="width: 50px; text-align: center;">AKSI</th>
          </tr>
        </thead>
        <tbody>
    `;

    let lastOpr = "";
    let lastTgl = "";
    let currentOpCount = 0;

    sorted.forEach((item, idx) => {
      const panelNo = String(item.panel_no || item.panelNo || "-").trim();
      const oprName = item.operators?.nama_operator || item.operatorName || item.pic || "-";
      const grpLetter = item.groups?.nama_grup || item.grupName || item.group_id || "A";
      const dateStr = formatDate(item.tgl || item.tanggal_jam);
      const timeStr = formatTime(item.tanggal_jam);
      const firstDet = item.firstDet || {};

      const isBsAwal = panelNo.toUpperCase().includes("AWAL");
      const isBsAkhir = panelNo.toUpperCase().includes("AKHIR");
      const cleanPanelNo = panelNo.replace(/\s*\((BS|GAGAL)\)/gi, "").trim();
      const isDouble = !isBsAwal && !isBsAkhir && (panelCounts[cleanPanelNo] || 0) > 1;

      const isBs = Boolean(isBsAwal || isBsAkhir || item.isPanelBs || item.isBs || firstDet.is_bs || firstDet.jml_hasil_produksi === 0 || panelNo.includes("BS"));
      const isDeleted = Boolean(firstDet.status_inspeksi === "Dihapus" || (firstDet.keterangan_cacat || "").includes("[DIHAPUS]"));

      if (!isBs && !isDeleted) {
        currentOpCount += 1;
      }

      let showTgl = false;
      let showGrp = false;
      let showOpr = false;

      if (idx === 0) {
        showTgl = true;
        showGrp = true;
        showOpr = true;
      } else {
        if (oprName !== lastOpr) {
          showTgl = true;
          showGrp = true;
          showOpr = true;
        } else if (dateStr !== lastTgl) {
          showTgl = true;
        }
      }

      const isIstirahat = (item.jenisLaporan || firstDet.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT");
      let dispOperator = showOpr ? oprName : "";
      if (isIstirahat && !showOpr) {
        dispOperator = `<span style="color:#d97706; font-weight:800; font-style:italic;">Istirahat</span>`;
      }

      let pnlDisplay = cleanPanelNo;
      if (isBsAwal) {
        pnlDisplay = `<span style="font-size: 9px; font-weight: 900; background: #e11d48; color: #ffffff; padding: 2px 6px; border-radius: 4px; white-space: nowrap; letter-spacing: 0.02em;">BS AWAL</span>`;
      } else if (isBsAkhir) {
        pnlDisplay = `<span style="font-size: 9px; font-weight: 900; background: #e11d48; color: #ffffff; padding: 2px 6px; border-radius: 4px; white-space: nowrap; letter-spacing: 0.02em;">BS AKHIR</span>`;
      } else {
        let subBadges = [];
        if (isDouble) {
          subBadges.push(`<span class="badge-double-history">DOUBLE</span>`);
        }
        if (panelNo.includes("(BS)") || firstDet.jml_hasil_produksi === 0) {
          subBadges.push(`<span style="font-size: 9px; font-weight: 900; background: #fee2e2; color: #dc2626; padding: 1px 4px; border-radius: 3px; border: 1px solid #fca5a5;">BS</span>`);
        }
        const isQcTambahan = (firstDet.keterangan_cacat || "").includes("+ QC") || (firstDet.keterangan_cacat || "").includes("[TAMBAHAN QC]");
        if (isQcTambahan) {
          subBadges.push(`<span style="font-size: 8px; font-weight: 900; background: #e0f2fe; color: #0070bc; padding: 1px 4px; border-radius: 3px; border: 1px solid #bae6fd;">+ QC</span>`);
        }
        pnlDisplay = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <span>${cleanPanelNo}</span>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 2px;">
              ${subBadges.join("")}
            </div>
          </div>
        `;
      }

      let hasRealError = false;
      if (isBsAwal || isBsAkhir || (firstDet.jml_hasil_produksi === 0) || panelNo.includes("BS")) {
        hasRealError = true;
      } else if (firstDet.production_defects && Array.isArray(firstDet.production_defects) && firstDet.production_defects.length > 0) {
        hasRealError = firstDet.production_defects.some(d => {
          const k = (d.kategori || "").toUpperCase().trim();
          const det = (d.detail || "").toUpperCase().trim();
          if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
          if (det.includes("GAGAL CACAT") || k === "G") return false;
          return true;
        });
      } else {
        const katStr = (firstDet.kategori_masalah || "").toUpperCase().trim();
        const detStr = (firstDet.detail_masalah || "").toUpperCase().trim();
        if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT") && !katStr.includes("GAGAL CACAT")) {
          hasRealError = true;
        }
        if (detStr && !detStr.includes("ISTIRAHAT") && !detStr.includes("START") && !detStr.includes("FINISH") && !detStr.includes("GAGAL CACAT")) {
          hasRealError = true;
        }
      }

      let ketIconHtml = "";
      if (isBsAwal || isBsAkhir || hasRealError) {
        ketIconHtml = `<span style="color: #e11d48; font-weight: 900; font-size: 14px;">X</span>`;
      } else {
        ketIconHtml = `<span class="badge-check-ok">✓</span>`;
      }

      let cacatTexts = [];
      if (isIstirahat) {
        const backupOp = item.operator_backup || item.operatorBackup || "";
        if (backupOp) {
          cacatTexts.push(`<div style="color:#78350f; font-weight:700;">👤 Backup: ${backupOp}</div>`);
        }
      }

      if (isBsAwal) {
        cacatTexts.push(`<span style="color: #e11d48; font-weight: 700;">Sisa Awal Potongan</span>`);
      } else if (isBsAkhir) {
        cacatTexts.push(`<span style="color: #e11d48; font-weight: 700;">Sisa Akhir Potongan</span>`);
      } else {
        let lines = [];
        if (firstDet.production_defects && Array.isArray(firstDet.production_defects) && firstDet.production_defects.length > 0) {
          const groupedMap = new Map();
          const orderList = [];

          firstDet.production_defects.forEach((d) => {
            if ((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT")) return;
            const k = d.kategori || "";
            const rawDet = d.detail || "";
            
            const splitDetails = (rawDet.includes(",") || rawDet.includes("\n"))
              ? rawDet.split(/,|\n/).map(s => s.replace(/^\d+[\.\-]\s*/, "").trim()).filter(Boolean)
              : [rawDet];

            splitDetails.forEach((det) => {
              const key = k && det ? `${k} - ${det}` : (k || det);
              if (!key) return;

              if (!groupedMap.has(key)) {
                groupedMap.set(key, new Set());
                orderList.push(key);
              }

              if (d.blok) {
                const cleanB = String(d.blok).replace(/blok\s*/gi, "").trim();
                if (cleanB) {
                  cleanB.split(",").forEach((bStr) => {
                    const trimmed = bStr.trim();
                    if (trimmed) groupedMap.get(key).add(trimmed);
                  });
                }
              }
            });
          });

          lines = orderList.map((key) => {
            const blocks = Array.from(groupedMap.get(key) || []);
            if (blocks.length > 0) {
              return `${key} (Blok ${blocks.join(", ")})`;
            }
            return key;
          });

          let ketCacat = firstDet.keterangan_cacat || "";
          const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
          if (hasTambahanQC) {
            if (lines.length === 0) lines.push("[TAMBAHAN QC]");
            else lines = lines.map(line => line + " [TAMBAHAN QC]");
          }
        } else {
          const rawDet = firstDet.detail_masalah || "";
          const rawKet = firstDet.keterangan_cacat || "";
          if (rawDet) {
            let line = rawDet;
            if (rawKet && !rawKet.toUpperCase().includes("NORMAL") && !rawKet.toUpperCase().includes("ISTIRAHAT")) {
              const cleanBlok = rawKet.replace(/blok\s*/gi, "").trim();
              if (cleanBlok && !line.match(/\(Blok/i)) {
                line += ` (Blok ${cleanBlok})`;
              }
            }
            lines.push(line);
          } else if (rawKet && !rawKet.toUpperCase().includes("NORMAL") && !rawKet.toUpperCase().includes("ISTIRAHAT")) {
            lines.push(rawKet);
          }
        }

        // Format dengan penomoran berurutan & pembersihan kode huruf kategori (misal: "1. Gagal Cacat", "2. L1 Putus (Blok 15)")
        const numberedLines = formatDefectLinesWithNumbering(lines);

        numberedLines.forEach(l => {
          const isQcTambahan = l.includes("+ QC") || l.includes("[TAMBAHAN QC]");
          const color = isQcTambahan ? "#0070bc" : (hasRealError ? "#e11d48" : "#475569");
          cacatTexts.push(`<span style="color:${color}; font-weight:${hasRealError ? '700' : '600'};">${l}</span>`);
        });
      }

      let ketCacatHtml = cacatTexts.length > 0 ? cacatTexts.join("<br/>") : `<span style="color: #94a3b8;">-</span>`;

      let dtMinutes = `<span style="color: #94a3b8;">-</span>`;
      const dtEvts = parseDowntimeEvents(item.downtime_events);
      if (dtEvts.length > 0) {
        const totalSec = dtEvts.reduce((acc, ev) => acc + (ev.duration || ev.durasiDetik || ev.durasi_detik || 0), 0);
        if (totalSec > 0) {
          const mins = Math.floor(totalSec / 60);
          const secs = totalSec % 60;
          let dtStr = "";
          if (mins > 0 && secs > 0) dtStr = `${mins}m ${secs}s`;
          else if (mins > 0) dtStr = `${mins}m`;
          else dtStr = `${secs}s`;
          dtMinutes = `<span style="color: #e11d48; font-weight: 800; font-size: 11px; white-space: nowrap;">${dtStr}</span>`;
        }
      }

      let aksiHtml = `<span style="color: #94a3b8;">-</span>`;
      if (!isBsAwal && !isBsAkhir) {
        aksiHtml = `<span style="color: #0284c7; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="Edit" onclick="DJIHistory.editPanel('${panelNo}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </span>`;
      }

      const rowClass = item.isLocalQueue ? "row-local-queue" : "";

      html += `
        <tr class="${rowClass}">
          <td style="text-align: center; font-weight: 800; color: #0f172a;">
            ${pnlDisplay}
            ${item.isLocalQueue ? `<span class="badge-local-queue" title="Tersimpan lokal di HP, menunggu sinkron">ANTREAN HP</span>` : ''}
          </td>
          <td style="white-space: nowrap; color: #64748b;">${showTgl ? dateStr : ''}</td>
          <td style="text-align: center; font-mono; font-size: 11px; font-weight: 700; color: #475569;">${timeStr}</td>
          <td style="text-align: center; font-weight: 800; color: #334155;">${showGrp ? grpLetter : ''}</td>
          <td style="font-weight: 700; color: #1e293b;">${dispOperator}</td>
          <td style="text-align: center;">
            ${ketIconHtml}
          </td>
          <td>${ketCacatHtml}</td>
          <td style="text-align: center;">${dtMinutes}</td>
          <td style="text-align: center;">${aksiHtml}</td>
        </tr>
      `;

      lastOpr = oprName;
      lastTgl = dateStr;

      const nextItem = sorted[idx + 1];
      const nextOpr = nextItem ? (nextItem.operators?.nama_operator || nextItem.operatorName || nextItem.pic || "-") : null;

      if (nextOpr !== oprName) {
        if (currentOpCount > 0) {
          html += `
            <tr class="row-total-operator">
              <td colspan="5" style="text-align: right; padding: 8px 12px; font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase;">
                Total Produksi (${grpLetter}) ${oprName}:
              </td>
              <td style="text-align: center; font-weight: 900; font-size: 13px; color: #0f172a;">${currentOpCount}</td>
              <td colspan="3"></td>
            </tr>
          `;
        }
        currentOpCount = 0;
      }
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  }

  async function openHistoryDrawer() {
    const drawer = document.getElementById("modalHistory");
    if (drawer) {
      drawer.classList.add("show");
      try { document.body.style.overflow = "hidden"; } catch (e) {}
    }

    renderHistoryDrawer();

    if (navigator.onLine) {
      await fetchServerHistory(false);
      renderHistoryDrawer();
    }
  }

  function closeHistoryDrawer() {
    const drawer = document.getElementById("modalHistory");
    if (drawer) {
      drawer.classList.remove("show");
      try { document.body.style.overflow = ""; } catch (e) {}
    }
  }

  function editPanel(panelNo) {
    closeHistoryDrawer();
    const inpP = document.getElementById("inpPanelNo");
    if (inpP) {
      const cleanNo = String(panelNo).replace(/\D/g, "") || panelNo;
      inpP.value = cleanNo;
      inpP.scrollIntoView({ behavior: "smooth", block: "center" });
      inpP.focus();
    }
  }

  function editMeterRow(meterDisplay, oprName) {
    closeHistoryDrawer();
    const modal = document.getElementById("modalLaporanMeter");
    if (modal && window.openMeterModal) {
      window.openMeterModal();
    }
  }

  window.DJIHistory = {
    openHistoryDrawer,
    closeHistoryDrawer,
    refreshHistory,
    toggleFilterMc,
    toggleFilterPot,
    editPanel,
    editMeterRow,
    fetchServerHistory,
    setLastFetchedData: (data) => { lastFetchedData = data; },
  };
  /**
   * Kalkulasi Waktu Jalan Mesin (Net Running Time):
   * (Waktu Input Terakhir - Waktu Input Awal) - Total Downtime
   */
  function buildOperationalStatsCardHtml(allPanels, potonganKe) {
    if (!allPanels || allPanels.length === 0) return "";

    const validPanels = allPanels.filter(p => p.tanggal_jam || p.created_at || p.tgl);
    if (validPanels.length === 0) return "";

    const sorted = [...validPanels].sort((a, b) => {
      const tA = new Date(a.tanggal_jam || a.created_at || a.tgl).getTime();
      const tB = new Date(b.tanggal_jam || b.created_at || b.tgl).getTime();
      return tA - tB;
    });

    const firstPanel = sorted[0];
    const lastPanel = sorted[sorted.length - 1];

    const startTime = new Date(firstPanel.tanggal_jam || firstPanel.created_at || firstPanel.tgl);
    const endTime = new Date(lastPanel.tanggal_jam || lastPanel.created_at || lastPanel.tgl);
    const grossSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

    let downtimeSeconds = 0;
    const seenHeaders = new Set();
    sorted.forEach((p) => {
      const hId = String(p.id || p.header_id || "");
      if (hId && seenHeaders.has(hId)) return;
      if (hId) seenHeaders.add(hId);

      let dtEvts = [];
      try {
        dtEvts = typeof p.downtime_events === "string" ? JSON.parse(p.downtime_events) : (p.downtime_events || []);
      } catch (e) {
        dtEvts = [];
      }
      if (Array.isArray(dtEvts)) {
        dtEvts.forEach((ev) => {
          downtimeSeconds += (Number(ev.duration || ev.durasiDetik || ev.durasi_detik) || 0);
        });
      }
    });

    const runningSeconds = Math.max(0, grossSeconds - downtimeSeconds);
    const productivityRate = grossSeconds > 0
      ? Math.min(100, Math.round((runningSeconds / grossSeconds) * 100))
      : 100;

    const formatTimeOnly = (d) => {
      try {
        return new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(d).replace(".", ":");
      } catch (e) {
        return "-";
      }
    };

    const formatDurationClean = (sec) => {
      if (sec <= 0) return "0 dtk";
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return m > 0 ? `${h} Jam ${m} Mnt` : `${h} Jam`;
      if (m > 0) return s > 0 ? `${m} Mnt ${s} Dtk` : `${m} Mnt`;
      return `${s} Dtk`;
    };

    const startTimeStr = formatTimeOnly(startTime);
    const endTimeStr = formatTimeOnly(endTime);
    const hasMultiplePanels = sorted.length > 1 && grossSeconds > 0;
    const firstPnlNo = firstPanel.panel_no || "Awal";
    const lastPnlNo = lastPanel.panel_no || "Akhir";

    return `
      <div class="history-operational-stats-card" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:12px;">
        <!-- 1. Waktu Jalan Mesin -->
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:8px 12px; display:flex; flex-direction:column; justify-content:center; gap:2px; min-width:0;">
          <span style="font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; color:#166534; display:flex; align-items:center; gap:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <span style="width:6px; height:6px; border-radius:999px; background:#22c55e; flex-shrink:0;"></span>
            <span>WAKTU JALAN MESIN</span>
          </span>
          <span style="font-size:13px; font-weight:900; color:#15803d; font-family:monospace; letter-spacing:-0.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${hasMultiplePanels ? formatDurationClean(runningSeconds) : "0 dtk"}
          </span>
        </div>

        <!-- 2. Total Downtime -->
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:8px 12px; display:flex; flex-direction:column; justify-content:center; gap:2px; min-width:0;">
          <span style="font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; color:#92400e; display:flex; align-items:center; gap:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <span style="width:6px; height:6px; border-radius:999px; background:#f59e0b; flex-shrink:0;"></span>
            <span>TOTAL DOWNTIME</span>
          </span>
          <span style="font-size:13px; font-weight:900; color:#b45309; font-family:monospace; letter-spacing:-0.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${formatDurationClean(downtimeSeconds)}
          </span>
        </div>

        <!-- 3. Total Rentang Waktu -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:8px 12px; display:flex; flex-direction:column; justify-content:center; gap:2px; min-width:0;">
          <span style="font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; color:#475569; display:flex; align-items:center; gap:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>TOTAL RENTANG WAKTU</span>
          </span>
          <span style="font-size:13px; font-weight:900; color:#1e293b; font-family:monospace; letter-spacing:-0.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${(hasMultiplePanels && grossSeconds > 0) ? formatDurationClean(grossSeconds) : `0 Mnt (Mulai ${startTimeStr})`}
          </span>
        </div>
      </div>
    `;
  }

})(window);
