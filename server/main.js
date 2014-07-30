var exec = require("child_process").exec;
var sys = require("sys");
var fs = require("fs");
var WebSocketServer = require("ws").Server;
var wss;

//TESTING
var procId = 910;

// get pid of wow
exec("xdotool search --name \"World of Warcraft\" getwindowpid", function (error, stdout, stderr) {
	var p = stdout.split("\n");

	if (p.length == 2) {
		procId = p[0];
		console.log("wow pid", procId);
		runSrv();
	} else {
		console.log("wow not found");
	}
});

function readMem(pid, offs, size) {
	var f = fs.openSync("/proc/"+pid+"/mem", "r")

	var b = new Buffer(size);
	fs.readSync(f, b, 0, size, offs);

	fs.close(f);
	return b.toJSON();
}

function getMemMaps(pid) {
	var f = fs.openSync("/proc/"+pid+"/maps", 'r');
	var lines = fs.readFileSync("/proc/"+pid+"/maps", { encoding: 'utf8' }).split('\n');

	var exp = new RegExp(/^([0-9a-f]{8})-([0-9a-f]{8}) (r|-)(w|-)(x|-)(p|s|-) ([0-9a-f].*) ([0-9a-f]{2}:[0-9a-f]{2}) ([0-9]*)  *(.*)$/);

	var maps = [];

	for (i in lines) {
		if (lines[i].length == 0)
			break;

		var m = lines[i].match(exp);

		if (m == null)
		{
			console.log("Failed to parse", lines[i]);
			return null;
		}

		// build obj
		var obj = {
			id: parseInt(i),
			offs: parseInt(m[1], 16),
			size: parseInt(m[2], 16)-parseInt(m[1], 16),
			permRead: m[3] == 'r' ? true : false,
			permWrite: m[4] == 'w' ? true : false,
			permExec: m[5] == 'x' ? true : false,
			permShared: m[6] == 's' ? true : false,
			permPriv: m[6] == 'p' ? true : false,
			foffs: parseInt(m[7], 16),
			dev: m[8],
			inode: m[9],
			path: m[10]
		};

		maps.push(obj);
	}

	return maps;
}

function getMemRangeOf(addr, maps) {
	for (i in maps) {
		c = maps[i];

		if (addr >= c.offs && addr < c.offs+c.size)
			return c;
	}

	return null;
}

function respMsg(ws, msg, data) {
	msg.data = data;
	ws.send(JSON.stringify(msg));
}

function onMsg(ws, msg) {
	if (msg.cmd == "reqmaps") {
		// send memory maps
		respMsg(ws, msg, getMemMaps(procId));
	} else if(msg.cmd == "reqmem" && typeof msg.data.offs == 'number' && typeof msg.data.size == 'number') {
		var mem = readMem(procId, msg.data.offs, msg.data.size)
		if (mem == null)
			console.log("failed to read mem", msg.data.offs, msg.data.size);
		
		respMsg(ws, msg, { offs: msg.data.offs, data: mem });
	}
}

function runSrv() {
	console.log("running server...");
	wss = new WebSocketServer({ host: "0.0.0.0", port: 8888 });
	
	wss.on('connection', function(ws) {
		ws.on('message', function(e) {
			var msgObj = JSON.parse(e);
			onMsg(ws, msgObj);
		});
	});

	//console.log("mem", readMem(procId, 0x00da82d4, 4));
}

