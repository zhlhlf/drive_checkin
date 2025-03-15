"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _CloudAuthClient_builLoginForm, _CloudClient_instances, _CloudClient_valid, _CloudClient_getAccessTokenBySsKey;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudClient = exports.CloudAuthClient = void 0;
const url_1 = __importDefault(require("url"));
const got_1 = __importDefault(require("got"));
const log_1 = require("./log");
const util_1 = require("./util");
const const_1 = require("./const");
const store_1 = require("./store");
const config = {
    clientId: '538135150693412',
    model: 'KB2000',
    version: '9.0.6'
};
class CloudAuthClient {
    constructor() {
        _CloudAuthClient_builLoginForm.set(this, (encrypt, appConf, username, password) => {
            const keyData = `-----BEGIN PUBLIC KEY-----\n${encrypt.pubKey}\n-----END PUBLIC KEY-----`;
            const usernameEncrypt = (0, util_1.rsaEncrypt)(keyData, username);
            const passwordEncrypt = (0, util_1.rsaEncrypt)(keyData, password);
            const data = {
                appKey: const_1.AppID,
                accountType: const_1.AccountType,
                // mailSuffix: '@189.cn',
                validateCode: '',
                captchaToken: appConf.captchaToken,
                dynamicCheck: 'FALSE',
                clientType: '1',
                cb_SaveName: '3',
                isOauth2: false,
                returnUrl: const_1.ReturnURL,
                paramId: appConf.paramId,
                userName: `${encrypt.pre}${usernameEncrypt}`,
                password: `${encrypt.pre}${passwordEncrypt}`
            };
            return data;
        });
        this.request = got_1.default.extend({
            headers: {
                'User-Agent': const_1.UserAgent,
                Accept: 'application/json;charset=UTF-8'
            },
            hooks: {
                afterResponse: [
                    async (response, retryWithMergedOptions) => {
                        log_1.log.debug(`url: ${response.requestUrl}, response: ${response.body})}`);
                        return response;
                    }
                ]
            }
        });
    }
    /**
     * 获取加密参数
     * @returns
     */
    getEncrypt() {
        return this.request.post(`${const_1.AUTH_URL}/api/logbox/config/encryptConf.do`).json();
    }
    async getLoginForm() {
        const res = await this.request
            .get(`${const_1.WEB_URL}/api/portal/unifyLoginForPC.action`, {
            searchParams: {
                appId: const_1.AppID,
                clientType: const_1.ClientType,
                returnURL: const_1.ReturnURL,
                timeStamp: Date.now()
            }
        })
            .text();
        if (res) {
            const captchaToken = res.match(`'captchaToken' value='(.+?)'`)[1];
            const lt = res.match(`lt = "(.+?)"`)[1];
            const paramId = res.match(`paramId = "(.+?)"`)[1];
            const reqId = res.match(`reqId = "(.+?)"`)[1];
            return { captchaToken, lt, paramId, reqId };
        }
        return null;
    }
    async getSessionForPC(param) {
        const params = Object.assign(Object.assign({ appId: const_1.AppID }, (0, const_1.clientSuffix)()), param);
        const res = await this.request
            .post(`${const_1.API_URL}/getSessionForPC.action`, {
            searchParams: params
        })
            .json();
        return res;
    }
    /**
     * 用户名密码登录
     * */
    async loginByPassword(username, password) {
        log_1.log.debug('loginByPassword...');
        try {
            const res = await Promise.all([
                //1.获取公钥
                this.getEncrypt(),
                //2.获取登录参数
                this.getLoginForm()
            ]);
            const encrypt = res[0].data;
            const appConf = res[1];
            const data = __classPrivateFieldGet(this, _CloudAuthClient_builLoginForm, "f").call(this, encrypt, appConf, username, password);
            const loginRes = await this.request
                .post(`${const_1.AUTH_URL}/api/logbox/oauth2/loginSubmit.do`, {
                headers: {
                    Referer: const_1.AUTH_URL,
                    lt: appConf.lt,
                    REQID: appConf.reqId
                },
                form: data
            })
                .json();
            if (loginRes.result !== 0) {
                throw new Error(loginRes.msg);
            }
            return await this.getSessionForPC({ redirectURL: loginRes.toUrl });
        }
        catch (e) {
            log_1.log.error(e);
            throw e;
        }
    }
    /**
     * token登录
     */
    async loginByAccessToken(accessToken) {
        log_1.log.debug('loginByAccessToken...');
        return await this.getSessionForPC({ accessToken });
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
                grantType: 'refresh_token',
                format: 'json'
            }
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
        _CloudClient_valid.set(this, (options) => {
            if (!options.token && (!options.username || !options.password)) {
                log_1.log.error('valid');
                throw new Error('Please provide username and password or token !');
            }
        });
        __classPrivateFieldGet(this, _CloudClient_valid, "f").call(this, _options);
        this.username = _options.username;
        this.password = _options.password;
        this.tokenStore = _options.token || new store_1.MemoryStore();
        this.authClient = new CloudAuthClient();
        this.session = {
            accessToken: '',
            sessionKey: ''
        };
        this.request = got_1.default.extend({
            retry: {
                limit: 5
            },
            headers: {
                'User-Agent': const_1.UserAgent,
                Referer: `${const_1.WEB_URL}/web/main/`
            },
            hooks: {
                beforeRequest: [
                    async (options) => {
                        if (options.url.href.includes(const_1.API_URL)) {
                            const accessToken = await this.getAccessToken();
                            const { query } = url_1.default.parse(options.url.toString(), true);
                            const time = String(Date.now());
                            const signature = (0, util_1.getSignature)(Object.assign(Object.assign({}, (options.method === 'GET' ? query : options.json)), { Timestamp: time, AccessToken: accessToken }));
                            options.headers['Sign-Type'] = '1';
                            options.headers['Signature'] = signature;
                            options.headers['Timestamp'] = time;
                            options.headers['Accesstoken'] = accessToken;
                            options.headers['Accept'] = 'application/json;charset=UTF-8';
                        }
                        else if (options.url.href.includes(const_1.WEB_URL)) {
                            const urlObj = new URL(options.url);
                            if (options.url.href.includes('/open')) {
                                const time = String(Date.now());
                                const appkey = '600100422';
                                const signature = (0, util_1.getSignature)(Object.assign(Object.assign({}, (options.method === 'GET' ? urlObj.searchParams : options.json)), { Timestamp: time, AppKey: appkey }));
                                options.headers['Sign-Type'] = '1';
                                options.headers['Signature'] = signature;
                                options.headers['Timestamp'] = time;
                                options.headers['AppKey'] = appkey;
                            }
                            const sessionKey = await this.getSessionKey();
                            urlObj.searchParams.set('sessionKey', sessionKey);
                            options.url = urlObj;
                        }
                    }
                ],
                afterResponse: [
                    async (response, retryWithMergedOptions) => {
                        log_1.log.debug(`url: ${response.requestUrl}, response: ${response.body}`);
                        if (response.statusCode === 400) {
                            const { errorCode, errorMsg } = JSON.parse(response.body.toString());
                            if (errorCode === 'InvalidAccessToken') {
                                log_1.log.debug('InvalidAccessToken retry...');
                                log_1.log.debug('Refresh AccessToken');
                                this.session.accessToken = '';
                                return retryWithMergedOptions({});
                            }
                            else if (errorCode === 'InvalidSessionKey') {
                                log_1.log.debug('InvalidSessionKey retry...');
                                log_1.log.debug('Refresh InvalidSessionKey');
                                this.session.sessionKey = '';
                                return retryWithMergedOptions({});
                            }
                        }
                        return response;
                    }
                ]
            }
        });
    }
    async getSession() {
        const accessToken = await this.tokenStore.getAccessToken();
        if (accessToken) {
            try {
                return await this.authClient.loginByAccessToken(accessToken);
            }
            catch (e) {
                log_1.log.error(e);
            }
        }
        const refreshToken = await this.tokenStore.getRefreshToken();
        if (refreshToken) {
            try {
                const refreshTokenSession = await this.authClient.refreshToken(refreshToken);
                await this.tokenStore.updateAccessToken(refreshTokenSession.accessToken);
                return await this.authClient.loginByAccessToken(refreshTokenSession.accessToken);
            }
            catch (e) {
                log_1.log.error(e);
            }
        }
        if (this.username && this.password) {
            try {
                const loginToken = await this.authClient.loginByPassword(this.username, this.password);
                await this.tokenStore.update({
                    accessToken: loginToken.accessToken,
                    refreshToken: loginToken.refreshToken
                });
                return loginToken;
            }
            catch (e) {
                log_1.log.error(e);
            }
        }
        throw new Error('Can not get session.');
    }
    async getSessionKey() {
        if (!this.session.sessionKey) {
            this.session.sessionKey = (await this.getSession()).sessionKey;
        }
        return this.session.sessionKey;
    }
    /**
     * 获取 accessToken
     * @returns accessToken
     */
    async getAccessToken() {
        if (!this.session.accessToken) {
            this.session.accessToken = (await __classPrivateFieldGet(this, _CloudClient_instances, "m", _CloudClient_getAccessTokenBySsKey).call(this)).accessToken;
        }
        return this.session.accessToken;
    }
    /**
     * 获取用户网盘存储容量信息
     * @returns 账号容量结果
     */
    getUserSizeInfo() {
        return this.request
            .get(`${const_1.WEB_URL}/api/portal/getUserSizeInfo.action`, {
            headers: { Accept: 'application/json;charset=UTF-8' }
        })
            .json();
    }
    /**
     * 个人签到任务
     * @returns 签到结果
     */
    userSign() {
        return this.request
            .get(`${const_1.WEB_URL}/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${config.version}&model=${config.model}`)
            .json();
    }
    /**
     * 获取家庭信息
     * @returns 家庭列表信息
     */
    getFamilyList() {
        return this.request.get(`${const_1.API_URL}/open/family/manage/getFamilyList.action`).json();
    }
    /**
     * 家庭签到任务
     * @param familyId - 家庭id
     * @returns 签到结果
     */
    familyUserSign(familyId) {
        return this.request
            .get(`${const_1.API_URL}/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`)
            .json();
    }
}
exports.CloudClient = CloudClient;
_CloudClient_valid = new WeakMap(), _CloudClient_instances = new WeakSet(), _CloudClient_getAccessTokenBySsKey = function _CloudClient_getAccessTokenBySsKey() {
    return this.request.get(`${const_1.WEB_URL}/api/open/oauth2/getAccessTokenBySsKey.action`).json();
};
