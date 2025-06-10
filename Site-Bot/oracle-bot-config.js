module.exports = {
  apps: [
    {
      name: "oracle-discord-bot",
      script: "./oracle-bot.js",
      env: {
        NODE_ENV: "production",
        PORT: 3030
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/oracle-bot-error.log",
      out_file: "./logs/oracle-bot-out.log",
      merge_logs: true,
      restart_delay: 5000,
      max_restarts: 10
    }
  ]
}; 