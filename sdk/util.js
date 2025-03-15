"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsaEncrypt = exports.getSignature = void 0;
const crypto_1 = __importDefault(require("crypto"));
const sortParameter = (data) => {
    if (!data) {
        return '';
    }
    const e = Object.entries(data).map((t) => t.join('='));
    e.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    return e.join('&');
};
const getSignature = (data) => {
    const parameter = sortParameter(data);
    return crypto_1.default.createHash('md5').update(parameter).digest('hex');
};
exports.getSignature = getSignature;
const rsaEncrypt = (publicKey, origData) => {
    const encryptedData = crypto_1.default.publicEncrypt({
        key: publicKey,
        padding: crypto_1.default.constants.RSA_PKCS1_PADDING
    }, Buffer.from(origData));
    return encryptedData.toString('hex').toUpperCase();
};
exports.rsaEncrypt = rsaEncrypt;
