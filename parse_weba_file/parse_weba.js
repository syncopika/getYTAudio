// https://stackoverflow.com/questions/45803407/synchronously-read-file-and-convert-to-byte-array
// https://nodejs.org/api/fs.html#fs_file_paths
// https://stackoverflow.com/questions/15808151/how-to-read-binary-file-byte-by-byte-using-javascript
// https://matroska.org/technical/specs/notes.html

// these are most helpful:
// https://www.matroska.org/technical/specs/index.html
// weba files are actually webm files! so since not matroska file, we look at doctype field (0x81 0x04 for webm)
// super helpful: https://www.darkcoding.net/software/reading-mediarecorders-webm-opus-output/

// https://www.webmproject.org/docs/container/
// https://stackoverflow.com/questions/57534783/how-to-reconstruct-audio-blob-from-a-base64-encoded-string
// https://github.com/cellar-wg/ebml-specification/blob/master/specification.markdown#ebml-header-elements
// https://axel.isouard.fr/blog/2016/05/24/streaming-webm-video-over-html5-with-media-source
// this is helpful too lol: https://godoc.org/github.com/ebml-go/webm
// https://github.com/cellar-wg/ebml-specification/blob/master/specification.markdown#vint-examples
// https://forum.videohelp.com/threads/394117-Extracting-audio-losslessly-with-ffmpeg-or-mkvextract

let theFile = "wonderfulslipperything-guthriegovan.weba";
let fs = require("fs");
let stats = fs.statSync(theFile);
let fileSizeInBytes = stats["size"];
console.log(fileSizeInBytes);


function decToBinary(num){
	let res = "";
	let rem = num;
	while(rem > 0){
		let currBit = rem % 2;
		res = currBit + res;
		rem = Math.floor(rem / 2);
	}
	while(res.length % 2 !== 0 || res.length < 8){
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
console.log(varIntBinToDec("0101")); // expect 1
console.log(varIntBinToDec("00000011")); // expect 1
console.log(varIntBinToDec("00100011")); // expect 3

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


const EBMLElements = {
	"1a45dfa3": "header",
	"9f": "header_length"
}

// returns ebml info in a dictionary
function readEBMLInfo(buffer){
	// first 4 bytes = signify it's an ebml element 
	// next byte is the length
	// next 2 bytes is ebml version
	// next byte is value of this element 
	let info = {};
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
	
	// as soon as we know the length of the header, we can move past it.
	// we just need to verify webm 
	// then get the audio info 
	let nextPos = 36; // 36 because 4 + 1 + 31 for the EBML header.
	info["segment"] = buffer.slice(nextPos, nextPos+4);
	info["segment_length"] = getElementLength(nextPos+4, buffer);
	
	// should be at segment. look for segment elements 
	let pos = nextPos+4+info["segment_length"].length;
	info["seekhead"] = buffer.slice(pos, pos+4);
	info["seekhead_length"] = getElementLength(pos+4, buffer);
	
	// now we got all the octets (or bytes) for the length.
	// we need to convert to binary and truncate as needed to calculate the integer value.
	let len = varIntBinToDec(hexToBin(info["seekhead_length"]));
	//console.log("length to skip: " + len);
	
	let newPos = pos+4+len+1;
	info["info_element"] = buffer.slice(newPos, newPos+4);
	info["info_element_length"] = getElementLength(newPos+4, buffer);
	let len2 = varIntBinToDec(hexToBin(info["info_element_length"]));
	//console.log("length to skip: " + len2);
	
	newPos = newPos+4+len2+1;
	info["tracks_element"] = buffer.slice(newPos, newPos+4);
	info["tracks_element_length"] = getElementLength(newPos+4, buffer);
	//let len3 = varIntBinToDec(hexToBin(info["tracks_element_length"]));
	
	// since tracks is a level 1 element, its value after the length encompasses all its 
	// underlying elements
	// so the next byte after the length is a new element 
	newPos = newPos+4+1;
	info["track_entry_element"] = buffer.slice(newPos, newPos+1);
	info["track_entry_element_length"] = getElementLength(newPos+1, buffer);
	//let len3 = varIntBinToDec(hexToBin(info["tracks_element_length"]));
	
	// next is tracknumber 
	newPos += 2;
	info["tracknumber"] = buffer.slice(newPos, newPos+1);
	info["tracknumber_length"] = getElementLength(newPos+1, buffer);
	
	newPos += 1 + varIntBinToDec(hexToBin(info["tracknumber_length"])) + 1;
	info["trackUID"] = buffer.slice(newPos, newPos+2);
	info["trackUID_length"] = getElementLength(newPos+2, buffer);
	
	newPos += 2 + varIntBinToDec(hexToBin(info["trackUID_length"])) + 1;
	info["tracktype"] = buffer.slice(newPos, newPos+1);
	info["tracktype_length"] = getElementLength(newPos+1, buffer);
	
	newPos += 1 + varIntBinToDec(hexToBin(info["tracktype_length"])) + 1;
	info["flaglacing"] = buffer.slice(newPos, newPos+1);
	info["flaglacing_length"] = getElementLength(newPos+1, buffer);
	
	newPos += 1 + varIntBinToDec(hexToBin(info["flaglacing_length"])) + 1;
	info["codecid"] = buffer.slice(newPos, newPos+1);
	info["codecid_length"] = getElementLength(newPos+1, buffer);
	let codecIdLen = varIntBinToDec(hexToBin(info["codecid_length"]));
	info["codecid_value"] = buffer.slice(
		newPos+info["codecid_length"].length+1, 
		newPos+1+info["codecid_length"].length+codecIdLen).toString();
	
	// after confirming codec id as opus, find the data 
	// codec-specific info here 
	newPos = newPos+1+info["codecid_length"].length+codecIdLen;
	info["privatecodecinfo"] = buffer.slice(newPos, newPos+2);
	info["privatecodecinfo_length"] = getElementLength(newPos+2, buffer);
	
	// skip over private info 
	//console.log("skip over: " + varIntBinToDec(hexToBin(info["privatecodecinfo_length"])) + " bytes.");
	newPos += varIntBinToDec(hexToBin(info["privatecodecinfo_length"])) + 3;
	info["codecdelay"] = buffer.slice(newPos, newPos+2);
	info["codecdelay_length"] = getElementLength(newPos+2, buffer);
	
	// skip [56][aa] and [56][bb] 
	newPos += varIntBinToDec(hexToBin(info["codecdelay_length"])) + 3;
	info["seekpreroll"] = buffer.slice(newPos, newPos+2);
	info["seekpreroll_length"] = getElementLength(newPos+2, buffer);
	
	// find [e1] for audio metadata 
	newPos += varIntBinToDec(hexToBin(info["seekpreroll_length"])) + 3;
	info["audio"] = buffer.slice(newPos, newPos+1);
	info["audio_length"] = getElementLength(newPos+1, buffer);
	
	newPos += 1 + info["audio_length"].length;
	info["samplingFrequency"] = buffer.slice(newPos, newPos+1);
	info["samplingFrequency_length"] = getElementLength(newPos+1, buffer);
	let sampleFreqLen = varIntBinToDec(hexToBin(info["samplingFrequency_length"]));
	
	info["samplingFrequency_value"] = buffer.slice(
		newPos+1+info["samplingFrequency_length"].length,
		newPos+1+info["samplingFrequency_length"].length+sampleFreqLen
	).toString();
	
	newPos = newPos+1+info["samplingFrequency_length"].length+sampleFreqLen;
	info["channels"] = buffer.slice(newPos, newPos+1);
	info["channels_length"] = getElementLength(newPos+1, buffer);
	let channelLen = varIntBinToDec(hexToBin(info["channels_length"]));
	info["channels_value"] = buffer.slice(
		newPos+1+info["channels_length"].length,
		newPos+1+info["channels_length"].length+channelLen
	);
	
	/* channels should just be converted straight to decimal from its binary I think?
	console.log(
	binToDec(hexToBin(
		buffer.slice(
			newPos+1+info["channels_length"].length,
			newPos+1+info["channels_length"].length+channelLen
			)
	)));*/
		
	newPos = newPos+1+info["channels_length"].length+channelLen;
	info["bitdepth"] = buffer.slice(newPos, newPos+2);
	info["bitdepth_length"] = getElementLength(newPos+2, buffer);
	let bitdepthLen = varIntBinToDec(hexToBin(info["bitdepth_length"]));
	
	// next is the Cueing Data section 
	newPos = newPos+2+info["bitdepth_length"].length+bitdepthLen;
	info["cueingData"] = buffer.slice(newPos, newPos+4);
	info["cueingData_length"] = getElementLength(newPos+4, buffer);
	let cueingDataLength = varIntBinToDec(hexToBin(info["cueingData_length"]));
	//console.log(cueingDataLength);
	
	// find simpleblock for data 
	newPos = newPos + 4 + info["cueingData_length"].length + cueingDataLength;
	info["cluster"] = buffer.slice(newPos, newPos+4);
	info["cluster_length"] = getElementLength(newPos+4, buffer);
	console.log(varIntBinToDec(hexToBin(info["cluster_length"])));
	
	// can reach simpleblock now (look for A3)
	// dunno what to do with the data once I get it though?
	// I think ogg containers can hold opus-encoded audio data, but I don't think 
	// I can just stick this data in an ogg container, but even if I could I'd have to 
	// create the container first?
	return info;
}

// pass pos of first byte of length for an element
// gets a slice of the buffer that represents all the bytes that represent
// the length of an element 
function getElementLength(pos, buffer){
	let additionalOctets = additionalOctetCount(hexToBin(buffer.slice(pos, pos+1)));
	let newPos = pos+1;
	while(additionalOctets > 0){
		additionalOctets--;
		newPos++;
	}
	return buffer.slice(pos, newPos);
}

fs.open(theFile, 'r', (status, fd) => {
	if(status){
		console.log(status.message);
		return;
	}
	let buffer = Buffer.alloc(fileSizeInBytes, 'hex');
	fs.readSync(fd, buffer, 0, fileSizeInBytes, 0);
	
	// read ebml header
	let ebml = readEBMLInfo(buffer);
	for(let key in ebml){
		console.log(key + ": " + ebml[key].toString('hex'));
	}
	
});