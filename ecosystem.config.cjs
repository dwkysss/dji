module.exports = {
  apps: [
    {
      name: "dji",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
