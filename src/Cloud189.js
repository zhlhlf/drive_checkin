require("dotenv").config();
const recording = require("log4js/lib/appenders/recording");
const { CloudClient, FileTokenStore } = require("../sdk/index");
let { push } = require("./push");

const { logger } = require("./logger");

// Track start time for total runtime reporting
const startTime = Date.now();

const sleep = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const mask = (s, start, end) => {
  if (s == null) process.exit(0);
  return s.split("").fill("*", start, end).join("");
};

let timeout = 10000;

const doTask = async (cloudClient) => {
  let result = [];
  let signPromises1 = [];
  let getSpace = [`${firstSpace}签到个人云获得(M)`];

  for (let m = 0; m < process.env.PRIVATE_THREADX; m++) {
    signPromises1.push(
      (async () => {
        try {
          const res1 = await cloudClient.userSign();
          if (!res1.isSign && res1.netdiskBonus) {
            getSpace.push(` ${res1.netdiskBonus}`);
          }
        } catch (e) {}
      })()
    );
  }
  //超时中断
  await Promise.race([Promise.all(signPromises1), sleep(timeout)]);
  if (getSpace.length == 1) getSpace.push(" 0");
  result.push(getSpace.join(""));

  signPromises1 = [];
  getSpace = [`${firstSpace}获得(M)`];
  const { familyInfoResp } = await cloudClient.getFamilyList();
  if (familyInfoResp) {
    const family = familyInfoResp.find((f) => f.userRole == 1);
    if (!family) return result;
    result.push(`${firstSpace}开始签到家庭云 ID: ${family.familyId}`);
    for (let i = 0; i < 1; i++) {
      signPromises1.push(
        (async () => {
          try {
            const res = await cloudClient.familyUserSign(family.familyId);
            if (!res.signStatus) {
              getSpace.push(` ${res.bonusSpace}`);
            }
          } catch (e) {}
        })()
      );
    }
    //超时中断
    await Promise.race([Promise.all(signPromises1), sleep(timeout)]);

    if (getSpace.length == 1) getSpace.push(" 0");
    result.push(getSpace.join(""));
  }
  return result;
};

let firstSpace = "  ";

if (process.env.TYYS == null || process.env.TYYS == "") {
  logger.error("没有设置TYYS环境变量");
  process.exit(0);
}

let FAMILY_ID;

let i;

let cloudClientMap = new Map();
let cloudClient = null;
let userNameInfo;

const fs = require("fs");
const path = require("path");

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 使用示例
const folderPath = path.join(process.cwd(), ".token");
ensureDirectoryExists(folderPath);

const main = async () => {
  let accounts = process.env.TYYS.trim().split(/[\n ]+/);

  for (i = 0; i < accounts.length; i += 2) {
    const [userName, password] = accounts.slice(i, i + 2);

    userNameInfo = mask(userName, 3, 7);
    let token = new FileTokenStore(`.token/${userName}.json`);
    try {
      await sleep(100);
      cloudClient = new CloudClient({
        username: userName,
        password,
        token: token,
      });
    } catch (e) {
      console.error("操作失败:", e.message); // 只记录错误消息
    }

    cloudClientMap.set(userName, cloudClient);
    try {
      logger.log(`${i / 2 + 1}.账户 ${userNameInfo} 开始执行`);

      let {
        cloudCapacityInfo: cloudCapacityInfo0,
        familyCapacityInfo: familyCapacityInfo0,
      } = await cloudClient.getUserSizeInfo();

      const result = await doTask(cloudClient);
      result.forEach((r) => logger.log(r));

      let {
        cloudCapacityInfo: cloudCapacityInfo2,
        familyCapacityInfo: familyCapacityInfo2,
      } = await cloudClient.getUserSizeInfo();

      logger.log(
        `${firstSpace}实际：个人容量+ ${
          (cloudCapacityInfo2.totalSize - cloudCapacityInfo0.totalSize) /
          1024 /
          1024
        }M, 家庭容量+ ${
          (familyCapacityInfo2.totalSize - familyCapacityInfo0.totalSize) /
          1024 /
          1024
        }M`
      );
      logger.log(
        `${firstSpace}个人总容量：${(
          cloudCapacityInfo2.totalSize /
          1024 /
          1024 /
          1024
        ).toFixed(2)}G, 家庭总容量：${(
          familyCapacityInfo2.totalSize /
          1024 /
          1024 /
          1024
        ).toFixed(2)}G`
      );
    } catch (e) {
      logger.error(e);
      if (e.code === "ETIMEDOUT") throw e;
    } finally {
      logger.log("");
    }
  }
};

(async () => {
  try {
    if(process.env.PRIVATE_THREADX == null) process.env.PRIVATE_THREADX = 15
    await main();
  } finally {
    const durationMs = Date.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);
    logger.log(`运行时间：${durationSec}s`);
    logger.log("\n\n");
    const events = recording.replay();
    const content = events.map((e) => `${e.data.join("")}`).join("  \n");
    push("天翼云盘自动签到任务", content);
  }
})();
