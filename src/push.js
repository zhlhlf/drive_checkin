// DingTalk push notification module
// by zhlhlf

const got = require("got");
const crypto = require("crypto");
require("dotenv").config();

function buildWebhook(token) {
  return token.startsWith("http") ? token : `https://oapi.dingtalk.com/robot/send?access_token=${token}`;
}

function resolveWebhook() {
  const token = process.env.DINGTALK_TOKEN || process.env.dingtalk_token || process.env.TOKEN_FALLBACK;
  const secret = process.env.DINGTALK_SECRET || process.env.dingtalk_secret || process.env.SECRET_FALLBACK;
  if (!token) {
    throw new Error("DingTalk token is missing. Set DINGTALK_TOKEN.");
  }
  const base = buildWebhook(token);
  if (!secret) return base;

  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = crypto
    .createHmac("sha256", secret)
    .update(stringToSign)
    .digest("base64");
  const encodedSign = encodeURIComponent(sign);
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}timestamp=${timestamp}&sign=${encodedSign}`;
}

function buildPayload(title, message, msgType) {
  const safeTitle = title || "通知";
  const body = message || "";

  if (msgType === "markdown") {
    // DingTalk markdown supports a subset of Markdown; keep it simple
    const text = title ? `**${title}**\n\n${body}` : body;
    return {
      msgtype: "markdown",
      markdown: {
        title: safeTitle,
        text: text || safeTitle
      }
    };
  }

  return {
    msgtype: "text",
    text: {
      content: title ? `${title}\n${body}` : body
    }
  };
}

async function sendNotify(title, message, options = {}) {
  const webhook = resolveWebhook();
  const msgType = (options.msgType || process.env.DINGTALK_MSGTYPE || "markdown").toLowerCase();
  const payload = buildPayload(title, message, msgType);
  a = await got.post(webhook, { json: payload, responseType: "json" });
  if (a.body.errmsg != 'ok') {
    throw new Error("DingTalk push fail response: " + a.body.errmsg);
  }
}

// Keep backward compatibility with the old `push` export
const push = sendNotify;

module.exports = {
  sendNotify,
  push
};

// Allow direct execution: node push.js "Title" "Message body"
if (require.main === module) {
  const [, , cliTitle, ...rest] = process.argv;
  let body = rest.join(" ");
  sendNotify(cliTitle || "test push", body || "test push --by zhlhlf").then(() => {
  }).catch(err => {
    console.error(err.message || err);
  });
}
