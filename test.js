var mem;
var tbl;

function MemRange(offs, size) {
	this.size = size;
	this.data = [];
	this.offs = offs;
	this.curRow = 0;
	
	for (var i = 0; i < size; i++)
		this.data.push(0);
}

function createHexView()
{
	var div = document.createElement("div")
	div.setAttribute('tabindex', 1);
	div.onkeydown =  function(e) {
		if (e.keyCode == 40)
		{
			mem.curRow++;
			tblSetMem(tbl, mem);
		}
	}
	
	window.addEventListener('scroll', function(e) {
		console.log("scroll", e);
	});
	
	var tbl = document.createElement("table")
	div.appendChild(tbl)
	
	for (var y = 0; y < 20; y++) {
		var row = document.createElement("tr")
		tbl.appendChild(row)
		
		// add address
		var field = document.createElement("td")
		field.innerHTML = "0x"+(y*16).toString(16)
		row.appendChild(field)
		field.id = "fr"+y
		
		// spacer
		var sp = document.createElement("td")
		sp.innerHTML = "|"
		row.appendChild(sp)
		
		// add hex cells
		for (var x = 0; x < 16; x++) {
			var cell = document.createElement("td")
			cell.id = "hc"+x+"_"+y
			row.appendChild(cell)
			
			cell.innerHTML = "00"
		}
		
		// spacer
		var sp = document.createElement("td")
		sp.innerHTML = "|"
		row.appendChild(sp)
		
		// add ascii cells
		for (var x = 0; x < 16; x++) {
			var cell = document.createElement("td")
			cell.id = "ac"+x+"_"+y
			row.appendChild(cell)
			
			cell.innerHTML = "."
		}
	}
	
	return div
}

function tblSetMem(tbl, mem) {
	for (var y = 0; y < 20; y++) {
		var virtY = mem.curRow+y;
		for (var x = 0; x < 16; x++) {
			// address
			var field = document.getElementById("fr"+y)
			field.innerHTML = (mem.offs+virtY*16).toString(16)
			
			// hex cell
			var cell = document.getElementById("hc"+x+"_"+y)
			var val = mem.data[16*virtY+x]
			
			if (val <= 0xf)
				cell.innerHTML = "0"+val.toString(16)
			else
				cell.innerHTML = val.toString(16)
			
			// ascii cell
			var cell = document.getElementById("ac"+x+"_"+y)
			
			var c;
			if (val < 0x20 || val > 0x7f)
				c = "."
			else
				c = String.fromCharCode(val)
			cell.innerHTML = c
		}
	}
}

function init()
{

	mem = new MemRange(0x00400000, 0x1000);

	for (var i = 0; i < 0x1000; i++) {
		mem.data[i] = Math.floor(Math.random()*255)
	}



	tbl = createHexView()
	document.body.appendChild(tbl)
	
	function doStuff() {
		tblSetMem(tbl, mem)
		//mem.curRow++;
		setTimeout(doStuff, 1000)
	}

	doStuff();

}
