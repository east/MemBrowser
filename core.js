var ws;

function WatchPoint(wlist, id, offs, varType) {
	this.wlist = wlist;
	this.id = id;
	this.offs = offs;
	this.varType = varType;
	this.prevVar = undefined;
	this.curVar = undefined;
	this.lastChange = undefined;
	this.valueStr = undefined;
	
	switch(varType) {
		case "int32":
		case "float32":
		case "uint32":
		case "pointer":
			this.varSize = 4;
		break;
		case "int64":
		case "uint64":
		case "float64":
			this.varSize = 8;
		break;
		default:
			console.log("WatchPoint(): invalid varType", varType);
	}
}

function arraysEqual(arr1, arr2) {
	return (arr1.length == arr2.length && arr1.every(function(u, i) { return u === arr2[i]; }));
}

function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

function preZero(str, num) {
	var len = str.length;
	for (var i = 0; i < num-len; i++)
		str = "0"+str;
	return str;
}

WatchPoint.prototype.update = function() {
	var self = this;
	reqMem(this.offs, 4, function(mem) {

			// compare
			var equal = false;
			
			if (self.curVar != undefined && arraysEqual(self.curVar, mem.data))
				equal = true;

			if (!equal) {
				self.prevVar = self.curVar;
				self.curVar = mem.data;
				self.lastChange = new Date();
				self.buildValueStr();
				self.wlist.pointChanged(this);
			}
		});
}

WatchPoint.prototype.buildValueStr = function() {
	var dview = new DataView((new Uint8Array(this.curVar)).buffer);

	switch (this.varType) {
		case "float32":
			this.valueStr = new String(dview.getFloat32(0, true));
		break;
		case "float64":
			this.valueStr = new String(dview.getFloat64(0, true));
		break;
		case "int32":
			this.valueStr = new String(dview.getInt32(0, true));
		break;
		case "uint32":
			this.valueStr = new String(dview.getUint32(0, true));
		break;
		case "int64":
			this.valueStr = new String(dview.getInt64(0, true));
		break;
		case "uint64":
			this.valueStr = new String(dview.getUint32(0, true));
		break;
		case "pointer":
			this.valueStr = dview.getUint32(0, true).toString(16);
		break;
	}
}

function WatchPointsView() {
	this.element = document.createElement("table");
	this.list = new WatchList();

	var self = this;
	this.list.onchange = function(p) {
		self.update();
	}

	var row = document.createElement("tr");
	this.element.appendChild(row);
	var col;
	
	// address
	col = document.createElement("th");
	col.innerHTML = "Address";
	col.style.width = "58px";
	col.style.textAlign = "left";
	row.appendChild(col);
	// type
	col = document.createElement("th");
	col.innerHTML = "Type";
	col.style.width = "58px";
	col.style.textAlign = "left";
	row.appendChild(col);
	// value
	col = document.createElement("th");
	col.innerHTML = "Value";
	col.style.width = "420px";
	col.style.textAlign = "left";
	row.appendChild(col);

	this.list.run();
}

WatchPointsView.prototype.update = function() {
	for (i in this.list.vars) {
		var row = this.element.getElementsByClassName("wp"+i)[0];
		var curVar = this.list.vars[i];

		if (!row) {
			// doesn't exist yet, create new row
			row = document.createElement("tr");
			row.classList.add("wp"+curVar.id);

			// address
			var col = document.createElement("td");
			col.innerHTML = "addr";
			row.appendChild(col);
			// type
			col = document.createElement("td");
			col.innerHTML = "type";
			row.appendChild(col);
			// value
			col = document.createElement("td");
			col.innerHTML = "value";
			row.appendChild(col);

			this.element.appendChild(row);
		}

		var cols = row.getElementsByTagName("td");

		cols[0].innerHTML = preZero(curVar.offs.toString(16), 8); 
		cols[1].innerHTML = curVar.varType; 
		cols[2].innerHTML = curVar.valueStr; 
	}
}

WatchPointsView.prototype.addPoint = function(offs, varType) {
	this.list.addPoint(offs, varType);
	this.update();
}


function WatchList() {
	// list of memory offsets being watched
	this.vars = [];
	this.interval = 100; // ms delay between updates
}

WatchList.prototype.addPoint = function(offs, varType) {
	var w = new WatchPoint(this, this.vars.length, offs, varType);
	this.vars.push(w);
	//console.log("watchpoint added", w);
}

WatchList.prototype.pointChanged = function(p) {
	this.onchange(p);
}

WatchList.prototype.run = function() {
	// run loop
	this.update();
}

WatchList.prototype.update = function() {

	for (i in this.vars) {
		this.vars[i].update();
	}

	var self = this;
	setTimeout(function() { self.update(); }, this.interval);
}

function VMemRange(offs, size) {
	this.size = size;
	this.data = [];
	this.offs = offs;
	this.curRow = 0;
	this.numRows = 16;
}

VMemRange.prototype.viewStartAddr = function() {
	return this.offs + this.curRow * 16;
}

VMemRange.prototype.viewEndAddr = function() {
	return this.offs + this.curRow * 16 + this.numRows;
}

/*function MemRange(offs, size, cb) {
	this.size = size;
	this.data = [];
	this.offs = offs;
	this.curRow = 0;
	this.interval = 500;
	this.cb = cb;
		
	console.log("new memrange", offs.toString(16), (size+offs).toString(16));

	this.update();
}

MemRange.prototype.update = function() {
	var self = this;

	reqMem(this.offs, this.size, function(mem) {
		for (var i = 0; i < self.size; i++) {
			self.data[this.offs+i] = mem[i];
		}

		self.cb(this);
	});

	setTimeout(function() { self.update(); }, this.interval);
}*/

function MemHandler(hView) {
	this.hView = hView;
	this.data = [];
	this.interval = 500;
	this.minInterval = 100;
	this.offs = undefined;
	this.size = undefined;
	this.lastReq = new Date();

	this.update();
}

MemHandler.prototype.loadAreaAround = function(addr) {
	var self = this;
	// select big enough area for hexview
	/*var mem = new MemRange(addr-this.hView.pageSize, this.hView.pageSize*2, function() {
	});
	this.memRanges.push(mem);*/

	this.offs = addr-this.hView.pageSize;
	this.size = this.hView.pageSize*2;

	// quick request
	this.reqData();
}

MemHandler.prototype.update = function() {
	var self = this;

	if (this.offs != undefined) {
		this.reqData();
	}

	setTimeout(function() { self.update(); }, this.interval);
}

MemHandler.prototype.reqData = function() {
	var self = this;
	var now = new Date();

	if (this.offs != undefined && now-this.lastReq >= this.minInterval) {
		this.lastReq = now;

		reqMem(this.offs, this.size, function(mem) {
			for (var i = 0; i < mem.data.length; i++) {
				self.data[mem.offs+i] = mem.data[i];
			}
		
			self.hView.memUpdate();
		});
	}
}

/*MemHandler.prototype.getRange = function(offs, size) {
	var curData = [];
	var start = offs;
	var end = offs+size;

	while (start != end) {
		var foundOption = false;
		for (i in this.memRanges) {
			var c = this.memRanges[i];

			var cStart = c.offs;
			var cEnd = c.offs+c.size;

			if (cStart >= end || cEnd < start)
				continue; // out of range
			foundOption = true;

			var rStart = start, rEnd = end;

			if (rEnd > cEnd)
				rEnd = cEnd;

			var startDist = rStart-cStart;
			var dist = rEnd-rStart;

			// copy data
			for (var x = 0; x < rEnd-rStart; x++) {
				curData.push(c.data[startDist+x]);
			}

			start += dist;
		}

		if (!foundOption)
			break;
	}

	if (start != end)
	{
		console.log("didn't get everything", start, end);
		return null;
	}

	return curData;
}*/

function HexView(cols, rows, mem) {
	var self = this;
	this.width = cols;
	this.height = rows;
	this.pageSize = cols*rows;

	this.mem = new MemHandler(this);
	
	this.element = document.createElement("div");	
	this.element.setAttribute('tabindex', 1); // make focusable

	// key events
	this.element.onkeydown = function(e) {
		switch (e.keyCode) {
			case 40: // arrow down
				self.moveCursor(0, 1);
			break;
			case 38: // arrow up
				self.moveCursor(0, -1);
			break;
			case 39: // arrow right
				self.moveCursor(1, 0);
			break;
			case 37: // arrow left
				self.moveCursor(-1, 0);
			break;
			case 33: // page up
				self.goToAddr(self.realOffs-self.pageSize);	
			break;
			case 34: // page down
				self.goToAddr(self.realOffs+self.pageSize);	
			break;
		}

		self.updateMarks();
	}

	this.addrLen = 8;

	this.realOffs = undefined;

	this.cursorX = 0;
	this.cursorY = 0;

	this.build();
}

HexView.prototype.moveCursor = function(x, y) {
	this.cursorX += x;

	if (this.cursorX < 0) {
		this.cursorX += this.width;
	} else if (this.cursorX > this.width-1) {
		this.cursorX -= this.width;	
	}

	this.cursorY += y;

	// check whether we need to move the whole frame
	if (this.cursorY < 0) {
		this.goToAddr(this.realOffs-this.width);	
	} else if (this.cursorY > this.height-1) {
		this.goToAddr(this.realOffs+this.width);	
	}

	this.cursorY = clamp(this.cursorY, 0, this.height-1);
}

HexView.prototype.goToAddr = function(addr) {
	var addrAligned = addr - addr%0x10;
	this.realOffs = addrAligned;
	this.mem.loadAreaAround(addr);
}

HexView.prototype.memUpdate = function() {
	this.update();
}

HexView.prototype.build = function() {
	var tbl = document.createElement("table");
	this.element.appendChild(tbl);

	// style
	tbl.style.border = "solid white 1px"

	for (var y = 0; y < this.height; y++) {
		var row = document.createElement("tr")
		tbl.appendChild(row)
		
		// add address
		var field = document.createElement("td")
		field.innerHTML = preZero((y*16).toString(16), 8)
		row.appendChild(field)
		field.classList.add("fr"+y);
		
		// spacer
		var sp = document.createElement("td")
		sp.innerHTML = "|"
		row.appendChild(sp)
		
		// add hex cells
		for (var x = 0; x < this.width; x++) {
			var cell = document.createElement("td")
			cell.classList.add("hc"+x+"_"+y);
			row.appendChild(cell)
			
			cell.innerHTML = "XX"
		}
		
		// spacer
		var sp = document.createElement("td")
		sp.innerHTML = "|"
		row.appendChild(sp)
		
		// add ascii cells
		for (var x = 0; x < 16; x++) {
			var cell = document.createElement("td")
			cell.classList.add("ac"+x+"_"+y);
			row.appendChild(cell)
			
			cell.innerHTML = "_"
		}
	}
}

// only update colors and style of cells
HexView.prototype.updateMarks = function() {
	// draw cursor
	for (var y = 0; y < this.height; y++) {
		for (var x = 0; x < this.width; x++) {
			var isCursor = this.cursorX == x && this.cursorY == y;

			var hCell = this.element.getElementsByClassName("hc"+x+"_"+y)[0]; // hex
			var aCell = this.element.getElementsByClassName("ac"+x+"_"+y)[0]; // ascii

			// cursor
			// style
			if (isCursor)
			{
				hCell.style.backgroundColor = "blue";
				aCell.style.backgroundColor = "blue";
			}
			else
			{
				hCell.style.backgroundColor = "";
				aCell.style.backgroundColor = "";
			}
		}
	}
}

HexView.prototype.update = function() {
	if (this.realOffs == undefined)
		return; // can't progress without defined offset

	for (var y = 0; y < this.height; y++) {
		for (var x = 0; x < this.width; x++) {
			var isCursor = this.cursorX == x && this.cursorY == y;
			var absOffs = this.realOffs+16*y+x;

			// address
			var field = this.element.getElementsByClassName("fr"+y)[0];
			field.innerHTML = preZero((this.realOffs+y*16).toString(16).toUpperCase(), 8)
			
			// hex cell
			var cell = this.element.getElementsByClassName("hc"+x+"_"+y)[0];

			var val = this.mem.data[absOffs];
		
			if (val == undefined)
				cell.innerHTML = "XX"
			else
				cell.innerHTML = preZero(val.toString(16).toUpperCase(), 2);

			// ascii cell
			var cell = this.element.getElementsByClassName("ac"+x+"_"+y)[0];
			
			var c;
			if (val == undefined)
				c = "_";
			else if (val < 0x20 || val > 0x7f)
				c = "."
			else
				c = String.fromCharCode(val)
			cell.innerHTML = c
		}
	}

	this.updateMarks();
}

var netEvents = [];
var curToken = 0;

function getToken() {
	return curToken++;
}

function reqNetEvent(cmd, data, cb) {
	var msgObj = {};
	msgObj.token = getToken();
	msgObj.cmd = cmd;
	msgObj.data = data;
	
	netEvents[msgObj.token] = {
		//msg: msgObj,
		cb: cb
	};

	ws.send(JSON.stringify(msgObj));
}	

function reqMemMaps(cb) {
	reqNetEvent("reqmaps", {}, cb);
}

function reqMem(offs, size, cb) {
	reqNetEvent("reqmem", {offs: offs, size: size}, cb);
}

function onMsg(msg) {
	if (netEvents[msg.token] != undefined) {
		// call cb of registered event handler
		var cb = netEvents[msg.token].cb;
		netEvents[msg.token] = undefined; // unregister event
		cb(msg.data); // pass data to callback
	} else {
		console.log("invalid token:", msg.cmd, msg.token);
	}
}

function init() {
	var ctx = document.getElementById("content");

	// set styles
	document.body.style.fontFamily = "monospace";
	
	var hView = new HexView(16, 20);
	document.getElementById("hviewframe").appendChild(hView.element);

	// connect to server
	ws = new WebSocket("ws://127.0.0.1:8888");

	// ws callbacks
	ws.onopen = function() {
		console.log("connected");

		/*reqMemMaps(function(e) {
			console.log("mem maps", e);
		});
		reqMem(0x00da82d4, 4, function(e) {
			console.log("got memory", e);
		});*/

		hView.goToAddr(0x400000-50);
	}

	ws.onerror = function(error) {
		console.log("ws error", error);
	}

	ws.onclose = function(e) {
		console.log("close due to", e);
	}

	ws.onmessage = function(msg) {
		// parse json, call event
		msgObj = JSON.parse(msg.data);
		onMsg(msgObj);
	}

	
	var wlist = new WatchPointsView();

	wlist.addPoint(0x00da82d4, "float32");
	wlist.addPoint(0x00da82d0, "float32");
	wlist.addPoint(0xe523d44, "pointer");

	document.getElementById("wpointsframe").appendChild(wlist.element);
}
