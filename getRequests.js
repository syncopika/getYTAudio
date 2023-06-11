// getRequests.js 
// look at network requests and look for content-type 'audio/webm'
// then modify url 

// https://developer.chrome.com/extensions/devtools
// https://developer.chrome.com/extensions/devtools_network
// https://stackoverflow.com/questions/14281234/chrome-extension-that-focuses-items-in-elements-panel

// ~ 18328 bytes per second of audio? this is just an approximation.
// default values
var start = 0;
var end = 9999999;
var bytesPerSec = 18300;

chrome.devtools.panels.create("GetYTAudio",
	"icon128.png",
	"devtools.html",
	function(panel){
	
		var button = document.getElementById('getAudioLink');
		button.addEventListener("click", getAudioLink);
		
		var clearButton = document.getElementById('clear');
		clearButton.addEventListener("click", clear);
	}
);

function clear(){
	var content = document.getElementById('content');
	while(content.firstChild){
		content.removeChild(content.firstChild);
	}
}

function checkLink(fileUrl){
	chrome.tabs.create({url: fileUrl});
}

function writeStringToWav(dataViewObj, offset, string){
	for(let i = 0; i < string.length; i++){
		dataViewObj.setUint8(offset + i, string.charCodeAt(i));
	}
}

function interleave(leftChan, rightChan){
	const len = leftChan.length + rightChan.length;
	const buf = new Float32Array(len);
	
	let index = 0;
	let chanIndex = 0;
	
	while(index < len){
		buf[index++] = leftChan[chanIndex];
		buf[index++] = rightChan[chanIndex];
		chanIndex++;
	}
	
	return buf;
}

function floatTo16BitPCM(dataViewObj, offset, input){
	for(let i = 0; i < input.length; i++, offset += 2){
		const s = Math.max(-1, Math.min(1, input[i]));
		dataViewObj.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
	}
}

function toWAV(audioBuffer){
	const numChannels = audioBuffer.numberOfChannels;
	const sampleRate = audioBuffer.sampleRate;
	
	let audioDataBuf;
	if(numChannels === 2){
		audioDataBuf = interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1));
	}else{
		audioDataBuf = audioBuffer.getChannelData(0);
	}
	
	// note: assuming a bitDepth of 16 and so 2 bytes per sample
	const bytesPerSample = 2;
	const blockAlign = numChannels * bytesPerSample;
	
	const wavBuffer = new ArrayBuffer(44 + audioDataBuf.length * bytesPerSample); // 44 for wav header 
	const view = new DataView(wavBuffer);
	
	writeStringToWav(view, 0, 'RIFF');
	view.setUint32(4, 36 + audioDataBuf.length * bytesPerSample, true);
	writeStringToWav(view, 8, 'WAVE');
	writeStringToWav(view, 12, 'fmt ');
	view.setUint32(16, 16, true); // format chunk length
	view.setUint16(20, 1, true);  // sample format 
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true); // byte rate
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true); // bits per sample
	writeStringToWav(view, 36, 'data');
	view.setUint32(40, audioDataBuf.length * 2, true);
	floatTo16BitPCM(view, 44, audioDataBuf);
	
	return view;
}

function showInProgress(){
	const cover = document.createElement('div');
	cover.id = 'inProgress';
	cover.style.backgroundColor = 'rgba(204, 12, 0, 0.5)'; // red color
	cover.style.position = 'fixed';
	cover.style.top = 0;
	cover.style.left = 0;
	cover.style.width = '100%';
	cover.style.height = '100%';
	cover.style.textAlign = 'center';
	cover.style.zIndex = 10;
	
	const msg = document.createElement('h1');
	msg.textContent = 'audio download in progress....';
	msg.style.fontFamily = 'monospace';
	
	cover.appendChild(msg);
	
	document.body.appendChild(cover);
}

function hideInProgress(){
	const inProgress = document.getElementById('inProgress');
	if(inProgress){
		document.body.removeChild(inProgress);
	}
}

function download(name, fileUrl){
	// download audio data via decodeAudioData() as wav file
	// https://stackoverflow.com/questions/10040317/getting-raw-pcm-data-from-webaudio-mozaudio/10067038#10067038
	// https://github.com/WebAudio/web-audio-api/issues/1563
	// https://github.com/Jam3/audiobuffer-to-wav/blob/master/demo/index.js
	showInProgress();
	fetch(fileUrl).then(async (response) => {
		const arrayBuf = await response.arrayBuffer();
		
		const audioCtx = new AudioContext();
		const pcmData = await audioCtx.decodeAudioData(arrayBuf);
		
		const wav = toWAV(pcmData);
		
		const wavBlob = new Blob([wav], {type: 'audio/wav'});
		
		const blobUrl = URL.createObjectURL(wavBlob);
		const anchorEl = document.createElement('a');
		anchorEl.href = blobUrl;
		anchorEl.download = `${name}.wav`;
		anchorEl.click();
		URL.revokeObjectURL(blobUrl);
		hideInProgress();
	});
	
	// if you want the file as webm, use the below code
	/*
	chrome.tabs.create({url: fileUrl}, function(tab){
		// execute content script for the tab 
		// cool techniques for passing vars!
		// https://stackoverflow.com/questions/17567624/pass-a-parameter-to-a-content-script-injected-using-chrome-tabs-executescript
		chrome.tabs.executeScript(tab.id, {
			code: "var name = '" + name + "'; var fileUrl = '" + fileUrl + "'"
		}, function(){
			// execute function to grab audio
			chrome.tabs.executeScript(tab.id, {file: "downloadAudio.js"}, function(){
				// close the tab
				chrome.tabs.remove(tab.id);
			});
		});
	});*/
}

function getAudioLink(){
	// clear the current stuff in the content div
	var content = document.getElementById('content');
	while(content.hasChildNodes()){
		content.removeChild(content.lastChild);
	}
	
	var s = "looking for the audio data link... there might be duplicates...";
	var msg = document.createElement('p');
	msg.innerHTML = s;
	content.appendChild(msg);
	
	var label = document.createElement('label');
	label.textContent = "file name for download: ";
	label.setAttribute('for', 'fieldName');
	content.appendChild(label);
	
	var nameOfFileTextEdit = document.createElement('input');
	nameOfFileTextEdit.setAttribute("type", "text");
	nameOfFileTextEdit.id = "fileName";
	nameOfFileTextEdit.style.width = "5%";
	nameOfFileTextEdit.placeholder = "file name";
	content.appendChild(nameOfFileTextEdit);
	
	// get video duration (and look through HAR log)
	chrome.devtools.inspectedWindow.eval(
		"(document.getElementsByClassName('ytp-time-duration')[0]).innerHTML",
		function(result, exceptionInfo){
			
			chrome.devtools.network.getHAR(function(harLog){
		
				// we're looking for a url that has the mime type as audio/webm! 
				// what about if an ad shows up? the ad might get taken 
				var flag = false;
				
				var el = document.createElement('p');
				el.innerHTML = "there are " + harLog.entries.length + " entries in the HAR log.";
				content.appendChild(el);
				
				var count = 5; // just limit to 5 valid entries in the HAR log for now 
				for(var i = 0; i < harLog.entries.length; i++){
					
					if(count < 0){
						return;
					}
					
					// files could be of mp4 or webm type! just make sure they're requests for audio 
					if(harLog.entries[i].request.url.indexOf("mime=audio") > 0){
						
						var requestURL = harLog.entries[i].request.url;
						
						var url = document.createElement('p');
						url.innerHTML = requestURL;
						//content.appendChild(url);
						
						// use regex to correct the start and end numbers to get the whole audio 
						// adjust start and end vars accordingly based on the current input fields.
						// need to make sure they're reasonable numbers as well 
						var duration = result.split(':');
		
						// get total seconds of video 
						var durationSeconds = 0;
						for(var j = duration.length-1; j >= 0; j--){
							// going backwards, from seconds to hours (or minutes if no hours)
							durationSeconds += (parseInt(duration[j])*Math.pow(60, duration.length-1-j));
						}
						//console.log(durationSeconds);
					
						// get the user-specified start and end times 
						var startH =  parseInt(document.getElementById('startHH').value)*3600;
						var startM = parseInt(document.getElementById('startMM').value)*60;
						var startS = parseInt(document.getElementById('startSS').value);
						var inputStartTime = ((startH + startM + startS) < durationSeconds && ((startH + startM + startS) >= 0)) ? (startH + startM + startS) : 0;
						console.log(inputStartTime);
						
						var endH =  parseInt(document.getElementById('endHH').value)*3600;
						var endM = parseInt(document.getElementById('endMM').value)*60;
						var endS = parseInt(document.getElementById('endSS').value);
						var inputEndTime = ((endH + endM + endS) <= durationSeconds && (endH + endM + endS) > inputStartTime) ? (endH + endM + endS) : 540; // 540 = 9999999 / 18500
						console.log(inputEndTime);
						
						start = inputStartTime * bytesPerSec;
						end = inputEndTime * bytesPerSec;
						
						var regex = /range=[0-9]+-[0-9]+/g;
						var newRange = "range=" + start + "-" + end; 
						var newURL = requestURL.replace(regex, newRange);
						
						var modifiedURL = document.createElement('p');
						modifiedURL.innerHTML = newURL;
						content.appendChild(modifiedURL);
						
						var checkLinkButton = document.createElement('button');
						checkLinkButton.innerHTML = "check this link";
						checkLinkButton.addEventListener("click", (function(fileUrl){
							// check out the link
							return function(evt){
								// modify url if there are other params like ump, which cause a download of a 'videoplayback' file
								// instead of playing the audio in the tab
								if(fileUrl.indexOf('&ump')){
									var modifiedUrl = fileUrl.substring(0, fileUrl.indexOf('&ump')-1);
									checkLink(modifiedUrl);
								}else{
									checkLink(fileUrl);
								}
							};
						})(newURL));
						content.appendChild(checkLinkButton);
						
						var downloadButton = document.createElement('button');
						downloadButton.innerHTML = "download this link";
						downloadButton.addEventListener("click", (function(fileUrl){
							return function(evt){
								var filename = document.getElementById('fileName').value;
								filename = (filename === "") ? "music" : filename;
								console.log("downloading: " + filename);

								// as of 6/11/23 I noticed a couple new query params added, i.e. &ump=1&srfvp=1.
								// these are appended after rbuf and for some reason cause a download of a file called
								// 'videoplayback' when navigating to the url with those params.
								// removing those params seems to help.
								if(fileUrl.indexOf('&ump')){
									var modifiedUrl = fileUrl.substring(0, fileUrl.indexOf('&ump')-1);
									download(filename, modifiedUrl);
								}else{
									download(filename, fileUrl);
								}
							};
						})(newURL));
						content.appendChild(downloadButton);
						
						var inputStartEnd = document.createElement('p');
						inputStartEnd.innerHTML = "start byte: " + start + ", end byte: " + end;
						content.appendChild(inputStartEnd);

						flag = true;
						count--;
					}
				}
				
				if(!flag){
					var msg = document.createElement('p');
					msg.innerHTML = "could not find. :(";
					content.appendChild(msg);
				}
				
				var videoDuration = document.createElement('p');
				videoDuration.innerHTML = "video duration: " + result;
				content.appendChild(videoDuration);
				
				
			}); // end getHAR
			
		} // end callback 
	);
	
}


