"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = void 0;
const store_1 = require("./store");
/**
 * @public
 */
class MemoryStore extends store_1.Store {
    constructor() {
        super();
        this.store = {
            accessToken: '',
            refreshToken: '',
            SSON: '',
            JSESSIONID:''
        };
    }
    get() {
        return this.store;
    }
    update(token) {
        var _a, _b;
        this.store = {
            accessToken: (_a = token.accessToken) !== null && _a !== void 0 ? _a : this.store.accessToken,
            refreshToken: (_a = token.refreshToken) !== null && _a !== void 0 ? _a : this.store.refreshToken,
            SSON: token.SSON || this.store.SSON,
            JSESSIONID: token.JSESSIONID || this.store.JSESSIONID
        };
    }
}
exports.MemoryStore = MemoryStore;
