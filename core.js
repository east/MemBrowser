var ws;

var winToken = 0;

function newWinToken() { return winToken++; }

function WatchPoint(wlist, offs, varType, id) {
	this.wlist = wlist;
	this.offs = offs;
	this.varType = varType;
	this.prevVar = undefined;
	this.curVar = undefined;
	this.lastChange = undefined;
	this.valueStr = undefined;
	this.id = id;
	
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
	this.element = document.createElement("div");

	this.table = document.createElement("table");
	this.element.appendChild(this.table);

	this.list = new WatchList();

	var self = this;
	this.list.onchange = function(p) {
		self.update();
	}

	var row = document.createElement("tr");
	this.table.appendChild(row);
	var col;

	// checkbox
	var c = document.createElement("input");
	c.type = "checkbox";
	c.onclick = function() {
		var cbs = self.table.getElementsByClassName("wcbox");

		if (c.checked) {
			for (i in cbs) {
				cbs[i].checked = true;
			}
		}
		else {
			for (i in cbs) {
				cbs[i].checked = false;
			}
		}
	}

	col = document.createElement("th");
	col.innerHTML = "";
	col.style.width = "";
	col.style.textAlign = "left";
	col.appendChild(c);
	row.appendChild(col);
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

	// input field
	var input = document.createElement("input");
	input.type = "text";
	input.style.backgroundColor = "#000";
	input.style.color = "#fff";
	input.style.fontSize = "8pt";
	input.style.width = "100px";
	this.element.appendChild(input);

	input.onkeydown = function(e) {
		if (e.keyCode == 13) {
			var ps = input.value.split(":");
			
			self.addPoint(parseInt(ps[1], 16), ps[0]);
		}
	}

	// delete button
	var del = document.createElement("input");
	del.type = "button";
	del.value = "Del Selection";
	del.style.fontSize = "8pt";
	del.style.backgroundColor = "#000";
	del.style.color = "#fff";
	this.element.appendChild(del);

	del.onclick = function() {
		self.delSelection();
	}

	this.list.run();
}

WatchPointsView.prototype.buildList = function() {

}

WatchPointsView.prototype.getSelection = function() {
	var selection = [];
	var b = this.table.getElementsByClassName("wcbox");

	for (var i = 0; i < b.length; i++) {
		if (b[i].checked)
			selection.push(b[i]);
	}

	return selection;
}

WatchPointsView.prototype.delSelection = function() {
	var sel = this.getSelection();

	for (var i = 0; i < sel.length; i++) {
		// remove selected vars from list
		this.list.removeId(sel[i].wId);
	}

	// clear table
	while (this.table.firstChild.nextSibling)
		this.table.removeChild(this.table.firstChild.nextSibling);


	this.update();
}

WatchPointsView.prototype.update = function() {
	for (var i = 0; i < this.list.vars.length; i++) {
		var row = this.table.getElementsByClassName("wp"+this.list.vars[i].id)[0];
		var curVar = this.list.vars[i];

		if (!row) {
			// doesn't exist yet, create new row
			row = document.createElement("tr");
			row.wId = this.list.vars[i].id;
			row.classList.add("wp"+this.list.vars[i].id);

			// checkbox
			var col = document.createElement("td");
			var c = document.createElement("input");
			c.type = "checkbox";
			c.classList.add("c"+i);
			c.classList.add("wcbox");
			c.wId = this.list.vars[i].id;
			col.appendChild(c);
			row.appendChild(col);
			
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

			this.table.appendChild(row);
		}

		var cols = row.getElementsByTagName("td");

		cols[1].innerHTML = preZero(curVar.offs.toString(16), 8); 
		cols[2].innerHTML = curVar.varType; 
		cols[3].innerHTML = curVar.valueStr; 
	}
}

WatchPointsView.prototype.addPoint = function(offs, varType) {
	switch (varType) {
		case "int32":
		case "float32":
		case "uint32":
		case "pointer":
		case "int64":
		case "uint64":
		case "float64":
		break;
		default:
			console.log("invalid vartype", varType);
			return;
	}
	this.list.addPoint(offs, varType);
	this.update();
}


function WatchList() {
	// list of memory offsets being watched
	this.vars = [];
	this.interval = 100; // ms delay between updates
}

WatchList.prototype.addPoint = function(offs, varType) {
	var w = new WatchPoint(this, offs, varType, newWinToken());
	this.vars.push(w);
}

WatchList.prototype.removeId = function(id) {
	for (i in this.vars) {
		if (this.vars[i].id == id) {
			this.vars.splice(i, 1);
			break;
		}
	}
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
			case 'M'.charCodeAt(0):
				self.markCurRow();
			break;
		}

		self.update(false);
	}

	this.rowMarks = [];

	this.addrLen = 8;

	this.realOffs = undefined;

	this.cursorX = 0;
	this.cursorY = 0;

	this.build();
}

HexView.prototype.getRowMarks = function(start, size) {
	var marks = [];
	for (i in this.rowMarks) {
		if (this.rowMarks[i] >= start && this.rowMarks[i] < start+size) {
			marks.push(this.rowMarks[i]);
		}
	}
	return marks;
}

HexView.prototype.markCurRow = function() {
	var offs = this.rowOffset();
	var i = this.rowMarks.indexOf(offs);

	if (i != -1)
		this.rowMarks.splice(i, 1); // unmark
	else
		this.rowMarks.push(this.rowOffset()); // mark
}

HexView.prototype.moveCursor = function(x, y, rel) {

	if (typeof rel != 'undefined' && rel != true) {
		// absolute
		this.cursorX = 0;
		this.cursorY = 0;
	}

	this.cursorX += x;

	if (this.cursorX < 0) {
		this.cursorX += this.width;
	} else if (this.cursorX > this.width-1) {
		this.cursorX -= this.width;	
	}

	this.cursorY += y;

	// check whether we need to move the whole frame
	if (this.cursorY < 0) {
		this.goToAddr(this.realOffs-this.width, false);	
	} else if (this.cursorY > this.height-1) {
		this.goToAddr(this.realOffs+this.width, false);	
	}

	this.cursorY = clamp(this.cursorY, 0, this.height-1);
}

HexView.prototype.goToAddr = function(addr, fixCursor) {
	var addrAligned = addr - addr%0x10;

	this.realOffs = addrAligned;

	if (fixCursor == undefined || fixCursor == true)
		this.moveCursor(addr-addrAligned, 0, false);

	this.mem.loadAreaAround(addr);
}

HexView.prototype.memUpdate = function() {
	this.update();
}

HexView.prototype.build = function() {
	var self = this;
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
		field.classList.add("addr");
		
		// spacer
		var sp = document.createElement("td")
		sp.innerHTML = "|"
		row.appendChild(sp)
		
		// add hex cells
		for (var x = 0; x < this.width; x++) {
			var cell = document.createElement("td")
			cell.classList.add("hc"+x+"_"+y);
			cell.classList.add("hc");
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
			cell.classList.add("ac");
			row.appendChild(cell)
			
			cell.innerHTML = "_"
		}
	}

	// infobox
	var row = document.createElement("tr");
	tbl.appendChild(row);
	var cell = document.createElement("td");
	cell.colSpan = "35";
	row.appendChild(cell);

	var label = document.createElement("label");
	label.classList.add("curOffs");

	label.innerHTML = "Offset: 0x00000000"

	cell.appendChild(label);

	// goto box
	row = document.createElement("tr");
	tbl.appendChild(row);
	cell = document.createElement("td");
	cell.colSpan = "35";
	row.appendChild(cell);

	var gotoEdit = document.createElement("input");

	gotoEdit.style.backgroundColor = "#000";
	gotoEdit.style.color = "#fff";
	gotoEdit.style.fontSize = "8pt";
	gotoEdit.type = "input";

	gotoEdit.onkeydown = function(e) {
		if (e.keyCode == 13) {
			var offs = parseInt(gotoEdit.value, 16);
			if (offs != NaN)
				self.goToAddr(offs);		
		}
	}

	cell.appendChild(gotoEdit);
}

HexView.prototype.cursorOffset = function() {
	return this.realOffs + this.cursorY*this.width + this.cursorX;
}

HexView.prototype.rowOffset = function() {
	return this.realOffs + this.cursorY*this.width;
}

// only update colors and style of cells and info box
/*HexView.prototype.updateMarks = function() {
	// info box
	var labelOffs = this.element.getElementsByClassName("curOffs")[0];
	labelOffs.innerHTML = "Offset: 0x"+preZero(this.cursorOffset().toString(16).toUpperCase(), 8);

	// draw cursor
	for (var y = 0; y < this.height; y++) {
		var adCell = this.element.getElementsByClassName("fr"+y)[0];
		adCell.style.backgroundColor = "";
		
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

	// row marks
	var rowMarks = this.getRowMarks(this.realOffs, this.pageSize);

	for (i in rowMarks) {
		var id = (rowMarks[i]-this.realOffs)/0x10;
		var cell = this.element.getElementsByClassName("fr"+id)[0];
		cell.style.backgroundColor = "blue";
	}
}*/

HexView.prototype.update = function(updData) {
	if (updData == undefined)
		updData = true;

	if (this.realOffs == undefined)
		return; // can't progress without defined offset

	// info box
	var labelOffs = this.element.getElementsByClassName("curOffs")[0];
	labelOffs.innerHTML = "Offset: 0x"+preZero(this.cursorOffset().toString(16).toUpperCase(), 8);


	var rowMarks = this.getRowMarks(this.realOffs, this.pageSize);
	// addresses
	var addrs = this.element.getElementsByClassName("addr");
	for (var i = 0; i < addrs.length; i++) {

		// style
		addrs[i].style.backgroundColor = "";
		// row marks
		for (var cur = 0; cur < rowMarks.length; cur++) {
			var id = (rowMarks[cur]-this.realOffs)/0x10;
			if (id == i)
				addrs[i].style.backgroundColor = "blue";
		}

		if (updData)
			addrs[i].innerHTML = preZero((this.realOffs+i*this.width).toString(16).toUpperCase(), 8);
	}

	// ascii & hex cells
	var hcells = this.element.getElementsByClassName("hc");
	var acells = this.element.getElementsByClassName("ac");
	for (var i = 0; i < hcells.length; i++) {
		var x = i%this.width;
		var y = Math.floor(i/this.width);
		var absOffs	= this.realOffs+i;
		var val = this.mem.data[absOffs];
		var hcell = hcells[i], acell = acells[i];
	
		// style
		var isCursor = this.cursorX == x && this.cursorY == y;

		if (isCursor) {
			hcell.style.backgroundColor = "blue";
			acell.style.backgroundColor = "blue";
		} else {
			hcell.style.backgroundColor = "";
			acell.style.backgroundColor = "";
		}

		// data
		if (!updData)
			continue;

		if (val == undefined)
			hcell.innerHTML = "XX"
		else
			hcell.innerHTML = preZero(val.toString(16).toUpperCase(), 2);

		var c;
		if (val == undefined)
			c = "_";
		else if (val < 0x20 || val > 0x7f)
			c = "."
		else
			c = String.fromCharCode(val)
		acell.innerHTML = c
	}
}

var netEvents = [];
var curNetToken = 0;

function getToken() {
	curNetToken = (curNetToken+1)%0xff;
	return curNetToken;
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

		hView.goToAddr(0x400000);
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

	document.getElementById("wpointsframe").appendChild(wlist.element);
}
