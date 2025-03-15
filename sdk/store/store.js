"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
class Store {
    constructor() { }
    getAccessToken() {
        throw new Error('getAccessToken is not implemented');
    }
    getRefreshToken() {
        throw new Error('getRefreshToken is not implemented');
    }
    updateRefreshToken(refreshToken) {
        throw new Error('updateRefreshToken is not implemented');
    }
    updateAccessToken(accessToken) {
        throw new Error('updateAccessToken is not implemented');
    }
    update(token) {
        throw new Error('update is not implemented');
    }
}
exports.Store = Store;
