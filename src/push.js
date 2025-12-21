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

async function sendNotify(title, message) {
  const webhook = resolveWebhook();
  const content = title ? `${title}\n${message || ""}` : (message || "");
  const payload = {
    msgtype: "text",
    text: {
      content
    }
  };
  try {
    await got.post(webhook, { json: payload, responseType: "json" });
  } catch (err) {
    console.log("DingTalk push failed", err.message || err);
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
  const [,, cliTitle, ...rest] = process.argv;
  const body = rest.join(" ");
  sendNotify(cliTitle || "test push", body || "Hello from push.js").then(() => {
    console.log("DingTalk push sent");
  }).catch(err => {
    console.error("DingTalk push failed", err.message || err);
    process.exit(1);
  });
}
