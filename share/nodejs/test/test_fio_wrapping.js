const gpac = require("./gpac");

const filesys = require('fs');
const assert = require('assert');
const sinon = require('sinon');

const fio_factory = {
	open: function(url, mode) {

		this.file = null;
		this.size = 0;
		this.position = 0;
		this.read_mode = false;
		this.is_eof = false;
		this.url = url;
		//NodeJS does not accept 't' or 'b' indicators, always assumes binary
		mode = mode.replace('b', '');
		mode = mode.replace('t', '');

		try {
			this.file = filesys.openSync(url, mode);
		} catch (e) {
			console.log('Fail to open ' + url + ' in mode ' + mode + ': ' + e);
			return false;
		}
		//file is read or append, get the file size
		if (mode.indexOf('w')<0) {
			let stats = filesys.fstatSync(this.file);
			this.size = stats.size;
			if (mode.indexOf('a+')>=0) {
				this.position = this.size;
			}
			this.read_mode = true;
		}
		return true;
	},
	close: function() {
		filesys.closeSync(this.file);
	},
	read: function(buf) {
		let nb_bytes = 0;
		try {
			nb_bytes = filesys.readSync(this.file, buf, 0, buf.length, this.position);
		} catch (e) {
			console.log('read error: ' + e);
			return 0;
		}
		if (!nb_bytes) this.is_eof = true;
		this.position += nb_bytes;
		return nb_bytes;
	},
	write: function(buf) {
		let nb_bytes = filesys.writeSync(this.file, buf, 0, buf.length, this.position);
		if (this.position == this.size) {
			this.size += nb_bytes;
		}
		this.position += nb_bytes;
		return nb_bytes;
	},
	seek: function(pos, whence) {
		this.is_eof = false;
		if (pos<0) return -1;
		//seek set
		if (whence==0) {
			this.position = pos;
		}
		//seek cur
		else if (whence==1) {
			this.position += pos;
		}
		//seek end
		else if (whence==2) {
			if (this.size < pos) return -1;
			this.position = this.size - pos;
		} else {
			return -1;
		}
		return 0;
	},
	tell: function() {
		return this.position;
	},
	eof: function() {
		return this.is_eof;
	},
	exists: function(url) {
		try {
			filesys.accessSync(url);
		} catch (err) {
			return false;
		}
		return true;
	}
};


const log_calls = (spy, name) => {
    let spied = spy[name];
    for (let i=0; i < spied.callCount; i++){
        const called = spied.getCall(i);
        console.log(`${name}(...)[${i}]=> ${called.returnValue}`);
    }
};

describe('test fio wrapper API', function () {

    const sandbox = sinon.createSandbox();

    const furl = 'data/frame.hvc';
	const fsize = filesys.readFileSync(furl).byteLength;
    let fs = null;

    beforeEach(function () {
        fs = new gpac.FilterSession();
        sandbox.spy(fio_factory);
    });

    afterEach(function () {
        fs.print_graph();
        fs = null;
        sandbox.restore();
    });

    it('opens file and probes size, when calling fs.load_src()', function () {

        const src = new gpac.FileIO(furl, fio_factory);
        assert.equal(0, fio_factory.open.callCount);

        const f1 = fs.load_src(src.url);

		assert.equal(1, fio_factory.open.callCount);
		assert(fio_factory.open.alwaysCalledWith(furl, 'rb'));
        assert.equal(3, fio_factory.seek.callCount);
		// seek end of file
        assert.equal(fio_factory.seek.args[0][0], 0);
        assert.equal(fio_factory.seek.args[0][1], 2);
		// seek back to beginning
		assert.equal(fio_factory.seek.args[1][0], 0);
		assert.equal(fio_factory.seek.args[1][1], 0);

		assert.equal(1, fio_factory.tell.callCount);
		assert.equal(fsize, fio_factory.tell.returnValues[0]);

		assert.equal(0, fio_factory.read.callCount);
		assert.equal(0, fio_factory.eof.callCount);
        assert.equal(0, fio_factory.close.callCount);
	});

    it('reads more than the whole file', function () {
        const src = new gpac.FileIO(furl, fio_factory);
        const f1 = fs.load_src(src.url);
        const f2 = fs.load("rfnalu");
        f2.set_source(f1);
        fs.run();
		assert(fio_factory.read.callCount > 0);
		assert(fio_factory.eof.callCount > 0);
		let totalSize = 0;
		for (let i=0; i < fio_factory.read.callCount; i++){
			totalSize += fio_factory.read.returnValues[i];
		}
		assert(totalSize > fsize);
    });

});