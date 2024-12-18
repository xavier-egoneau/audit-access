// utils/logger.js
const logger = {
    log: (...args) => {
        if (process.env.NODE_ENV !== 'test') {
            console.log(...args);
        }
    },
    error: (...args) => {
        if (process.env.NODE_ENV !== 'test') {
            console.error(...args);
        }
    },
    warn: (...args) => {
        if (process.env.NODE_ENV !== 'test') {
            console.warn(...args);
        }
    },
    info: (...args) => {
        if (process.env.NODE_ENV !== 'test') {
            console.info(...args);
        }
    },
    debug: (...args) => {
        if (process.env.NODE_ENV !== 'test') {
            console.debug(...args);
        }
    }
};

module.exports = logger;