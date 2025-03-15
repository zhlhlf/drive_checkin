"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.Logger = exports.PADDING = exports.debug = void 0;
const chalk_1 = __importDefault(require("chalk"));
let printer = null;
exports.debug = process.env.CLOUD189_VERBOSE === '1';
exports.PADDING = 2;
class Logger {
    constructor(stream) {
        this.stream = stream;
        this.messageTransformer = (it) => it;
    }
    get isDebugEnabled() {
        return exports.debug;
    }
    info(messageOrFields, message) {
        this.doLog(message, messageOrFields, 'info');
    }
    error(messageOrFields, message) {
        this.doLog(message, messageOrFields, 'error');
    }
    warn(messageOrFields, message) {
        this.doLog(message, messageOrFields, 'warn');
    }
    debug(messageOrFields, message) {
        if (this.isDebugEnabled) {
            this.doLog(message, messageOrFields, 'debug');
        }
    }
    doLog(message, messageOrFields, level) {
        if (message === undefined) {
            this._doLog(messageOrFields, null, level);
        }
        else {
            this._doLog(message, messageOrFields, level);
        }
    }
    _doLog(message, fields, level) {
        // noinspection SuspiciousInstanceOfGuard
        if (message instanceof Error) {
            message = message.stack || message.toString();
        }
        else {
            message = message.toString();
        }
        const levelIndicator = level === 'error' ? '⨯' : '•';
        const color = LEVEL_TO_COLOR[level];
        this.stream.write(`${' '.repeat(exports.PADDING)}${color(levelIndicator)} `);
        this.stream.write(Logger.createMessage(this.messageTransformer(message, level), fields, level, color, exports.PADDING + 2 /* level indicator and space */));
        this.stream.write('\n');
    }
    static createMessage(message, fields, level, color, messagePadding = 0) {
        if (fields == null) {
            return message;
        }
        const fieldPadding = ' '.repeat(Math.max(2, 16 - message.length));
        let text = (level === 'error' ? color(message) : message) + fieldPadding;
        const fieldNames = Object.keys(fields);
        let counter = 0;
        for (const name of fieldNames) {
            let fieldValue = fields[name];
            let valuePadding = null;
            // Remove unnecessary line breaks
            if (fieldValue != null && typeof fieldValue === 'string' && fieldValue.includes('\n')) {
                valuePadding = ' '.repeat(messagePadding + message.length + fieldPadding.length + 2);
                fieldValue = fieldValue.replace(/\n\s*\n/g, `\n${valuePadding}`);
            }
            else if (Array.isArray(fieldValue)) {
                fieldValue = JSON.stringify(fieldValue);
            }
            text += `${color(name)}=${fieldValue}`;
            if (++counter !== fieldNames.length) {
                if (valuePadding == null) {
                    text += ' ';
                }
                else {
                    text += '\n' + valuePadding;
                }
            }
        }
        return text;
    }
    log(message) {
        if (printer == null) {
            this.stream.write(`${message}\n`);
        }
        else {
            printer(message);
        }
    }
}
exports.Logger = Logger;
const LEVEL_TO_COLOR = {
    info: chalk_1.default.blue,
    warn: chalk_1.default.yellow,
    error: chalk_1.default.red,
    debug: chalk_1.default.white
};
exports.log = new Logger(process.stdout);
