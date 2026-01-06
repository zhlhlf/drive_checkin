const { logger } = require("./logger");
const { sendNotify } = require("./push");

const { CloudClient, FileTokenStore } = require("../sdk/index");
const fs = require("fs");
const path = require("path");
const pLimit = require('p-limit');

const limit = pLimit(8);
let clients = new Map();
let good = [];
let bad = [];

const getCloudClient = async (userName, password) => {
  if (clients.has(userName)) return clients.get(userName);

  let token = new FileTokenStore(`.token/${userName}.json`);

  let c = new CloudClient({
    username: userName,
    password: password,
    token: token,
  });
  clients.set(userName, c);
  const filePath = path.join(process.cwd(), `.token/${userName}.json`);
  if (!fs.existsSync(filePath)) {
    logger.log(`${userName} login...`);
    await c.getSession();
  }
  return c;
};

const create = (a) => {
  folderPath = a;
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  } else {
  }
};

const logOutput = (message) => {
  console.log(message);
}

const processUser = async (userName, password, index, totalUsers) => {
  try {
    let c = await getCloudClient(userName, password);
    let space = await c.getUserSizeInfo();
    await c.userSign();
    let h = `${(index / 2) + 1}/${totalUsers}.`
    let cloudUsedStr = (space.cloudCapacityInfo.usedSize / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ');
    let cloudTotalStr = (space.cloudCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ');
    let familyUsedStr = (space.familyCapacityInfo.usedSize / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ');
    let familyTotalStr = (space.familyCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ');
    let msg = `${h.padEnd(10, ' ')} ${userName.padEnd(12, ' ')}  ${cloudUsedStr}G  ${cloudTotalStr}G     -- ${familyUsedStr}G  ${familyTotalStr}G`
    logOutput(msg)
    good.push({
      userName,
      password,
      cloudSize: space.cloudCapacityInfo.totalSize,
      familySize: space.familyCapacityInfo.totalSize,
      cloudUsed: space.cloudCapacityInfo.usedSize,
      familyUsed: space.familyCapacityInfo.usedSize,
      msg
    });
  } catch (e) {
    let errMsg = `${userName}  --  ${e.message}`
    logOutput(errMsg)
    bad.push({
      userName,
      password,
      error: e.message
    });
  }
};

const main = async () => {
  create(".token");
  create("out");

  let jer = fs.readFileSync("tyys.txt", "utf8").trim().split(/[\n\t\r ]+/);;
  let totalUsers = Math.floor(jer.length / 2);
  const tasks = [];
  for (let i = 0; i < jer.length - 1; i += 2) {
    const [userName, password] = jer.slice(i, i + 2);
    tasks.push(limit(() => processUser(userName, password, i, totalUsers)));
  }
  await Promise.all(tasks);

  // 排序 good 数组：先按 cloudSize TB 取整降序，再按 familySize TB 取整降序
  good.sort((a, b) => {
    const aCloudTB = Math.floor(a.cloudSize / (1024 ** 3) / 1024);
    const bCloudTB = Math.floor(b.cloudSize / (1024 ** 3) / 1024);
    if (aCloudTB !== bCloudTB) {
      return bCloudTB - aCloudTB;
    } else {
      const aFamilyTB = Math.floor(a.familySize / (1024 ** 3) / 1024);
      const bFamilyTB = Math.floor(b.familySize / (1024 ** 3) / 1024);
      return bFamilyTB - aFamilyTB;
    }
  });

  const goodStr = good.map(item => `${item.userName.padEnd(12, ' ')} \t ${item.password.padEnd(25, ' ')} \t ${(item.cloudUsed / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ')}G ${(item.cloudSize / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ')}G     -- ${(item.familyUsed / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ')}G ${(item.familySize / 1024 / 1024 / 1024).toFixed(2).padStart(8, ' ')}G`).join('\n');
  const badStr = bad.map(item => `${item.userName} \t ${item.password} \t ${item.error}`).join('\n');

  try {
    fs.writeFileSync("out/good.txt", goodStr, "utf8"); // 写入文件，指定编码为 utf8
    fs.writeFileSync("out/bad.txt", badStr, "utf8"); // 写入文件，指定编码为 utf8

    // 准备推送内容 - markdown 格式
    const summary = `## 检查完成

| 状态 | 数量 |
|------|------|
| ✅ 成功 | ${good.length} |
| ❌ 失败 | ${bad.length} |`;

    const detailedLogs = `### 详细日志\n\`\`\`\n${good.map(item => item.msg).join("\n")}\n\`\`\``;
    const pushMessage = `${summary}\n\n${detailedLogs}`;

    // 调用push推送所有记录
    try {
      await sendNotify("云189账户检查结果", pushMessage, { "format": "markdown" });
      logger.log("推送成功");
    } catch (pushErr) {
      logger.log("推送失败: " + pushErr.message);
    }
  } catch (err) { }
};

(async () => {
  try {
    await main();
  } finally {
    logger.log("\n\n");
  }
})();
