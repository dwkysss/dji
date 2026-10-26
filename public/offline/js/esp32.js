/**
 * ESP32 Local Wi-Fi WebSocket Client & Screen Wake Lock
 * Matches WifiDowntimeTrigger.tsx & wifi-context.tsx 1:1
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { showToast } = window.DJIConfig;
  const { appState } = window.DJIState;

  const DEFAULT_HOSTNAME = "192.168.1.171";
  const STORAGE_KEY = "wifi_esp32_target";

  // Standard machine mapping: Machine Code -> Channel (M1, M2, M3)
  const DEFAULT_MACHINE_ESP_MAP = {
    "R1": { host: "192.168.1.171", channel: "M1" },
    "R11": { host: "192.168.1.171", channel: "M2" },
    "R12": { host: "192.168.1.171", channel: "M3" },
    "R2": { host: "192.168.1.171", channel: "M1" },
    "R1C": { host: "192.168.1.171", channel: "M2" },
    "R2C": { host: "192.168.1.171", channel: "M3" },
    "R3B": { host: "192.168.1.171", channel: "M1" },
    "T1C": { host: "192.168.1.171", channel: "M1" },
    "T2A": { host: "192.168.1.171", channel: "M2" },
    "R16": { host: "192.168.1.171", channel: "M3" }
  };

  let socket = null;
  let connectionStatus = "terputus"; // "terputus" | "menghubungkan" | "terhubung"
  let targetHost = DEFAULT_HOSTNAME;
  let autoReconnectTimer = null;
  let reconnectAttempts = 0;
  let isManualDisconnect = false;

  // Sensor machine states
  let machineStatus = "UNKNOWN"; // "MATI" (berjalan normal) | "NYALA" (downtime aktif) | "UNKNOWN"

  // Screen Wake Lock
  let wakeLockSentinel = null;
  let isWakeLockActive = false;

  function getTargetHost() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && stored.trim() ? stored.trim() : DEFAULT_HOSTNAME;
    } catch (e) {
      return DEFAULT_HOSTNAME;
    }
  }

  function setTargetHost(newHost) {
    targetHost = (newHost || DEFAULT_HOSTNAME).trim();
    try {
      localStorage.setItem(STORAGE_KEY, targetHost);
    } catch (e) {}
  }

  function getCurrentMachineChannel() {
    const mc = (appState.selectedMc || "R1").trim().toUpperCase();
    const map = DEFAULT_MACHINE_ESP_MAP[mc] || { channel: "M1", host: DEFAULT_HOSTNAME };
    return map.channel || "M1";
  }

  /* ── Screen Wake Lock Management ── */
  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) {
      console.log("Screen Wake Lock API not supported in this browser.");
      return;
    }
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      isWakeLockActive = true;
      wakeLockSentinel.addEventListener("release", () => {
        isWakeLockActive = false;
        updateCardUI();
      });
      updateCardUI();
    } catch (err) {
      isWakeLockActive = false;
      updateCardUI();
    }
  }

  async function releaseWakeLock() {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch (e) {}
      wakeLockSentinel = null;
    }
    isWakeLockActive = false;
    updateCardUI();
  }

  function toggleWakeLock() {
    if (isWakeLockActive) {
      releaseWakeLock();
      showToast("Layar Standby: Layar akan mati mengikuti timeout perangkat.");
    } else {
      requestWakeLock();
      showToast("Layar ON: Layar tablet akan selalu menyala siaga.");
    }
  }

  // Re-acquire Wake Lock when tab becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (wakeLockSentinel !== null && document.visibilityState === "visible") {
      requestWakeLock();
    }
  });

  /* ── WebSocket Connection to ESP32 Local Wi-Fi ── */
  function connect(customHost) {
    if (customHost) setTargetHost(customHost);
    targetHost = getTargetHost();

    if (socket) {
      try { socket.close(); } catch (e) {}
      socket = null;
    }

    if (autoReconnectTimer) {
      clearTimeout(autoReconnectTimer);
      autoReconnectTimer = null;
    }

    isManualDisconnect = false;
    connectionStatus = "menghubungkan";
    updateCardUI();

    const wsUrl = `ws://${targetHost}:81`;
    console.log("[ESP32] Connecting to local WebSocket:", wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      socket = ws;

      ws.onopen = () => {
        connectionStatus = "terhubung";
        reconnectAttempts = 0;
        updateCardUI();
        console.log("[ESP32] Connected to ESP32 Wi-Fi:", targetHost);
        showToast(`ESP32 Terhubung (${targetHost})`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Format payload: {"machine": "M1", "status": "START"|"STOP", "duration": 12}
          handleIncomingEspMessage(data);
        } catch (err) {
          console.warn("[ESP32] Message parse error:", event.data);
        }
      };

      ws.onerror = () => {
        // Silent error
      };

      ws.onclose = () => {
        connectionStatus = "terputus";
        socket = null;
        updateCardUI();

        if (!isManualDisconnect && document.visibilityState === "visible") {
          reconnectAttempts++;
          const delay = reconnectAttempts <= 2 ? 3000 : (reconnectAttempts <= 5 ? 5000 : 10000);
          if (reconnectAttempts <= 10) {
            autoReconnectTimer = setTimeout(() => {
              if (connectionStatus === "terputus" && !isManualDisconnect) {
                connect();
              }
            }, delay);
          }
        }
      };
    } catch (err) {
      connectionStatus = "terputus";
      updateCardUI();
    }
  }

  function disconnect() {
    isManualDisconnect = true;
    if (autoReconnectTimer) {
      clearTimeout(autoReconnectTimer);
      autoReconnectTimer = null;
    }
    if (socket) {
      try { socket.close(); } catch (e) {}
      socket = null;
    }
    connectionStatus = "terputus";
    updateCardUI();
  }

  function handleIncomingEspMessage(data) {
    if (!data || !data.machine || !data.status) return;

    const currentChannel = getCurrentMachineChannel();
    if (data.machine !== currentChannel) {
      // Sinyal untuk channel mesin lain
      return;
    }

    const status = data.status; // "START" (mesin berhenti / downtime) atau "STOP" (mesin jalan kembali)
    const duration = typeof data.duration === "number" ? data.duration : undefined;

    if (status === "START") {
      machineStatus = "NYALA";
      updateCardUI();
      if (window.DJIDowntime && window.DJIDowntime.startDowntimeTimerFromEsp32) {
        window.DJIDowntime.startDowntimeTimerFromEsp32(duration);
      }
    } else if (status === "STOP") {
      machineStatus = "MATI";
      updateCardUI();
      if (window.DJIDowntime && window.DJIDowntime.stopAndSaveDowntimeFromEsp32) {
        window.DJIDowntime.stopAndSaveDowntimeFromEsp32(duration);
      }
    }
  }

  /* ── UI Rendering & Sync ── */
  function updateCardUI() {
    const mcCodeEl = document.getElementById("dispEsp32McCode");
    const channelEl = document.getElementById("dispEsp32Channel");
    const connBadge = document.getElementById("badgeEsp32Connection");
    const statusBadge = document.getElementById("badgeEsp32MachineStatus");
    const btnWake = document.getElementById("btnWakeLock");

    const mc = appState.selectedMc || "R1";
    const channel = getCurrentMachineChannel();

    if (mcCodeEl) mcCodeEl.textContent = `Mesin ${mc}`;
    if (channelEl) channelEl.textContent = channel;

    // Connection Badge
    if (connBadge) {
      if (connectionStatus === "terhubung") {
        connBadge.className = "pill-connected-green";
        connBadge.textContent = "Terhubung";
        connBadge.title = `Tersambung ke ${targetHost}:81`;
      } else if (connectionStatus === "menghubungkan") {
        connBadge.className = "pill-connecting-amber";
        connBadge.textContent = "Koneksi...";
        connBadge.title = `Sedang menghubungkan ke ${targetHost}:81...`;
      } else {
        connBadge.className = "pill-disconnected-rose";
        connBadge.textContent = "Terputus";
        connBadge.title = `Klik untuk menghubungkan ke ESP32 Wi-Fi (${targetHost})`;
      }
    }

    // Machine Status Badge
    if (statusBadge) {
      if (machineStatus === "NYALA") {
        statusBadge.className = "pill-active-downtime-rose";
        statusBadge.textContent = "Downtime Aktif";
      } else if (machineStatus === "MATI") {
        statusBadge.className = "pill-connected-green";
        statusBadge.textContent = "Mesin Berjalan";
      } else {
        statusBadge.className = connectionStatus === "terhubung" ? "pill-connected-green" : "pill-standby-gray";
        statusBadge.textContent = connectionStatus === "terhubung" ? "Mesin Berjalan" : "Standby";
      }
    }

    // Wake Lock Button
    if (btnWake) {
      if (isWakeLockActive) {
        btnWake.className = "pill-layar-amber";
        btnWake.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <span>Layar ON</span>
        `;
      } else {
        btnWake.className = "pill-layar-standby";
        btnWake.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <span>Layar Standby</span>
        `;
      }
    }
  }

  /* ── Settings Modal ── */
  function openSettingsModal() {
    const modal = document.getElementById("modalEsp32Settings");
    const inpIp = document.getElementById("inpEsp32HostIp");
    const chEl = document.getElementById("dispSettingsChannelInfo");
    if (inpIp) inpIp.value = getTargetHost();
    if (chEl) chEl.textContent = `${getCurrentMachineChannel()} (${appState.selectedMc || "R1"})`;
    if (modal) modal.classList.add("show");
  }

  function closeSettingsModal() {
    const modal = document.getElementById("modalEsp32Settings");
    if (modal) modal.classList.remove("show");
  }

  function saveSettings() {
    const inpIp = document.getElementById("inpEsp32HostIp");
    const newIp = inpIp ? inpIp.value.trim() : "";
    if (!newIp) {
      alert("IP Address ESP32 tidak boleh kosong!");
      return;
    }
    setTargetHost(newIp);
    closeSettingsModal();
    showToast(`Target IP ESP32 disimpan: ${newIp}. Menghubungkan ulang...`);
    connect(newIp);
  }

  /* ── Simulation Trigger (For Testing Without Physical Machine) ── */
  function simulateTrigger(status) {
    const currentChannel = getCurrentMachineChannel();
    handleIncomingEspMessage({
      machine: currentChannel,
      status: status,
      duration: status === "STOP" ? 15 : undefined
    });
    showToast(`Simulasi Sinyal ESP32 [${currentChannel}]: ${status === 'START' ? 'Mesin Berhenti (Downtime Mulai)' : 'Mesin Jalan Kembali'}`);
  }

  function init() {
    targetHost = getTargetHost();
    updateCardUI();

    // Auto-request wake lock by default (best practice on tablet production)
    requestWakeLock();

    // Auto-connect to local ESP32 IP
    connect();
  }

  window.DJIEsp32 = {
    init,
    connect,
    disconnect,
    reconnect: () => connect(),
    toggleWakeLock,
    updateCardUI,
    openSettingsModal,
    closeSettingsModal,
    saveSettings,
    simulateTrigger
  };
})(window);
