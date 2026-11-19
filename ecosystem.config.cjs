module.exports = {
  apps: [
    {
      name: "dji",
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 2, // 2 worker dalam cluster mode agar saat reload tidak ada jeda mati (zero downtime)
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Pengaturan Graceful Reload (Zero Downtime)
      kill_timeout: 5000, // Waktu tunggu 5 detik untuk menyelesaikan koneksi lama sebelum worker lama di-kill
      listen_timeout: 20000, // Waktu tunggu hingga 20 detik bagi worker baru untuk siap menerima koneksi
      restart_delay: 1000,
    },
  ],
};
