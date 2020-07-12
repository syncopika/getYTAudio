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

function download(name, fileUrl){
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
	});
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
						checkLinkButton.addEventListener("click", function(evt){
							// check out the link
							checkLink(newURL);
						});
						content.appendChild(checkLinkButton);
						
						var downloadButton = document.createElement('button');
						downloadButton.innerHTML = "download this link";
						downloadButton.addEventListener("click", (function(name, fileUrl){
							return function(evt){
								download(name, fileUrl);
							};
						})("music", newURL));
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


