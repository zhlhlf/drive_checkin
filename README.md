📝 **天翼云盘签到脚本** 🤖✨

---

### 🔑 账号配置 & 环境变量

**路径**：`Settings` → `Secrets and variables` → `Actions` → `Repository secrets`
需新建以下加密变量：


| 变量名 🐈          | 说明 📌                                                                                                                                                                           | 示例 🖼️                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `TYYS`            | 账号密码组，格式：`账号1 密码1 账号2 密码2`                                                                                                                                      | `u1 p1 u2 p2 `             |
| `DINGTALK_TOKEN`  | 钉钉群机器人 `access_token`，可直接填完整 webhook，也可只填 token                                                                                                               | `https://oapi...access`    |
| `DINGTALK_SECRET` | 钉钉机器人安全设置的 `secret`（仅当开启签名校验时需要）                                                                                                                            | `SECxxxxxxxx`              |

---

`家庭云ID抓取教程：`[Ailst 文档](https://alist.nn.ci/zh/guide/drivers/189.html#%E5%AE%B6%E5%BA%AD%E8%BD%AC%E7%A7%BB)

### 🚀 快速执行指南

1️⃣ **启用 Workflow**
✅ 点击仓库顶部 `Actions` → **`I understand my workflows, go ahead and enable them`** 开启权限

2️⃣ **触发运行**
🌟 啊喂 你都 fork 了 给仓库点个 **Star** 啊

3️⃣ **定时任务**
⏰ 每天 **北京时间 5:00** 自动执行

---

### 💻 本地调试命令

```bash
git clone https://github.com/zhlhlf/drive_checkin --depth=1

cd drive_checkin && npm install

#账号密码空格隔开每个账号也空格隔开 例：FID u1 p1 u2 p2 u3 p3 -- FID u1 p1 u2 p2
export TYYS=""

# 指定签到的家庭云ID
export TYY_FAMILY_ID=""

# 私有云签到线程数量 默认10
export PRIVATE_THREADX=""

# 个人签到是否只签主账号 true(是)  false为否会签到所有号  默认false
export PRIVATE_ONLY_FIRST=""

# 推送相关（钉钉）
export DINGTALK_TOKEN=""
# 开启加签时需要
export DINGTALK_SECRET=""
npm run start
```

---

### 🐉 青龙面板部署

```bash

# 订阅链接
ql repo https://github.com/zhlhlf/drive_checkin.git "src/Cloud189.js" "" ".*" "main" "js | json"

# 依赖安装
    chalk
    tough-cookie
    dotenv
    superagent
    log4js

# 配置好上面的环境变量
```

---

🙏 **特别鸣谢**
原项目：[wes-lin/Cloud189Checkin](https://github.com/wes-lin/Cloud189Checkin)

修改 README：[ShelbyAlan](https://github.com/ShelbyAlan)💡
