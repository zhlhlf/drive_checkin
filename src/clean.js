require("dotenv").config();
const recording = require("log4js/lib/appenders/recording");
const { CloudClient, FileTokenStore } = require("../sdk/index");
let { push } = require("./push");
const { logger } = require("./logger");

const startTime = Date.now();

const sleep = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const mask = (s, start, end) => {
  if (s == null) process.exit(0);
  return s.split("").fill("*", start, end).join("");
};

const fs = require("fs");
const path = require("path");

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const folderPath = path.join(process.cwd(), ".token");
ensureDirectoryExists(folderPath);

if (process.env.TYYS == null || process.env.TYYS == "") {
  logger.error("没有设置TYYS环境变量");
  process.exit(0);
}

const getRecycleCount = async (cloudClient, isfamily) => {
  const recycle = await cloudClient.listRecycleBinFiles(isfamily);
  return recycle.count ?? 0;
};

const main = async () => {
  let accounts = process.env.TYYS.trim().split(/[\n ]+/);

  for (let i = 0; i < accounts.length; i += 2) {
    const [userName, password] = accounts.slice(i, i + 2);
    const userNameInfo = mask(userName, 3, 7);
    const token = new FileTokenStore(`.token/${userName}.json`);

    try {
      await sleep(100);
      const cloudClient = new CloudClient({
        username: userName,
        password,
        token,
      });

      const familyBeforeCount = await getRecycleCount(cloudClient, true);
      const personalBeforeCount = await getRecycleCount(cloudClient, false);
      logger.log(
        ` - ${userNameInfo} 清理前：家庭回收站 ${familyBeforeCount} 个，个人回收站 ${personalBeforeCount} 个`
      );

      await cloudClient.cleanAllRecycle(true);
      await cloudClient.cleanAllRecycle(false);

      const familyAfterCount = await getRecycleCount(cloudClient, true);
      const personalAfterCount = await getRecycleCount(cloudClient, false);
      logger.log(
        ` - ${userNameInfo} 清理后：家庭回收站 ${familyAfterCount} 个，个人回收站 ${personalAfterCount} 个`
      );
    } catch (e) {
      logger.error(` - ${userNameInfo} ${e && e.message ? e.message : e}`);
      if (e.code === "ETIMEDOUT") throw e;
    } finally {
      logger.log("");
    }
  }
};

(async () => {
  try {
    await main();
  } finally {
    const durationMs = Date.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);
    logger.log(`**运行时间：${durationSec}s**`);
    logger.log("\n\n");
    const events = recording.replay();
    const content = events.map((e) => `${e.data.join("")}`).join("  \n");
    push("天翼云盘回收站清理任务", content);
  }
})();
