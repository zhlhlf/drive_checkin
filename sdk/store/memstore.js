"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = void 0;
const store_1 = require("./store");
class MemoryStore extends store_1.Store {
    constructor() {
        super();
        this.store = {
            accessToken: '',
            refreshToken: ''
        };
    }
    getAccessToken() {
        return Promise.resolve(this.store.accessToken);
    }
    updateAccessToken(accessToken) {
        this.store.accessToken = accessToken;
        return Promise.resolve();
    }
    updateRefreshToken(refreshToken) {
        this.store.refreshToken = refreshToken;
        return Promise.resolve();
    }
    getRefreshToken() {
        return Promise.resolve(this.store.refreshToken);
    }
    update(token) {
        this.store = {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken
        };
    }
}
exports.MemoryStore = MemoryStore;
