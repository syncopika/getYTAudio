// https://stackoverflow.com/questions/45803407/synchronously-read-file-and-convert-to-byte-array
// https://nodejs.org/api/fs.html#fs_file_paths
// https://stackoverflow.com/questions/15808151/how-to-read-binary-file-byte-by-byte-using-javascript
// https://matroska.org/technical/specs/notes.html

// these are most helpful:
// https://www.darkcoding.net/software/reading-mediarecorders-webm-opus-output/
// https://www.matroska.org/technical/diagram.html
// https://www.matroska.org/technical/specs/index.html
// https://www.matroska.org/technical/ordering.html
// weba files are actually webm files! so since not matroska file, we look at doctype field (0x81 0x04 for webm)

// https://www.webmproject.org/docs/container/
// https://stackoverflow.com/questions/57534783/how-to-reconstruct-audio-blob-from-a-base64-encoded-string
// https://github.com/cellar-wg/ebml-specification/blob/master/specification.markdown#ebml-header-elements
// https://axel.isouard.fr/blog/2016/05/24/streaming-webm-video-over-html5-with-media-source
// this is helpful too lol: https://godoc.org/github.com/ebml-go/webm
// https://github.com/cellar-wg/ebml-specification/blob/master/specification.markdown#vint-examples
// https://forum.videohelp.com/threads/394117-Extracting-audio-losslessly-with-ffmpeg-or-mkvextract

let theFile = "darkcoding-webm-ebml.webm"; // https://www.darkcoding.net/software/reading-mediarecorders-webm-opus-output/
let fs = require("fs");
let stats = fs.statSync(theFile);
let fileSizeInBytes = stats["size"];
console.log("file size: " + fileSizeInBytes);

const EBMLElements = {
	"1a45dfa3": "header",
	"9f": "header_length"
}

// the keys and all the children keys are ebml elements!
// so: id, length, value is the order of info
// note that length might be 2 bytes and not just 1, depending on the first byte
// I'm using the id of each element as the key for easy look up since there's so mandatory ordering of most of the elements
const EBMLTopLevelElements = {
	"114d9b74": {
		"name": "SeekHead",
		"children": {
			"4dbb": {
				"name": "Seek"
			},
			"53ab": {
				"name": "SeekID"
			},
			"53ac": {
				"name": "SeekPosition"
			}
		}
	},
	"1549a966": {
		"name": "Info",
		"children": {
			"73a4": {
				"name": "SegmentUID"
			},
			"7384": {
				"name": "SegmentFilename"
			}
		}
	},
	"1654ae6b": {
		"name": "Tracks",
		"children": {}
	},
	"1043a770": {
		"name": "Chapters",
		"children": {}
	},
	"1f43b675": {
		"name": "Cluster",
		"children": {
			"e7": {
				"name": "Timestamp"
			},
			"5854": {
				"name": "SilentTracks"
			},
			"a7": {
				"name": "Position"
			},
			"ab": {
				"name": "PrevSize"
			},
			"a3": {
				"name": "SimpleBlock"
			},
			"a0": {
				"name": "BlockGroup"
			}
		}
	},
	"1c53bb6b": {
		"name": "Cues",
		"children": {}
	},
	"1941a469": {
		"name": "Attachments",
		"children": {}
	},
	"1254c367": {
		"id": "Tags",
		"children": {}
	}
}

function decToBinary(num){
	let res = "";
	let rem = num;
	while(rem > 0){
		let currBit = rem % 2;
		res = currBit + res;
		rem = Math.floor(rem / 2);
	}
	// this ensures at least one octet in the binary string
	//while(res.length % 2 !== 0 || res.length < 8){
	//	res = "0" + res;
	//}
	
	// make sure 4 bits since for our purposes we're always working with hex nums
	while(res.length < 4){
		res = "0" + res;
	}
	
	return res;
}

function binToDec(bin){
	let total = 0;
	let exponent = 0;
	for(let i = bin.length - 1; i >= 0; i--){
		if(bin[i] == 1){
			total += Math.pow(2, exponent);
		}
		exponent++;
	}
	return total;
}

// convert hex to variable int value in decimal
// hex -> binary -> truncate -> to decimal 
// https://github.com/cellar-wg/ebml-specification/blob/master/specification.markdown#vint-examples
function varIntBinToDec(binStr){
	// given a binary string, decide how to truncate 
	// we need to cut out the leading 0s and the first 1 
	let res = "";
	let addFlag = false;
	for(let i = 0; i < binStr.length; i++){
		if(!addFlag && binStr[i] == 1){
			addFlag = true;
		}else if(addFlag){
			res += binStr[i];
		}
	}
	return binToDec(res);
}

// testing
console.log("testing ----------");
console.log(varIntBinToDec("0101")); // expect 1
console.log(varIntBinToDec("00000011")); // expect 1
console.log(varIntBinToDec("00100011")); // expect 3
console.log(varIntBinToDec("10011111")); // expect 31
console.log(varIntBinToDec("0100000110000110")); // expect 390
console.log(varIntBinToDec(hexToBin("99"))); // expect 25
console.log(varIntBinToDec(hexToBin("9f"))); // expect 31
console.log(decToBinary(9)); // expect 1001
console.log(decToBinary(0)); // expect 0000
console.log(hexToBin("01")); // expect 00000001
console.log(additionalOctetCount("00000001")); // expect 7
console.log("---------------")

// hex to bin
function hexToBin(hexStr){
	let map = {
		'a': 10,
		'b': 11,
		'c': 12,
		'd': 13,
		'e': 14,
		'f': 15
	}
	let total = "";
	for(let i = hexStr.length - 1; i >= 0; i--){
		// get binary 
		let num = map[hexStr[i]] ? parseInt(map[hexStr[i]]) : parseInt(hexStr[i]);
		total = decToBinary(num) + total;
	}
	return total;
}

function additionalOctetCount(binStr){
	// check binary string. number of consecutive leading 0s will determine how many additional octets
	if(binStr[0] == 1){
		return 0;
	}
	
	let count = 0;
	for(let i = 1; i < binStr.length; i++){
		if(binStr[i] == 1){
			return count + 1;
		}
		count++;
	}
	return 0;
}


function getElement(buffer, start, end, topLevelElements, info){
	let bufferSlice = buffer.slice(start, end);
	if(topLevelElements[bufferSlice.toString('hex')] !== undefined){
		//console.log(varIntBinToDec(hexToBin(getElementLength(end, buffer).toString('hex'))));
		const topLevelElementName = topLevelElements[bufferSlice.toString('hex')].name;
		
		const newElement = {
			"id": ("0x" + bufferSlice.toString('hex')),
			
			// sometimes the length could be 01 ff ff ff ff ff ff ff, which is unknown length
			// TODO: maybe say unknown length instead of converting to decimal?
			"length": varIntBinToDec(hexToBin(getElementLength(end, buffer).toString('hex'))), // length of an element's content
			
			"lengthNumBytes": getElementLength(end, buffer).length, // the number of bytes to represent the length
			"position": start,
		};
		
		if(info[topLevelElementName]){
			// some elements might show up multiple times like simpleblock. so just append to a list if we have multiple.
			info[topLevelElementName].push(newElement);
		}else{
			info[topLevelElementName] = [newElement];
		}
		return newElement;
	}else{
		return null;
	}
}

// pass pos of first byte of length for an element
// gets a slice of the buffer that represents all the bytes that represent
// the length of an element 
function getElementLength(pos, buffer){
	let additionalOctets = additionalOctetCount(hexToBin(buffer.slice(pos, pos+1).toString('hex')));
	let newPos = pos+1;
	while(additionalOctets > 0){
		additionalOctets--;
		newPos++;
	}
	return buffer.slice(pos, newPos);
}

function parseWebm(buffer){
	let info = {};
	
	// this is all header stuff
	info["header"] = buffer.slice(0,4); //1a45dfa3
	info["headerLength"] = buffer.slice(4,5); // 9f
	info["version_element"] = buffer.slice(5,7); // 4286
	info["length"] = buffer.slice(7,8); // 81
	info["value"] = buffer.slice(8,9); // 01
	
	info["readversion_element"] = buffer.slice(9,11);
	info["readversion_length"] = buffer.slice(11,12);
	info["readversion_value"] = buffer.slice(12,13);
	
	info["maxid_element"] = buffer.slice(13,15);
	info["maxid_length"] = buffer.slice(15,16);
	info["maxid_value"] = buffer.slice(16,17);
	
	info["maxsize_element"] = buffer.slice(17,19);
	info["maxsize_length"] = buffer.slice(19,20);
	info["maxsize_value"] = buffer.slice(20,21);
	
	info["doctype_element"] = buffer.slice(21,23);
	info["doctype_length"] = buffer.slice(23,24);
	info["doctype_value"] = buffer.slice(24,28); // this is bad, but assume 4 bytes
	
	// now we get into the segment
	let nextPos = 36; // 36 because 4 + 1 + 31 for the EBML header.
	info["segment"] = buffer.slice(nextPos, nextPos+4);
	info["segment_length"] = getElementLength(nextPos+4, buffer);
	
	// note that the length here is the number of bytes that make up the length of the element (not the actual total length of the element itself)
	// there isn't an additional number to add (i.e. the acutal length of the element) in this case other than the 4 bytes for the header and the num of bytes
	// that represent the element's length because this is the segment element, which contains the top-level elements. 4 is ok here for top-level elements
	// but some lower-level element headers may not be 4 bytes!
	let nextElementPos = nextPos + 4 + info["segment_length"].length;
	let nextElement = getElement(buffer, nextElementPos, nextElementPos+4, EBMLTopLevelElements, info);
	
	for(let i = 0; i < 4; i++){ // change to while loop? using 4 just seemed like a good limit for testing
		if(nextElement === null){
			break;
		}
		nextElementPos += (nextElement.length + 4 + nextElement.lengthNumBytes);
		nextElement = getElement(buffer, nextElementPos, nextElementPos+4, EBMLTopLevelElements, info);
	}
	
	return info;
}


fs.open(theFile, 'r', (status, fd) => {
	if(status){
		console.log(status.message);
		return;
	}
	let buffer = Buffer.alloc(fileSizeInBytes, 'hex');
	fs.readSync(fd, buffer, 0, fileSizeInBytes, 0);
	
	// read ebml header
	let ebml = parseWebm(buffer);
	console.log(ebml);
	
	// let's take a look in the cluster element (that's where our audio data should be)
	let cluster = {};
	
	// the divide by 2 stuff is for calculating how many bytes the element's header is
	let startPos = ebml.Cluster[0].position + ebml.Cluster[0].lengthNumBytes + ((ebml.Cluster[0].id.length-2)/2);
	
	// based on the matroska spec, the timestamp has to be first in the cluster, so we can assume it'll be just 1 byte (hence the +1)
	let nextElement = getElement(buffer, startPos, startPos+1, EBMLTopLevelElements["1f43b675"].children, cluster); 
	
	while(nextElement != null){
		startPos += (nextElement.length + nextElement.lengthNumBytes + ((nextElement.id.length-2)/2));
		nextElement = getElement(buffer, startPos, startPos+1, EBMLTopLevelElements["1f43b675"].children, cluster);
	}
	
	console.log("=====================");
	// show just elements within cluster (we want to see a lot of simpleblock elements cause that's our audio data)
	console.log(cluster);
});
