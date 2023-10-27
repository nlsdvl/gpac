const gpac = require("./gpac");
const assert = require('assert');
const sinon = require('sinon');

gpac.init();
//gpac.set_logs("filter@debug");

const new_custom_filter = (fs, name) => {
    let custom_filter = fs.new_filter(name);
    custom_filter.set_max_pids(-1);
    custom_filter.pids = [];
    custom_filter.process = function() { return gpac.GF_OK };
    custom_filter.configure_pid = function(pid, is_remove) { return gpac.GF_OK };
    custom_filter.process_event = function(evt) { return true };
    custom_filter.reconfigure_output = function(pid) { return gpac.GF_OK };
    return custom_filter;
}


describe('test configure custom h265 source to rfnalu', function () {

    const sandbox = sinon.createSandbox();

    let fs = null;
    let f1 = null;
    let f2 = null;
    // fs
    let fireEventSpy = null;
    let getFilterSpy = null;
    // f1
    let processSpy = null;
    let processEventSpy = null;
    let configurePidSpy = null;
    let reconfigureOutputSpy = null;
    
    
    beforeEach(function () {
        fs = new gpac.FilterSession(gpac.GF_FS_FLAG_NON_BLOCKING);
        fireEventSpy = sandbox.spy(fs, "fire_event");
        getFilterSpy = sandbox.spy(fs, "get_filter");

        f1 = new_custom_filter(fs, "mySourceFilter");
        f1.push_cap('StreamType', 'Visual', gpac.GF_CAPS_OUTPUT);
        f1.push_cap('CodecID', 'h265', gpac.GF_CAPS_OUTPUT);
        processSpy = sandbox.spy(f1, "process");
        processEventSpy = sandbox.spy(f1, "process_event");
        configurePidSpy = sandbox.spy(f1, "configure_pid");
        reconfigureOutputSpy = sandbox.spy(f1, "reconfigure_output");

        // f2 = fs.load("inspect:full");
        f2 = fs.load("rfnalu");
    });

    afterEach(function () {

        sandbox.restore();

        fs.print_graph();
        fs = null;
        fireEventSpy = null;
        getFilterSpy = null;

        f1 = null;
        processSpy = null;
        processEventSpy = null;
        configurePidSpy = null;
        reconfigureOutputSpy = null;
        
        f2 = null;
    });

    it('the session has 2 filters', function () {
        assert.equal(fs.nb_filters, 2);
        assert.equal(fs.get_filter(0), f1);
        assert.equal(fs.get_filter(1), f2);
        fs.run();
    });

    it('creating a new_pid() increments nb_opid', function () {
        assert(f1.connections_pending);
        assert.equal(f1.nb_opid, 0);
        
        let opid1 = f1.new_pid();
        assert.equal(f1.nb_opid, 1);

        let opid2 = f1.new_pid();
        assert.equal(f1.nb_opid, 2);

        fs.run();
    });

    it('checks_caps() returns true after opid configuration', function () {
        
        const opid = f1.new_pid();
        
        /*
        // import error in binary wrapper causes test process to crash 
        //      when calling opid.set_info 
        
        assert.doesNotThrow(()=>{
            // opid.set_info('StreamType', 'Visual');
            opid.set_prop('StreamType', 'Visual');
        });
        
        */

        assert.equal(opid.check_caps(), true);

        assert.equal(f1.opid_prop(0, 'StreamType'), 'Visual');
        assert.equal(f1.opid_prop(0, 'CodecID'), 'h265');
    });

    it('executes a custom task', function () {
        const t = {};
        t.nb_tasks = 0;
        t.max_tasks = 1;
        t.execute = function() {   
            if (fs.last_task) {
                return false;
            }
            this.nb_tasks++;
            if (this.nb_tasks > t.max_tasks) {
                    return false;
            }
            return 100;
        }
        assert(fs.last_task);

        const tExecuteSpy = sandbox.spy(t, "execute");
        fs.post_task(t);
        assert(!fs.last_task);

        fs.run();
        assert.equal(tExecuteSpy.callCount, 1);        
        
    });

    it('uses explicit linking to connect f1 => f2', function () {

        assert(f1.connections_pending);

        let opid = f1.new_pid();
        assert.equal(f1.nb_opid, 1);
        const sinks = f1.opid_sinks(0);

        f1.insert(f2);
        f2.set_source(f1, "#mySourceFilter");
        fs.run(); // a single step to resolve graph ?
        opid_sinks = f1.opid_sinks(0);

        assert(!f1.connections_pending);

        assert(fs.last_task);
        assert(reconfigureOutputSpy.callCount > 0);
        assert(configurePidSpy.callCount > 0);
        assert(processSpy.callCount > 0);
        assert(processEventSpy.callCount > 0);

    });

});
