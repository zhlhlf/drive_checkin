
const log4js = require("log4js");
const logger = log4js.getLogger();

log4js.configure({
  appenders: {
    vcr: { type: "recording" },
    out: {
      type: "console",
      layout: {
        type: "pattern",
        pattern: "\u001b[32m%d{yyyy-MM-dd hh:mm:ss}\u001b[0m - %m",
      },
    },
  },
  categories: { default: { appenders: ["vcr", "out"], level: "info" } },
});

exports.logger = logger