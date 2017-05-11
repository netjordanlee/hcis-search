var Signal = signals.Signal;

var ctrlDown = false; //TODO: Move to a better place

window.addEventListener("load", function(evt) {
	
	document.addEventListener("keydown", function(evt) {
		if(evt.keyCode == 17) { ctrlDown = true; return; }
		if(ctrlDown && [67,86,88].includes(evt.keyCode)) { return; } //Cut, Copy and Paste
		ui.search.focus();
		//TODO: Scroll to top
	});

	document.addEventListener("keyup", function(evt) {
		if(evt.keyCode == 17) { ctrlDown = false; }
		if(evt.keyCode == 27) { evt.preventDefault(); ui.search.clear(); ui.search.focus(); } //ESC
		if(evt.keyCode == 192) { evt.preventDefault(); ui.search.focus(); } //GRAVE/TILDE
	});

	db.onDownloadBegin.add(ui.spinner.show);
	db.onDownloadComplete.add(ui.spinner.hide);
	db.onDownloadComplete.add(db.parse);

	db.onQuery.add(ui.spinner.show);
	db.onQuery.add(ui.results.clear);
	db.onQueryComplete.add(ui.results.show);

	ui.search.onSubmit.add(search);
	ui.search.onUpdate.add(ui.spinner.show);
	//ui.search.onUpdate.add(ui.results.clear); // Breaks spinner

	ui.results.onUpdate.add(ui.spinner.hide);

	db.download("./db.min.xml");
});

function search(query) {
	// try {
		db.query(query);
	// } catch (error) {
		// ui.results.error(error);
	// }
}

function bmh(haystack, needle) {
	// Boyer-Moore-Horspool search
	haystack = haystack.toUpperCase();
	needle = needle.toUpperCase();

	if (needle.length < 2) {
		return -1;
	}

	var badMatchTable = {};
	var maxOffset = haystack.length - needle.length;
	var offset = 0;
	var last = needle.length - 1;
	var scan;

	// Generate the bad match table, which is the location of offsets
	// to jump forward when a comparison fails
	Array.prototype.forEach.call(needle, function(char, i) {
		badMatchTable[char] = last - i;
	});

	// Now look for the needle
	while (offset <= maxOffset) {
		// Search right-to-left, checking to see if the current offset at
		// needle and haystack match.  If they do, rewind 1, repeat, and if we
		// eventually match the first character, return the offset.
		for (scan = last; needle[scan] === haystack[scan + offset]; scan--) {
			if (scan === 0) {
				return offset;
			}
		}

		offset += badMatchTable[haystack[offset + last]] || last;
	}

	return -1;
}

////////////////////////////////

var ui = {};

ui.search = document.getElementById('search');
ui.search.chk_match_all = document.getElementById('chk-match-all');
ui.search.chk_match_phrase = document.getElementById('chk-match-phrase');

ui.results = document.getElementById('output');
ui.results.error_message = (function(){var a=document.getElementById('error');a.remove();return a;})();

ui.results.error = function (message) {
	ui.results.error.show();
	document.getElementById("error-text").textContent = message;
}

ui.results.error.show = function () {
	if(!ui.results.error_message.__self) {
		ui.results.error_message.__self = ui.container.appendChild(ui.results.error_message);
	}
}

ui.results.error.hide = function () {
	if(ui.results.error_message.__self) {
		ui.results.error_message.__self.remove();
	}
}

ui.spinner = (function(){var a=document.getElementById('loading');a.remove();return a;})(); //It works, don't ask
ui.container = document.getElementById('content');

ui.nav = {
	btn_prev : document.getElementById('btn-prev'),
	btn_next : document.getElementById('btn-next'),
	pages : document.getElementById('combo-pages')
};

/**************************************************************/

ui.spinner.show = function () {
	if(!ui.spinner.__self) {
		ui.spinner.__self = ui.container.appendChild(ui.spinner);
	}
};

ui.spinner.hide = function () {
	if(ui.spinner.__self) {
		ui.spinner.__self.remove();
		ui.spinner.__self = null;
	}
};

/**************************************************************/

ui.search.onUpdate = new Signal();
ui.search.onSubmit = new Signal();

ui.search.submit = function () {
	ui.search.cancel();
	if(ui.search.value.length > 1) {
		ui.search.onUpdate.dispatch();
		ui.search.timeout = setTimeout("ui.search.onSubmit.dispatch(ui.search.value);", 666);
	}
};

ui.search.cancel = function () { clearTimeout(ui.search.timeout); };

ui.search.clear = function () {
	ui.search.value = "";
	ui.search.onUpdate.dispatch();
	ui.search.submit;
};

ui.search.addEventListener("keyup", function(evt) {
	if(evt.keyCode == 27) { ui.search.clear(); }
	ui.search.submit();
});

ui.search.chk_match_phrase.addEventListener("change", function(evt) {
	ui.search.submit();
});

ui.search.chk_match_all.addEventListener("change", function(evt) {
	ui.search.submit();
});

/**************************************************************/

ui.results.onUpdate = new Signal();

ui.results.show = function (page) {
	if(typeof page === "undefined") page = 0;

	for (var i = 0; i < 10; i++) {
		var index = db.query.results[i].index;
		ui.results.appendChild(new ResultCard(db.record[index]));
	}

	ui.results.onUpdate.dispatch();
};

ui.results.clear = function () {
	// JavaScript black magic, clearing innerHTML is very slow compared to looping through and removing each child?
	while(ui.results.lastChild) {
		ui.results.removeChild(ui.results.lastChild);
	}

	ui.results.onUpdate.dispatch();
};

/**************************************************************/

ui.nav.btn_prev.addEventListener("onclick", function(evt){
	
});

ui.nav.btn_next.addEventListener("onclick", function(evt){
	
});

ui.nav.pages.addEventListener("onchange", function(evt){
	
});

////////////////

var db = {};

db.record = [];

db.onDownloadBegin = new Signal();
db.onDownloadComplete = new Signal();
db.onQuery = new Signal();
db.onQueryComplete = new Signal();

db.download = function(url) {
	var xmlData;
	var xhttp;
	if ('ActiveXObject' in window) {
		xhttp = new ActiveXObject("Microsoft.XMLHTTP"); //IE w/ FS Access
	} else if (window.XMLHttpRequest) {
		xhttp = new XMLHttpRequest();
	} else {
		console.log("Browser does not support XMLHTTPRequest");
	}

	xhttp.onreadystatechange = function () {
		if(xhttp.readyState == 4) {
			if(xhttp.status == 200 || xhttp.status == 0) {
				//HTTP OK or 0 for local fs
				db.onDownloadComplete.dispatch(xhttp.responseText);
			} else {
				console.log("Unable to download data, returned status code " + xhttp.status);
			}
		}
	}

	xhttp.open("GET", url, true);
	xhttp.send();
};

db.parse = function(xmlData) {
	console.log(xmlData);
	var xmlDoc;
	try {
		var parser = new DOMParser();
		xmlDoc = parser.parseFromString(xmlData.replace(/^\s+|\s+$/g, ''), "text/xml").getElementsByTagName('entry');
		xmlData = null;
	} catch (e) {
		console.log(e);
		return;
	}

	for (var i = 0; i < xmlDoc.length; i++) {
		db.record.push(new Record(
			xmlDoc[i].getElementsByTagName("LHD")[0].textContent,
			xmlDoc[i].getElementsByTagName("Cerner")[0].textContent,
			xmlDoc[i].getElementsByTagName("LocationCode")[0].textContent,
			xmlDoc[i].getElementsByTagName("Description")[0].textContent,
			xmlDoc[i].getElementsByTagName("AddressLocation")[0].textContent,
			xmlDoc[i].getElementsByTagName("PhoneNumber")[0].textContent,
			xmlDoc[i].getElementsByTagName("Sector")[0].textContent,
			xmlDoc[i].getElementsByTagName("ORG")[0].textContent,
			xmlDoc[i].getElementsByTagName("CostCentreCode")[0].textContent,
			xmlDoc[i].getElementsByTagName("EntityCode")[0].textContent,
			xmlDoc[i].getElementsByTagName("INST")[0].textContent,
			xmlDoc[i].getElementsByTagName("Other")[0].textContent
			)
		);
	}
};

db.query = function(query) {
	db.onQuery.dispatch();

	db.query.results = [];
	var keyword = [query];
	keyword.concat(query.trim().split(' '));

	if(keyword.length > 8) {
		throw "Maximum of 8 keywords";
	}

	for (var i = 0; i < db.record.length; i++) {
		var recordScore = 0;
		for (var k = 0; k < keyword.length; k++) {
			var keywordScore = recordScore;

			keywordScore = bmh(db.record[i].LHD, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.1)) : (keywordScore);
			keywordScore = bmh(db.record[i].cerner, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.1)) : (keywordScore);
			keywordScore = bmh(db.record[i].locationCode, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 1)) : (keywordScore);
			keywordScore = bmh(db.record[i].description, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.5)) : (keywordScore);
			keywordScore = bmh(db.record[i].addressLocation, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.7)) : (keywordScore);
			keywordScore = bmh(db.record[i].phoneNumber, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 1)) : (keywordScore);
			keywordScore = bmh(db.record[i].sector, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.1)) : (keywordScore);
			keywordScore = bmh(db.record[i].ORG, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.1)) : (keywordScore);
			keywordScore = bmh(db.record[i].costCentreCode, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 1)) : (keywordScore);
			keywordScore = bmh(db.record[i].entityCode, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.1)) : (keywordScore);
			keywordScore = bmh(db.record[i].INST, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.1)) : (keywordScore);
			keywordScore = bmh(db.record[i].other, keyword[k]) > -1 ? (keywordScore + (keyword[k].length * 0.1)) : (keywordScore);

			keywordScore = (k==0) ? keywordScore*10 : keywordScore; // If match phrase

			if(keywordScore == recordScore && ui.search.chk_match_all.checked) {
				keywordScore = 0;
				break;
			}

			recordScore += keywordScore;
		}

		if(recordScore > 0) {
			db.query.results.push({index:i, score:recordScore});
		}
	}

	if(db.query.results.length == 0) throw "No results";

	db.query.results.sort(function(a,b) {
		if(a.score === b.score) return 0;
		return (a.score > b.score) ? -1 : 1;
	});


	db.onQueryComplete.dispatch();
};

db.query.results = [];

function Record(healthDistrict, cerner, locationCode, description, addressLocation, 
	phoneNumber, sector, org, costCentreCode, entityCode, inst, other) {
	this.LHD = healthDistrict;
	this.cerner = cerner;
	this.locationCode = locationCode;
	this.description = description;
	this.addressLocation = addressLocation;
	this.phoneNumber = phoneNumber;
	this.sector = sector;
	this.ORG = org;
	this.costCentreCode = costCentreCode;
	this.entityCode = entityCode;
	this.INST = inst;
	this.other = other;
};

function ResultCard(record) {
	var htmlResultCard;
	htmlResultCard = '<table>' +
                     '<tbody>';

    // If entry is null/empty/whitespace add hide class, else add show class (show is an empty class)
    htmlResultCard += 	String.format('<tr class="{1}"><td>LHD:</td><td>{0}</td></tr>', 					record.LHD.replace(/\n/g, "<br />"), 				(record.LHD.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1}"><td>Cerner:</td><td>{0}</td></tr>', 					record.cerner.replace(/\n/g, "<br />"), 			(record.cerner.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1}"><td>Code:</td><td>{0}</td></tr>', 					record.locationCode.replace(/\n/g, "<br />"), 		(record.locationCode.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1}"><td>Description:</td><td>{0}</td></tr>', 			record.description.replace(/\n/g, "<br />"), 		(record.description.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1}"><td>Address:</td><td>{0}</td></tr>', 				record.addressLocation.replace(/\n/g, "<br />"), 	(record.addressLocation.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1}"><td>Contact:</td><td>{0}</td></tr>', 				record.phoneNumber.replace(/\n/g, "<br />"), 		(record.phoneNumber.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1} hidden"><td>Sector:</td><td>{0}</td></tr>', 			record.sector.replace(/\n/g, "<br />"), 			(record.sector.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1} hidden"><td>ORG:</td><td>{0}</td></tr>', 				record.ORG.replace(/\n/g, "<br />"), 				(record.ORG.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1} hidden"><td>CostCentreCode:</td><td>{0}</td></tr>', 	record.costCentreCode.replace(/\n/g, "<br />"), 	(record.costCentreCode.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1} hidden"><td>EntityCode:</td><td>{0}</td></tr>', 		record.entityCode.replace(/\n/g, "<br />"), 		(record.entityCode.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1} hidden"><td>INST:</td><td>{0}</td></tr>', 			record.INST.replace(/\n/g, "<br />"), 				(record.INST.isNullOrEmpty()) ? "hide" : "show") +
    					String.format('<tr class="{1}"><td>Other:</td><td>{0}</td></tr>', 					record.other.replace(/\n/g, "<br />"), 				(record.other.isNullOrEmpty()) ? "hide" : "show");

    //Close Card
    // htmlResultCard += '<tr><td></td><td>' + '<a class="extra-item search-description" title="Search Description in Google Search..." href=\"http:\/\/google.com/search?q=' + encodeURIComponent(db[k].Description) + '\" target=\"_blank\">Search More...</a>' + '<a class="extra-item map-address" title="Search Address in Google Maps..." href=\"http:\/\/maps.google.com/maps?q=' + encodeURIComponent(db[k].AddressLocation) + '\" target=\"_blank\">Open Map...</a>' + '<a class="extra-item raise-ticket" title="Report a Problem or Request to Update Entries For This Contact..." href=\"#0\" onclick=\"SendTroubleTicket(' + k + ')\">Update Details...</a>' + '</td></tr>' + '</tbody>' + '</table>' + '</li>' + '<br \/><hr class="hr-styling"\/><br \/>';

    htmlResultCard += '<tr><td></td><td>' +
                      '<br/>' +
                      // '<a class="extra-item search-description shade" title="Search Description in Google Search..." href=\"http:\/\/google.com/search?q=' + encodeURIComponent(db[k].Description) + '\" target=\"_blank\">More Info</a>' +
                      // '<a class="extra-item map-address shade" title="Search Address in Google Maps..." href=\"http:\/\/maps.apple.com/maps?q=' + encodeURIComponent(db[k].AddressLocation) + '\" target=\"_blank\">View Map</a>' +
                      // '<a class="extra-item raise-ticket shade" title="Report a Problem or Request to Update Entries For This Contact..." href=\"#0\" onclick=\"SendTroubleTicket(' + k + ')\">Update Details</a>' +
                      '</td></tr>' +
                      '</tbody>' +
                      '</table>';

    var resultCard = document.createElement("li");
    resultCard.className = "shade";
    resultCard.innerHTML = htmlResultCard;
    return resultCard;
}