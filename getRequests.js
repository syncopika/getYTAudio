// getRequests.js 
// look at network requests and look for content-type 'audio/webm'
// then modify url 

// https://developer.chrome.com/extensions/devtools
// https://developer.chrome.com/extensions/devtools_network
// https://stackoverflow.com/questions/14281234/chrome-extension-that-focuses-items-in-elements-panel
// ~ 18328 bytes per second of audio? 


chrome.devtools.panels.create("My Panel",
	"icon128.png",
	"devtools.html",
	function(panel){

		// CREATE A BUTTON WITH AN EVENTLISTENER FOR CLICK 
		// ON CLICK, COLLECT THE AUDIO LINK AND DO THE MATH STUFF TO FIGURE OUT START AND END 
		// RETURN CORRECTED URL 
		// HAVE A COUPLE TEXT BOXES SPECIFYING RANGE OF AUDIO FILE TO SAVE?
		// next steps: can we directly get the audio data bytes via XHR? 
		
		var button = document.createElement('button');
		button.innerHTML = "get audio link";
		button.addEventListener("click", getAudioLink);
		document.body.appendChild(button);
		
	}

);


function getAudioLink(){
	
	var s = "looking for the audio data link... this might take some time..."
	var msg = document.createElement('p');
	msg.innerHTML = s;
	document.body.appendChild(msg);
	
	setTimeout(function(){
		
		// get video duration 
		chrome.devtools.inspectedWindow.eval(
			"(document.getElementsByClassName('ytp-time-duration')[0]).innerHTML",
			function(result, exceptionInfo){
				
				chrome.devtools.network.getHAR(function(harLog){
			
					// we're looking for a url that has the mime type as audio/webm! 
					// what about if an ad shows up? the ad might get taken 
					var flag = false;
					
					var el = document.createElement('p');
					el.innerHTML = "there are " + harLog.entries.length + " entries in the HAR log.";
					document.body.appendChild(el);
					
					for(var i = 0; i < harLog.entries.length; i++){
						// files could be of mp4 or webm type! just make sure they're requests for audio 
						if(harLog.entries[i].request.url.indexOf("mime=audio") > 0){
							
							var requestURL = harLog.entries[i].request.url;
							
							var url = document.createElement('p');
							url.innerHTML = requestURL;
							document.body.appendChild(url);
							
							// use regex to correct the start and end numbers to get the whole audio 
							var regex = /range=[0-9]+-[0-9]+/g;
							var start = 0;
							var end = 9999999;
							var newRange = "range=" + start + "-" + end; 
							var newURL = requestURL.replace(regex, newRange);
							
							var modifiedURL = document.createElement('p');
							modifiedURL.innerHTML = newURL;
							document.body.appendChild(modifiedURL);

							flag = true;
						}
					}
					
					if(!flag){
						var msg = document.createElement('p');
						msg.innerHTML = "could not find. :(";
						document.body.appendChild(msg);
					}
					
					var videoDuration = document.createElement('p');
					videoDuration.innerHTML = "video duration: " + result;
					document.body.appendChild(videoDuration);
					
				}); // end getHAR
				
			} // end callback 
			
		);

	}, 6000); // wait 6 secs - this should be long enough to get the right link...
	
}


