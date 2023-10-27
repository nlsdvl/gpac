const process = require("process");
const GPAC_NODEJS = process.env["GPAC_NODEJS"] || "~/gpac/share/nodejs/build/Debug/gpac";
const gpac = require(GPAC_NODEJS);
module.exports = gpac;