const gpac = require("./gpac");
const assert = require('assert');
const sinon = require('sinon');

gpac.init();
//gpac.set_logs("filter@debug");

describe('calling avgen from nodejs API', function () {

    it('filter session can load avgen filter', function () {
        const fs = new gpac.FilterSession();
        let avgen = null;
        assert.doesNotThrow(()=>{
            avgen = fs.load("avgen");
        });
    });

});
