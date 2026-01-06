"use strict";
var __classPrivateFieldGet =
  (this && this.__classPrivateFieldGet) ||
  function (receiver, state, kind, f) {
    if (kind === "a" && !f)
      throw new TypeError("Private accessor was defined without a getter");
    if (
      typeof state === "function"
        ? receiver !== state || !f
        : !state.has(receiver)
    )
      throw new TypeError(
        "Cannot read private member from an object whose class did not declare it"
      );
    return kind === "m"
      ? f
      : kind === "a"
      ? f.call(receiver)
      : f
      ? f.value
      : state.get(receiver);
  };
var __classPrivateFieldSet =
  (this && this.__classPrivateFieldSet) ||
  function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f)
      throw new TypeError("Private accessor was defined without a setter");
    if (
      typeof state === "function"
        ? receiver !== state || !f
        : !state.has(receiver)
    )
      throw new TypeError(
        "Cannot write private member to an object whose class did not declare it"
      );
    return (
      kind === "a"
        ? f.call(receiver, value)
        : f
        ? (f.value = value)
        : state.set(receiver, value),
      value
    );
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
var _CloudAuthClient_builLoginForm,
  _CloudClient_instances,
  _CloudClient_sessionKeyPromise,
  _CloudClient_accessTokenPromise,
  _CloudClient_valid,
  _CloudClient_getAccessTokenBySsKey;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudClient = exports.CloudAuthClient = void 0;
const url_1 = __importDefault(require("url"));
const got_1 = __importDefault(require("got"));
const got = __importDefault(require("got"));
const log_1 = require("./log");
const util_1 = require("./util");
const const_1 = require("./const");
const store_1 = require("./store");
const error_1 = require("./error");
const { logger } = require("../src/logger");
const crypto_1 = __importDefault(require("crypto"));

const config = {
  clientId: "538135150693412",
  model: "KB2000",
  version: "9.0.6",
};
/**
 * @public
 */
class CloudAuthClient {
  constructor() {
    _CloudAuthClient_builLoginForm.set(
      this,
      (encrypt, appConf, username, password) => {
        const keyData = `-----BEGIN PUBLIC KEY-----\n${encrypt.pubKey}\n-----END PUBLIC KEY-----`;
        const usernameEncrypt = (0, util_1.rsaEncrypt)(keyData, username);
        const passwordEncrypt = (0, util_1.rsaEncrypt)(keyData, password);
        const data = {
          appKey: const_1.AppID,
          accountType: const_1.AccountType,
          // mailSuffix: '@189.cn',
          validateCode: "",
          captchaToken: appConf.captchaToken,
          dynamicCheck: "FALSE",
          clientType: "1",
          cb_SaveName: "3",
          isOauth2: false,
          returnUrl: const_1.ReturnURL,
          paramId: appConf.paramId,
          userName: `${encrypt.pre}${usernameEncrypt}`,
          password: `${encrypt.pre}${passwordEncrypt}`,
        };
        return data;
      }
    );
    this.request = got_1.default.extend({
      headers: {
        "User-Agent": const_1.UserAgent,
        Accept: "application/json;charset=UTF-8",
      },
      retry: {
        limit: 5,
        calculateDelay: ({ attemptCount }) => 300 * attemptCount,
      },
      hooks: {
        beforeRetry: [
          (options, error, retryCount) => {
            if (
              retryCount >= options.retry.limit ||
              [200, 400].includes(error.response?.statusCode)
            ) {
              throw error;
            }
            logger.error(`尝试第 ${retryCount} 次重试，错误: ${error.message}`);
          },
        ],
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            log_1.log.debug(
              `url: ${response.requestUrl}, response: ${response.body})}`
            );
            (0, error_1.checkError)(response.body.toString());
            return response;
          },
        ],
      },
    });
  }
  /**
   * 获取加密参数
   * @returns
   */
  getEncrypt() {
    if (this.Encrypt) return this.Encrypt;
    this.Encrypt = this.request
      .post(`${const_1.AUTH_URL}/api/logbox/config/encryptConf.do`)
      .json();
    return this.Encrypt;
  }
  async getLoginForm() {
    if (this.login_info) return this.login_info;
    const res = await this.request
      .get(`${const_1.WEB_URL}/api/portal/unifyLoginForPC.action`, {
        searchParams: {
          appId: const_1.AppID,
          clientType: const_1.ClientType,
          returnURL: const_1.ReturnURL,
          timeStamp: Date.now(),
        },
      })
      .text();
    if (res) {
      const captchaToken = res.match(`'captchaToken' value='(.+?)'`)[1];
      const lt = res.match(`lt = "(.+?)"`)[1];
      const paramId = res.match(`paramId = "(.+?)"`)[1];
      const reqId = res.match(`reqId = "(.+?)"`)[1];
      this.login_info = { captchaToken, lt, paramId, reqId };
      return this.login_info;
    }
    return null;
  }
  async getSessionForPC(param) {
    const params = Object.assign(
      Object.assign({ appId: const_1.AppID }, (0, const_1.clientSuffix)()),
      param
    );
    const res = await this.request
      .post(`${const_1.API_URL}/getSessionForPC.action`, {
        searchParams: params,
      })
      .json();
    return res;
  }
  /**
   * 用户名密码登录
   * */
  async loginByPassword(username, password, tokenStore) {
    log_1.log.debug("loginByPassword...");
    const res = await Promise.all([
      //1.获取公钥
      this.getEncrypt(),
      //2.获取登录参数
      this.getLoginForm(),
    ]);
    const encrypt = res[0].data;
    const appConf = res[1];
    const data = __classPrivateFieldGet(
      this,
      _CloudAuthClient_builLoginForm,
      "f"
    ).call(this, encrypt, appConf, username, password);
    const loginRes = await this.request
      .post(`${const_1.AUTH_URL}/api/logbox/oauth2/loginSubmit.do`, {
        headers: {
          Referer: const_1.AUTH_URL,
          lt: appConf.lt,
          REQID: appConf.reqId,
        },
        form: data,
      })
      .then(async (res) => {
        let r = JSON.parse(res.body);
        if (r.result != 0) throw new Error(r.msg);

        let sso = res.headers["set-cookie"].find((c) => c.startsWith("SSON="));
        this.cookie_1 = sso.split(";")[0];
        await tokenStore.update({ SSON: sso.split(";")[0] });
        return r;
      });
    return await this.getSessionForPC({ redirectURL: loginRes.toUrl });
  }
  /**
   * token登录
   */
  async loginByAccessToken(accessToken) {
    log_1.log.debug("loginByAccessToken...");
    return await this.getSessionForPC({ accessToken });
  }
  /**
   * sso登录
   */
  async loginBySsoCooike(cookie) {
    log_1.log.debug("loginBySsoCooike...");
    const res = await this.request.get(
      `${const_1.WEB_URL}/api/portal/unifyLoginForPC.action`,
      {
        searchParams: {
          appId: const_1.AppID,
          clientType: const_1.ClientType,
          returnURL: const_1.ReturnURL,
          timeStamp: Date.now(),
        },
      }
    );
    const redirect = await this.request(res.url, {
      headers: {
        Cookie: `SSON=${cookie}`,
      },
    });
    return await this.getSessionForPC({ redirectURL: redirect.url });
  }
  /**
   * 刷新token
   */
  refreshToken(refreshToken) {
    return this.request
      .post(`${const_1.AUTH_URL}/api/oauth2/refreshToken.do`, {
        form: {
          clientId: const_1.AppID,
          refreshToken,
          grantType: "refresh_token",
          format: "json",
        },
      })
      .json();
  }
}
exports.CloudAuthClient = CloudAuthClient;
_CloudAuthClient_builLoginForm = new WeakMap();
/**
 * 天翼网盘客户端
 * @public
 */
class CloudClient {
  constructor(_options) {
    _CloudClient_instances.add(this);
    _CloudClient_sessionKeyPromise.set(this, void 0);
    _CloudClient_accessTokenPromise.set(this, void 0);
    _CloudClient_valid.set(this, (options) => {
      if (!options.token && (!options.username || !options.password)) {
        log_1.log.error("valid");
        throw new Error("Please provide username and password or token !");
      }
    });
    __classPrivateFieldGet(this, _CloudClient_valid, "f").call(this, _options);
    this.username = _options.username;
    this.password = _options.password;
    this.ssonCookie = _options.ssonCookie;
    this.tokenStore = _options.token || new store_1.MemoryStore();
    this.authClient = new CloudAuthClient();
    this.session = {
      accessToken: "",
      sessionKey: "",
    };
    this.request = got_1.default.extend({
      retry: {
        limit: 5,
        calculateDelay: ({ attemptCount }) => 300 * attemptCount,
      },
      timeout: {
        request: 10000,
      },
      headers: {
        "User-Agent": const_1.UserAgent,
        Referer: `${const_1.WEB_URL}/web/main/`,
        Accept: "application/json;charset=UTF-8",
      },
      hooks: {
        beforeRetry: [
          (options, error, retryCount) => {
            if (
              retryCount >= options.retry.limit ||
              [200, 400].includes(error.response?.statusCode)
            ) {
              throw error;
            }
            logger.error(`尝试第 ${retryCount} 次重试，错误: ${error.message}`);
          },
        ],
        beforeRequest: [
          async (options) => {
            if (options.url.href.includes(const_1.API_URL)) {
              const accessToken = await this.getAccessToken();
              const { query } = url_1.default.parse(
                options.url.toString(),
                true
              );
              const time = String(Date.now());
              const signData = Object.assign(
                Object.assign(
                  {},
                  options.method === "GET" ? query : options.json
                ),
                { Timestamp: time, AccessToken: accessToken },
                options.form
              );
              // console.log(options.url.href);
              // console.log(options.form);
              // console.log(signData);
              const signature = (0, util_1.getSignature)(signData);
              options.headers["Sign-Type"] = "1";
              options.headers["Signature"] = signature;
              options.headers["Timestamp"] = time;
              options.headers["Accesstoken"] = accessToken;
            } else if (options.url.href.includes(const_1.WEB_URL)) {
              const urlObj = new URL(options.url);
              if (options.url.href.includes("/open")) {
                const time = String(Date.now());
                const appkey = "600100422";
                const signature = (0, util_1.getSignature)(
                  Object.assign(
                    Object.assign(
                      {},
                      options.method === "GET"
                        ? urlObj.searchParams
                        : options.json
                    ),
                    { Timestamp: time, AppKey: appkey }
                  )
                );
                options.headers["Sign-Type"] = "1";
                options.headers["Signature"] = signature;
                options.headers["Timestamp"] = time;
                options.headers["AppKey"] = appkey;
              }
              const sessionKey = await this.getSessionKey();
              urlObj.searchParams.set("sessionKey", sessionKey);
              options.url = urlObj;
            }
          },
        ],
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            log_1.log.debug(
              `url: ${response.requestUrl}, response: ${response.body}`
            );
            if (response.statusCode === 400) {
              const { errorCode, errorMsg } = JSON.parse(
                response.body.toString()
              );
              if (errorCode === "InvalidAccessToken") {
                log_1.log.debug("InvalidAccessToken retry...");
                log_1.log.debug("Refresh AccessToken");
                this.session.accessToken = "";
                return retryWithMergedOptions({});
              } else if (errorCode === "InvalidSessionKey") {
                log_1.log.debug("InvalidSessionKey retry...");
                log_1.log.debug("Refresh InvalidSessionKey");
                this.session.sessionKey = "";
                return retryWithMergedOptions({});
              }
            }
            return response;
          },
        ],
      },
    });
  }
  async getSession() {
    const { accessToken, refreshToken } =
      await this.tokenStore.get();
    if (accessToken) {
      try {
        return await this.authClient.loginByAccessToken(accessToken);
      } catch (e) {
        log_1.log.debug(e);
      }
    }
    if (refreshToken) {
      try {
        const refreshTokenSession = await this.authClient.refreshToken(
          refreshToken
        );
        await this.tokenStore.update({
          accessToken: refreshTokenSession.accessToken,
          expiresIn: new Date(
            Date.now() + refreshTokenSession.expiresIn * 1000
          ).getTime(),
        });
        return await this.authClient.loginByAccessToken(
          refreshTokenSession.accessToken
        );
      } catch (e) {
        log_1.log.debug(e);
      }
    }
    if (this.ssonCookie) {
      try {
        const loginToken = await this.authClient.loginBySsoCooike(
          this.ssonCookie
        );
        await this.tokenStore.update({
          accessToken: loginToken.accessToken,
          refreshToken: loginToken.refreshToken,
          expiresIn: new Date(Date.now() + 8640 * 1000).getTime(),
        });
        return loginToken;
      } catch (e) {
        log_1.log.debug(e);
      }
    }
    if (this.username && this.password) {
      const loginToken = await this.authClient.loginByPassword(
        this.username,
        this.password,
        this.tokenStore
      );
      await this.tokenStore.update({
        accessToken: loginToken.accessToken,
        refreshToken: loginToken.refreshToken,
        expiresIn: new Date(Date.now() + 8640 * 1000).getTime(),
      });
      return loginToken;
    }
  }
  /**
   * 获取 sessionKey
   * @returns sessionKey
   */
  async getSessionKey() {
    if (this.session.sessionKey) {
      return this.session.sessionKey;
    }
    if (!__classPrivateFieldGet(this, _CloudClient_sessionKeyPromise, "f")) {
      __classPrivateFieldSet(
        this,
        _CloudClient_sessionKeyPromise,
        this.getSession()
          .then((result) => {
            this.session.sessionKey = result.sessionKey;
            return result;
          })
          .finally(() => {
            __classPrivateFieldSet(
              this,
              _CloudClient_sessionKeyPromise,
              null,
              "f"
            );
          }),
        "f"
      );
    }
    const result = await __classPrivateFieldGet(
      this,
      _CloudClient_sessionKeyPromise,
      "f"
    );
    return result.sessionKey;
  }
  /**
   * 获取 accessToken
   * @returns accessToken
   */
  async getAccessToken() {
    if (this.session.accessToken) {
      return this.session.accessToken;
    }
    if (!__classPrivateFieldGet(this, _CloudClient_accessTokenPromise, "f")) {
      __classPrivateFieldSet(
        this,
        _CloudClient_accessTokenPromise,
        __classPrivateFieldGet(
          this,
          _CloudClient_instances,
          "m",
          _CloudClient_getAccessTokenBySsKey
        )
          .call(this)
          .then((result) => {
            this.session.accessToken = result.accessToken;
            return result;
          })
          .finally(() => {
            __classPrivateFieldSet(
              this,
              _CloudClient_accessTokenPromise,
              null,
              "f"
            );
          }),
        "f"
      );
    }
    const result = await __classPrivateFieldGet(
      this,
      _CloudClient_accessTokenPromise,
      "f"
    );
    return result.accessToken;
  }
  /**
   * 获取用户网盘存储容量信息
   * @returns 账号容量结果
   */
  getUserSizeInfo() {
    return this.request
      .get(`${const_1.WEB_URL}/api/portal/getUserSizeInfo.action`)
      .json();
  }
  /**
   * 个人签到任务
   * @returns 签到结果
   */
  userSign() {
    return this.request
      .get(
        `${
          const_1.WEB_URL
        }/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${
          config.version
        }&model=${config.model}`
      )
      .json();
  }
  /**
   * 获取家庭信息
   * @returns 家庭列表信息
   */
  getFamilyList() {
    return this.request
      .get(`${const_1.API_URL}/open/family/manage/getFamilyList.action`)
      .json();
  }
  /**
   * 家庭签到任务
   * @param familyId - 家庭id
   * @returns 签到结果
   */
  familyUserSign(familyId) {
    return (
      this.request
        // .get(
        //   `${const_1.API_URL}/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`
        // )
        .get(
          `${const_1.API_URL}/open/family/manage/familyUserSign.action?familyId=${familyId}`
        )
        .json()
    );
  }

  //-----------------自定义方法--------------

  async getMyFamilyUsers() {
    let familyId = await this.getFamilyId();
    let url = `https://api.cloud.189.cn/open/family/manage/getMemberList.action?familyId=${familyId}`;
    return this.request.get(`${url}`).json();
  }

  async getFamilyUsersById(familyId) {
    let url = `https://api.cloud.189.cn/open/family/manage/getMemberList.action?familyId=${familyId}`;
    return this.request.get(`${url}`).json();
  }

  async getFamilyId() {
    if (this.familyId) return this.familyId;
    const { familyInfoResp } = await this.getFamilyList();
    this.familyId = familyInfoResp.find((f) => f.userRole == 1).familyId;
    return this.familyId;
  }

  async exitFamilyById(familyId) {
    let url = "https://api.cloud.189.cn/open/family/manage/exitFamily.action";
    let payload = {
      familyId: familyId,
    };
    return this.request
      .post(`${url}`, {
        form: payload,
      })
      .then((response) => {
        log_1.log.debug(`exitFamily yes:`, response.body);
        return true;
      })
      .catch((error) => {
        log_1.log.debug(`exitFamily fail:`, error.response.body);
        return false;
      });
  }

  async inviteUserToFamily(account, familyId) {
    let url = "https://api.cloud.189.cn/open/family/manage/addMember.action";
    let payload = {
      familyId: familyId,
      account: account,
    };
    let r = await this.request.post(`${url}`, {
      form: payload,
    });
    log_1.log.debug(`invit ${account} to ${familyId} yes:`, r.body);
    return true;
  }

  async addToFamily(familyId, invite_account) {
    const time = String(Date.now());
    let url = `https://api.cloud.189.cn/open/family/manage/doAddMember.action?familyId=${familyId}&inviteAccount=${invite_account}&account=${this.username}&date=${time}`;

    let r = await this.request.get(`${url}`, {
      headers: {
        x_request_id: crypto_1.default.randomBytes(16).toString("hex"),
        Accept: "application/json;charset=UTF-8",
      },
    });
    log_1.log.debug(`${this.username} addToFamily ${familyId} yes`, r.body);
    return true;
  }

  async deleteMyFamilyUser(account) {
    let url = "https://api.cloud.189.cn/open/family/manage/deleteMember.action";
    let familyId = await this.getFamilyId();
    let { familyMemberInfoResp } = await this.getMyFamilyUsers();
    let userId;
    try {
      userId = familyMemberInfoResp.find((f) => f.account == account).userId;
    } catch (e) {
      log_1.log.error(`${this.username} 的家庭云不存在用户 ${account} ！`);
      return;
    }

    let payload = {
      familyId: familyId,
      userId: userId,
    };
    return this.request
      .post(`${url}`, {
        headers: {
          Accept: "application/json;charset=UTF-8",
        },
        form: payload,
      })
      .then((res) => {
        log_1.log.debug(`deleteMyFamilyUser ${account} yes`, res.body);
        return true;
      })
      .catch((e) => {
        log_1.log.debug(`deleteMyFamilyUser ${account} fail`, e.response.body);
        return false;
      });
  }

  async getCTC() {
    this.cookie_1 = "";
    try {
      const response = await got.get("https://e.189.cn/safe/getCTC.do", {
        headers: {
          Referer: "https://e.189.cn/user/account/changePwd.do",
          Accept: "*/*",
          Host: "e.189.cn",
          Connection: "keep-alive",
        },
      });

      const body =
        typeof response.body === "string"
          ? JSON.parse(response.body)
          : response.body;

      this.csrfToken = body.csrfToken;

      //cookie增加 csrfToken
      let setCookie = response.headers["set-cookie"][0].split(":")[0];
      setCookie = setCookie.split(";")[0];
      this.cookie_1 = `${this.tokenStore.get()["SSON"]}; ${setCookie}`;
    } catch (e) {
      console.error("getCTC Error:", e.message);
    }
  }

  async closeDeviceLock() {
    await this.getCTC();
    let body = {
      status: "1",
      csrfToken: this.csrfToken,
    };

    const res = await got
      .post("https://e.dlife.cn/user/protect/setUserSwitchStatus.do", {
        headers: {
          Referer: "https://e.dlife.cn/user/index.do",
          Cookie: this.cookie_1,
          Accept: "*/*",
          Host: "e.dlife.cn",
          Connection: "keep-alive",
        },
        form: body,
      })
      .json();
    console.log(res);
    if (res.result == "10000") {
      console.log(
        `                                              ${this.username}   --  设备锁已关闭成功`
      );
      return true;
    } else {
      console.log(this.username + "  设备锁关闭失败");
      return false;
    }
  }
  //-----------------自定义方法--------------
}
exports.CloudClient = CloudClient;
(_CloudClient_sessionKeyPromise = new WeakMap()),
  (_CloudClient_accessTokenPromise = new WeakMap()),
  (_CloudClient_valid = new WeakMap()),
  (_CloudClient_instances = new WeakSet()),
  (_CloudClient_getAccessTokenBySsKey =
    function _CloudClient_getAccessTokenBySsKey() {
      return this.request
        .get(`${const_1.WEB_URL}/api/open/oauth2/getAccessTokenBySsKey.action`)
        .json();
    });
