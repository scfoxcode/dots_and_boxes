const path = require('path');

module.exports = {
    mode: "development",
    entry: "./observer.js",
    output: {
        filename: "index.js",
        path: path.resolve(__dirname, "build"),
    },
};