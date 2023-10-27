const gpac = require("./gpac");
const assert = require('assert');
const sinon = require('sinon');

gpac.init();
// gpac.set_logs("filter@debug");

describe('encode & inspect a yuv frame', function () {

    const sandbox = sinon.createSandbox();

    let fs = null;
    // fs
    let fireEventSpy = null;
    let getFilterSpy = null;
    let postTaskSpy = null;
    let onEventSpy = null;
    
    beforeEach(function () {
        fs = new gpac.FilterSession(gpac.GF_FS_FLAG_NON_BLOCKING);
        postTaskSpy = sandbox.spy(fs, "post_task");
        fireEventSpy = sandbox.spy(fs, "fire_event");
        getFilterSpy = sandbox.spy(fs, "get_filter");

        fs.on_event = function(evt) {
            console.log(evt);
            if (evt.ui_type == gpac.GF_EVENT_QUIT) {
                fs.abort(gpac.GF_FS_FLUSH_NONE);
                return true;
            }
            return false;
        }    
        onEventSpy = sandbox.spy(fs, "on_event");
    });

    afterEach(function () {

        sandbox.restore();

        fs.print_graph();
        fs = null;
        fireEventSpy = null;
        getFilterSpy = null;
        postTaskSpy = null;
        onEventSpy = null;
    });

    
    it('without a video source, it connects encoder to rfnalu', function () {

        let f1 = fs.load("ffenc:c=libx265");
        let f2 = fs.load("rfnalu");
        f2.set_source(f1);

        assert.equal(f1.nb_opid, 0);
        assert.equal(f2.nb_ipid, 0);

        fs.run();

        assert.equal(f1.nb_opid, 0);
        assert.equal(f2.nb_ipid, 0);

    });

    it('given a video source, it connects encoder to rfnalu', function () {

        let f0 = fs.load_src("data/frame.yuv:size=1280x720:spfmt=yuv420");
        let f1 = fs.load("ffenc:c=libx265");
        let f2 = fs.load("rfnalu");
        
        f1.set_source(f0);
        f2.set_source(f1);
        
        assert.equal(f1.nb_opid, 0);
        assert.equal(f2.nb_ipid, 0);

        fs.run();

        assert.equal(f1.nb_opid, 1);
        assert.equal(f2.nb_ipid, 1);
        assert.equal(f1.opid_sinks(0).pop(), f2);
        assert.equal(f2.ipid_source(0).pop(), f1);

    });

    it('given a video source, it does not connect after first run() call', function () {

        let f0 = fs.load_src("data/frame.yuv:size=1280x720:spfmt=yuv420");
        let f1 = fs.load("ffenc:c=libx265");
        f1.set_source(f0);
        fs.run();        
        assert.equal(f1.nb_opid, 1);
        assert.equal(f1.opid_sinks.length, 0);
        
        let f2 = fs.load("rfnalu");
        f2.set_source(f1);
        fs.run(); // doesn't reconfigure 

        assert.equal(f1.opid_sinks.length, 0);
        assert.equal(f2.ipid_source.length, 0);
        assert.equal(f2.nb_ipid, 0);
    });


    it('explicit link then run', function () {

        let f0 = fs.load_src("data/frame.yuv:size=1280x720:spfmt=yuv420");
        let f1 = fs.load("ffenc:c=libx265");
        let f2 = fs.load("inspect");

        f1.set_source(f0);
        f2.set_source(f1);

        assert.equal(f0.nb_ipid, 0);
        assert.equal(f0.nb_opid, 0);
        assert.equal(f1.nb_ipid, 0);
        assert.equal(f1.nb_opid, 0);
        assert.equal(f2.nb_ipid, 0);
        assert.equal(f2.nb_opid, 0);

        assert.equal(fs.nb_filters, 3);
        
        fs.run();

        assert(!fs.last_task);

        // auto graph resolution, creates new filters
        assert.equal(fs.nb_filters, 5);

        assert.equal(fs.get_filter(0), f0);
        assert.equal(fs.get_filter(1), f1);
        assert.equal(fs.get_filter(2), f2);

        assert.equal(f0.nb_ipid, 0);
        assert.equal(f0.nb_opid, 1);
        assert.equal(f1.nb_ipid, 1);
        assert.equal(f1.nb_opid, 1);
        assert.equal(f2.nb_ipid, 1);
        assert.equal(f2.nb_opid, 0);
        
        let f3 = fs.get_filter(3);
        assert.equal(f3.ID, 'rfrawvid');
        assert.equal(f3.ipid_source(0), f0);
        assert.equal(f3.opid_sinks(0).pop(), f1);
        assert.equal(f3.nb_ipid, 1);
        assert.equal(f3.nb_opid, 1);

        let f4 = fs.get_filter(4);
        assert.equal(f4.ID, 'rfnalu');
        assert.equal(f4.ipid_source(0), f1);
        assert.equal(f4.opid_sinks(0).pop(), f2);
        assert.equal(f4.nb_ipid, 1);
        assert.equal(f4.nb_opid, 1);

        assert.equal(onEventSpy.callCount, 1);
        
        fs.run();
        assert(fs.last_task);
    });


});



