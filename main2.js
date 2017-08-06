var Signal = signals.Signal;

var scrollManager = {
	locked : false,
	lastPosition : 0
};

scrollManager.lock = function(timer){
	if(typeof timer !== "number"){ timer=1000; };
	setTimeout("scrollManager.locked=false;", timer);
	scrollManager.locked=true;
};

window.addEventListener("load", function(evt) {
	
	util.parseUrlVariables();

	document.addEventListener("keydown", function(evt) {
		//if(evt.keyCode == 17) { ctrlDown = true; return; }
		if(evt.ctrlKey || evt.metaKey) { return; }
		if(!evt.ctrlKey || !evt.metaKey) {
			ui.search.focus();
			ui.search.show();
		}
		window.scrollTo(0,0);
	});

	document.addEventListener("keyup", function(evt) {
		//if(evt.keyCode == 17) { evt.preventDefault(); ctrlDown = false; }
		//Escape
		if(evt.keyCode == 27) {
			evt.preventDefault();
			ui.search.clear();
			ui.search.focus();
			ui.search.show();
		}
	});

	window.addEventListener("scroll", function(evt){
		if(!scrollManager.locked && scrollManager.lastPosition < window.scrollY) {
			// Scrolled down the page
			ui.search.hide();
			scrollManager.lock(333);
		} else if(!scrollManager.locked) {
			// Scrolled up the page
			ui.search.show();
			scrollManager.lock(333);
		} else if(window.scrollY == 0) {
			// Fallback to ensure that scrolling to the top always expands search
			ui.search.show();
		}
		scrollManager.lastPosition = window.scrollY;
	});

	db.onDownloadBegin.add(ui.spinner.show);
	db.onDownloadComplete.add(ui.spinner.hide);
	db.onDownloadComplete.add(db.parse);

	ui.search.onSubmit.add(search);
	ui.search.onSubmit.add(util.parseUrlVariables);
	//ui.search.onSubmit.add(ui.results.clear);
	//ui.search.onSubmit.add(ui.spinner.show);
	ui.search.onUpdate.add(ui.search.btn_clear.toggle);
	ui.search.onUpdate.add(util.updateUrl);

	ui.search.onClear.add(ui.spinner.hide);

	db.onQuery.add(ui.results.clear);
	db.onQuery.add(ui.spinner.show);
	db.onQuery.add(ui.results.error.hide);

	db.onQueryComplete.add(ui.results.show);

	ui.results.onUpdate.add(ui.spinner.hide);
	ui.results.onUpdate.add(ui.results.highlight);
	ui.results.onClear.add(ui.spinner.hide);
	ui.results.onError.add(ui.spinner.hide);

	try {
		db.download("./db.min.xml");
	} catch (err) {
		switch(typeof(err)) {
			case "XHRException":
				ui.results.error.show(err.message);
				console.log(err);
				break;
			case "XHRNotSupportedException":
				ui.results.error.show(err.message);
				console.log(err);
				break;
			default:
				ui.results.error.show(err.message);
				console.log(err);
				break;
			}
	}

	if(window.location.get['q']) {
		ui.search.value = window.location.get['q'];
		ui.search.submit();
	}
});

function search(query) {
	try {
		db.query(query);
	} catch (error) {
		if(error instanceof BadQueryException) {
			ui.results.error.show("Please use a maximum of 8 keywords.");
		} else if(error instanceof NullResultsException) {
			ui.results.error.show("Unable to find what you're looking for, please check the spelling and try again.");
		} else {
			ui.results.error.show(error.stack);
			console.log(error);
		}
	}
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

var util = {};

util.sendShareEmail = function (record) {
	// Would be better to pull record properties from the Record object instead of the RecordCard
	// perhaps have RecordCard store a reference to pass on?
	if(record instanceof Record) {
		var sourceUrl = encodeURIComponent(String.format('{0}?q={1}&r={2}', (window.location.origin + window.location.pathname), ui.search.value, record.locationCode.hashCode()));
	    var subject = encodeURIComponent(String.format("{0} > {1} > {2}", document.title, ui.search.value.toUpperCase(), record.description));
	    var message = "";

	    message += 'Hello,%0D%0A%0D%0A';
	    message += String.format('%09{0} is located at {1}.%0D%0A', 
	    	encodeURIComponent(record.description), 
	    	encodeURIComponent(record.addressLocation));

	    message += String.format('%09They can be contacted at {0}.%0D%0A', 
	    	encodeURIComponent(record.phoneNumber));

	    message += String.format('%09Their {0} Cerner Code is {1} and they are part of the {2}.%0D%0A', 
	    	encodeURIComponent(record.cerner), 
	    	encodeURIComponent(record.locationCode), 
	    	encodeURIComponent(record.LHD));

		message += record.other.isNullOrEmpty() ? '' : String.format('%09Notes: {0}%0D%0A', 
			encodeURIComponent(record.other));

		message += String.format('%0D%0ASource: {0}%0D%0A', 
			sourceUrl);

	    window.location.href = String.format("mailto:?subject={0}&body={1}", subject, message);
	}
};

util.raiseUpdateTicket = function (record) {
	var recepient = "laith.serhan@health.nsw.gov.au";
	var subject = String.format("Trouble Ticket - {0}:{1}", (new Date()).yymmdd(), record.locationCode.hashCode());
	var message = String.format(
	'-----// In This Field, Make The Appropriate Changes To The Record. //-----%0D%0A%0D%0A' + 
	'LHD: {0}%0D%0A' + 
	'Cerner: {1}%0D%0A' + 
	'LocationCode: {2}%0D%0A' + 
	'Description: {3}%0D%0A' + 
	'AddressLocation: {4}%0D%0A' + 
	'PhoneNumber: {5}%0D%0A' + 
	'Sector: {6}%0D%0A' + 
	'ORG: {7}%0D%0A' + 
	'CostCentreCode: {8}%0D%0A' + 
	'EntityCode: {9}%0D%0A' + 
	'INST: {10}%0D%0A' + 
	'Other: {11}%0D%0A%0D%0A' + 
	'Comments: Your comments here...%0D%0A%0D%0A%0D%0A' + 
	'-----// DO NOT EDIT BELOW THIS LINE //-----%0D%0A%0D%0A' + 
	'LHD: {0}%0D%0A' + 
	'Cerner: {1}%0D%0A' + 
	'LocationCode: {2}%0D%0A' + 
	'Description: {3}%0D%0A' + 
	'AddressLocation: {4}%0D%0A' + 
	'PhoneNumber: {5}%0D%0A' + 
	'Sector: {6}%0D%0A' + 
	'ORG: {7}%0D%0A' + 
	'CostCentreCode: {8}%0D%0A' + 
	'EntityCode: {9}%0D%0A' + 
	'INST: {10}%0D%0A' + 
	'Other: {11}%0D%0A%0D%0A',
	encodeURIComponent(record.LHD), encodeURIComponent(record.cerner), 
	encodeURIComponent(record.locationCode), encodeURIComponent(record.description),
	encodeURIComponent(record.addressLocation), encodeURIComponent(record.phoneNumber), 
	encodeURIComponent(record.sector), encodeURIComponent(record.ORG),
	encodeURIComponent(record.costCentreCode), encodeURIComponent(record.entityCode), 
	encodeURIComponent(record.INST), encodeURIComponent(record.other));

	window.location.href = (String.format("mailto:{0}?subject={1}&body={2}", recepient, subject, message));
};

util.raiseMissingTicket = function () {
	var recepient = "laith.serhan@health.nsw.gov.au";
	var subject = String.format("Trouble Ticket - {0}:NEW", (new Date()).yymmdd());
	var message = String.format(
	'-----// In This Field, Fill Out What You Know About The Missing Record //-----%0D%0A%0D%0A' + 
	'LHD: %0D%0A' + 
	'Description: %0D%0A' + 
	'AddressLocation: %0D%0A' + 
	'PhoneNumber: %0D%0A' + 
	'Sector: %0D%0A' + 
	'ORG: %0D%0A' + 
	'Comments: %0D%0A%0D%0A');

	window.location.href = (String.format("mailto:{0}?subject={1}&body={2}", recepient, subject, message));
};

util.updateUrl = function () {
	var url = String.format('{0}?q={1}', (location.origin + location.pathname), encodeURIComponent(ui.search.value));
	history.replaceState({}, document.title, url)
};

util.parseUrlVariables = function() {
	var a = window.location.search.substr(1).split('&');
    if (a == "") return {};
    var b = {};
    for (var i = 0; i < a.length; ++i)
    {
        var p=a[i].split('=', 2);
        if (p.length == 1)
            b[p[0]] = "";
        else
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    window.location.get = b;
};

////////////////////////////////

var ui = {};

ui.search = document.getElementById('search');
ui.search.btn_clear = document.getElementById('btn-clear');
// ui.search.chk_match_all = document.getElementById('chk-match-all');
// ui.search.chk_match_phrase = document.getElementById('chk-match-phrase');

ui.results = document.getElementById('output');

ui.results.error = (function(){var a=document.getElementById('error');a.remove();return a;})();
ui.results.error.message = (function(){var a=document.createElement('p');a.id='error-text';ui.results.error.insertBefore(a,ui.results.error.lastChild);return a;})();

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
ui.search.onClear = new Signal();

ui.search.submit = function () {
	ui.search.cancel();
	ui.search.onUpdate.dispatch(ui.search.value);
	if(ui.search.value.length > 1) {
		ui.search.timeout = setTimeout("ui.search.onSubmit.dispatch(ui.search.value);", 666);
	} else if(ui.search.value.length == 0) {
		ui.search.onClear.dispatch();
	}
};

ui.search.cancel = function () { clearTimeout(ui.search.timeout); };

ui.search.clear = function () {
	ui.search.value = "";
	ui.search.onClear.dispatch();
	ui.search.onUpdate.dispatch(ui.search.value);
	//ui.search.submit;
};

ui.search.show = function () {
	document.getElementById("header").classList.remove("collapse");
}

ui.search.hide = function () {
	document.getElementById("header").classList.add("collapse");
}

ui.search.addEventListener("keyup", function(evt) {
	//if(ctrlDown || ctrlDown && [65,67,86,88].includes(evt.keyCode)) { return; } //Select All, Cut, Copy and Paste
	if(evt.ctrlKey || evt.metaKey) { return; } //Disable anything with ctrl pressed
	ui.spinner.show();
	ui.search.submit();
	window.location.pathname
});

ui.search.btn_clear.toggle = function(value) {
	if(value.length > 0) {
		ui.search.btn_clear.show();
	} else {
		ui.search.btn_clear.hide();
	}
}

ui.search.btn_clear.show = function() {
	ui.search.btn_clear.classList.remove('hide');
}

ui.search.btn_clear.hide = function() {
	ui.search.btn_clear.classList.add('hide');
}

ui.search.btn_clear.addEventListener("click", function(evt){
	ui.search.clear();
});

// ui.search.chk_match_phrase.addEventListener("change", function(evt) {
// 	ui.search.submit();
// });

// ui.search.chk_match_all.addEventListener("change", function(evt) {
// 	ui.search.submit();
// });

/**************************************************************/

ui.results.onUpdate = new Signal();
ui.results.onClear = new Signal();
ui.results.onError = new Signal();

ui.results.show = function (page) {
	if(typeof page === "undefined") page = 0;
	window.scrollTo(0,0);

	for (var i = 0; i < db.query.results.length; i++) {
		var index = db.query.results[i].index;
		var element = new ResultCard(db.record[index]);
		// var debugInfo = document.createElement("p");
		// debugInfo.textContent = JSON.stringify(db.query.results[i]);
		// element.appendChild(debugInfo);
		ui.results.appendChild(element);
	}

	ui.results.onUpdate.dispatch();
};

ui.results.clear = function () {
	// JavaScript black magic, clearing innerHTML is very slow compared to looping through and removing each child?
	while(ui.results.lastChild) {
		ui.results.removeChild(ui.results.lastChild);
	}

	ui.results.onClear.dispatch();
};

ui.results.highlight = function () {
	var hash = window.location.get['r'] ? window.location.get['r'] : window.location.hash.replace('#', '');
	var element = document.getElementById(hash);
	if(element) {
		window.scrollTo(0,element.offsetTop);
		element.parentElement.parentElement.style = 'border: 5px solid white';
	}
}

ui.results.error.show = function (message) {
	ui.results.error.message.innerHTML = message + "</br>";

	if(!ui.results.error.__self) {
		ui.results.error.__self = ui.container.appendChild(ui.results.error);
	}

	ui.results.onError.dispatch(message);
}

ui.results.error.hide = function () {
	if(ui.results.error.__self) {
		ui.results.error.__self.remove();
		ui.results.error.__self = null;
	}
}

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
		throw new XHRNotSupportedException();
	}

	xhttp.onreadystatechange = function () {
		if(xhttp.readyState == 4) {
			if(xhttp.status == 200 || xhttp.status == 0) {
				//HTTP OK or 0 for local fs
				if(xhttp.responseText.isNullOrEmpty()) {
					throw new XHRException("The request returned an empty respose.");
				} else {
					db.onDownloadComplete.dispatch(xhttp.responseText);
					return xhttp.responseText;
				}
			} else {
				throw new XHRException("The request returned failed with the stauts code " + xhttp.status);
			}
		}
	}

	xhttp.open("GET", url, true);
	xhttp.send();
};

db.parse = function(xmlData) {
	var xmlDoc;
	var parser = new DOMParser();
	xmlDoc = parser.parseFromString(xmlData.replace(/^\s+|\s+$/g, ''), "text/xml").getElementsByTagName('entry');
	xmlData = null;

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
	var keyword = [query.trim()];
	keyword = keyword.concat(query.trim().split(' '));

	if(keyword.length == 2) {
		/*	Performance hack: if keyword length is only 2...
		 	then k0 and k1 will always be the same, so...
		 	remove k1 to avoid searching same keyword twice */
		keyword = [keyword[0]];
	}

	for (var i = 0; i < keyword.length; i++) {
		if(keyword[i].length==1) {
			keyword.splice(i, 1); //Remove single character keywords for performance
		}
	}

	if(keyword.length > 9) {
		throw new BadQueryException("Maximum of 8 keywords");
	}

	for (var i = 0; i < db.record.length; i++) {
		var recordScore = 0;
		var hasMatchPhrase = false; 
		var hasMatchAll = true; // True until proven false

		for (var k = 0; k < keyword.length; k++) {
			var newScore = recordScore;

			newScore = bmh(db.record[i].LHD, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.1)) : (newScore);
			newScore = bmh(db.record[i].cerner, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.1)) : (newScore);
			newScore = bmh(db.record[i].locationCode, keyword[k]) > -1 ? (newScore + (keyword[k].length * 1)) : (newScore);
			newScore = bmh(db.record[i].description, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.5)) : (newScore);
			newScore = bmh(db.record[i].addressLocation, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.7)) : (newScore);
			newScore = bmh(db.record[i].phoneNumber, keyword[k]) > -1 ? (newScore + (keyword[k].length * 1)) : (newScore);
			newScore = bmh(db.record[i].sector, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.1)) : (newScore);
			newScore = bmh(db.record[i].ORG, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.1)) : (newScore);
			newScore = bmh(db.record[i].costCentreCode, keyword[k]) > -1 ? (newScore + (keyword[k].length * 1)) : (newScore);
			newScore = bmh(db.record[i].entityCode, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.1)) : (newScore);
			newScore = bmh(db.record[i].INST, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.1)) : (newScore);
			newScore = bmh(db.record[i].other, keyword[k]) > -1 ? (newScore + (keyword[k].length * 0.1)) : (newScore);

			// Corner-case k0 is always the entire query
			if(k==0 && newScore > recordScore){
				hasMatchPhrase = true;
			}

			if(k!=0 && recordScore == newScore) {
				hasMatchAll = false;
			}

			recordScore += newScore;
		}

		if(recordScore > 0) {
			db.query.results.push({index:i, score:recordScore, matchPhrase:hasMatchPhrase, matchAll:hasMatchAll});
		}
	}

	if(db.query.results.length == 0) {
		throw new NullResultsException();
	}

	db.query.results.sort(function(a,b) {
		if(a.matchPhrase === b.matchPhrase) {
			if(a.matchAll === b.matchAll) {
				if(a.score === b.score) {
					if(a.index > b.index) { return -1; } else { return 1; }
				} else {
					if(a.score > b.score) { return -1; } else { return 1; }
				}
			} else {
				if(a.matchAll) { return -1; } else { return 1; }
			}
		} else {
			if(a.matchPhrase) { return -1; } else { return 1; }
		}
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
	var _parent = this; // This makes me sad, but can't see a better way

	var _element = template.load('result-card');

	var createField = function (query, recordField) {
		var _export = _element.querySelector(query);
		_export.content = _export.querySelector('span');
		_export.content.innerHTML = recordField.replace(/\n/g, "<br />");
		if(recordField.isNullOrEmpty()) {
			_export.classList.add('hide');
		}
		return _export;
	};

	this.lhd = 			createField('.lhd', record.LHD);
	this.cerner = 		createField('.cerner', record.cerner);
	this.code = 		createField('.locationCode', record.locationCode);
	this.description = 	createField('.description', record.description);
	this.address = 		createField('.addressLocation', record.addressLocation);
	this.contact = 		createField('.phoneNumber', record.phoneNumber);
	this.sector = 		createField('.sector', record.sector);
	this.org =  		createField('.org', record.ORG);
	this.costCode = 	createField('.costCentreCode', record.costCentreCode);
	this.entityCode = 	createField('.entityCode', record.entityCode);
	this.inst = 		createField('.inst', record.INST);
	this.other = 		createField('.other', record.other);

	this.sector.classList.add('hide');
	this.org.classList.add('hide');
	this.costCode.classList.add('hide');
	this.entityCode.classList.add('hide');
	this.inst.classList.add('hide');

	this.anchor	= _element.querySelector('a');
	this.anchor.id = record.locationCode.hashCode();

	this.buttons = {};

	this.buttons.search = _element.querySelector('.search-description');
	this.buttons.search.href = String.format('http://google.com/search?q={0}', encodeURIComponent(record.description));

	this.buttons.map = _element.querySelector('.map-address');
	this.buttons.map.href = String.format('http://maps.apple.com/maps?q={0}', encodeURIComponent(record.description));	

	this.buttons.share = _element.querySelector('.share-card');
	this.buttons.share.onclick = function () { util.sendShareEmail(record); };

	this.buttons.report = _element.querySelector('.raise-ticket');
	this.buttons.report.onclick = function () { util.raiseUpdateTicket(record); };

    return _element;
}