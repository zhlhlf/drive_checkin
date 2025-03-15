require("dotenv").config();
const recording = require("log4js/lib/appenders/recording");
const { CloudClient, FileTokenStore } = require("../sdk/index");
let { push } = require("./push");

const { logger } = require("./logger");

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

  if (process.env.PRIVATE_ONLY_FIRST != "true" || i == 1) {
    for (let m = 0; m < private_threadx; m++) {
      signPromises1.push(
        (async () => {
          try {
            const res1 = await cloudClient.userSign();
            if (!res1.isSign) {
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
  }

  signPromises1 = [];
  getSpace = [`${firstSpace}获得(M)`];
  const { familyInfoResp } = await cloudClient.getFamilyList();
  if (familyInfoResp) {
    const family = familyInfoResp.find((f) => f.familyId == FAMILY_ID);
    if (!family) return result;
    result.push(`${firstSpace}开始签到家庭云 ID: ${family.familyId}`);
    for (let i = 0; i < family_threadx; i++) {
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

let accounts_group = process.env.TYYS.trim().split("--");
let private_threadx = process.env.FAMILY_THREADX; //进程数
let family_threadx = process.env.PRIVATE_THREADX; //进程数
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
const folderPath = path.join(__dirname, "../.token");
ensureDirectoryExists(folderPath);

const main = async () => {
  let accounts;

  for (let p = 0; p < accounts_group.length; p++) {
    accounts = accounts_group[p].trim().split(/[\n ]+/);

    let familyCapacitySize, familyCapacitySize2, firstUserName;
    FAMILY_ID = accounts[0];

    for (i = 1; i < accounts.length; i += 2) {
      const [userName, password] = accounts.slice(i, i + 2);

      userNameInfo = mask(userName, 3, 7);
      let token = new FileTokenStore(`.token/${userName}.json`);
      try {
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
        logger.log(`${(i - 1) / 2 + 1}.账户 ${userNameInfo} 开始执行`);

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

        if (i == 1) {
          firstUserName = userName;
          familyCapacitySize = familyCapacityInfo0.totalSize;
          familyCapacitySize2 = familyCapacitySize;
        }

        //重新获取主账号的空间信息
        cloudClient = cloudClientMap.get(firstUserName);
        const { familyCapacityInfo } = await cloudClient.getUserSizeInfo();

        logger.log(
          `${firstSpace}实际：个人容量+ ${
            (cloudCapacityInfo2.totalSize - cloudCapacityInfo0.totalSize) /
            1024 /
            1024
          }M, 家庭容量+ ${
            (familyCapacityInfo.totalSize - familyCapacitySize2) / 1024 / 1024
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
        familyCapacitySize2 = familyCapacityInfo.totalSize;
      } catch (e) {
        logger.error(e);
        if (e.code === "ETIMEDOUT") throw e;
      } finally {
        logger.log("");
      }
    }
    userNameInfo = mask(firstUserName, 3, 7);
    const capacityChange = familyCapacitySize2 - familyCapacitySize;
    logger.log(
      `主账号${userNameInfo} 家庭容量+ ${capacityChange / 1024 / 1024}M`
    );

    cloudClient = cloudClientMap.get(firstUserName);
    let {
      cloudCapacityInfo: cloudCapacityInfo2,
      familyCapacityInfo: familyCapacityInfo2,
    } = await cloudClient.getUserSizeInfo();
    logger.log(
      `个人总容量：${(
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
    logger.log("");
  }
};

(async () => {
  try {
    await main();
  } finally {
    logger.log("\n\n");
    const events = recording.replay();
    const content = events.map((e) => `${e.data.join("")}`).join("  \n");
    push("天翼云盘自动签到任务", content);
  }
})();
