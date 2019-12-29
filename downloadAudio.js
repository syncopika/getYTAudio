// originally thought I could just get the audio from the current page but:
// https://stackoverflow.com/questions/6587393/resource-interpreted-as-document-but-transferred-with-mime-type-application-zip
// so a solution could be to open a new tab and  call the audio download function in that tab's page context
// calling the function within getRequests.js is only in the context of my devtools panel page.

function downloadAudio(name, fileUrl){
	console.log("downloading " + name + " from " + fileUrl);
	var linkEl = document.createElement('a');
	document.body.appendChild(linkEl);
	linkEl.download = name + ".webm";
	linkEl.href = fileUrl;
	linkEl.click();
}

// expected variables to be present in this context: name and fileUrl
downloadAudio(name, fileUrl);