## getYTAudio
    
A Chrome extension that extends the developer tools inspector with a new panel that helps grab the link to the audio data for a particular YouTube video so you can download just the audio! Do note that currently it seems the maximum audio length able to be downloaded is ~5 min. (roughly; I haven't checked thoroughly the limits). Dissecting the urls and their parameters might be something to spend a bit of time on to understand why.     
    
![current look of the extension](screenshot.png "current look")    
    
update: found a way to just download the audio as webm instead of weba (they seem to all be weba, which I guess makes sense to have uniformity), which makes the file immediately playable at least on the default media player on Windows 10. a little more useful now :)    
    
~~Depending on how much or what part of the audio you want, the range should be changed accordingly.~~ Actually, it seems like the audio won't be streamed (and so you can't collect the data) if you don't start the range at 0, unfortunately.    
    
After you request the audio link, you may get a bunch of duplicates due to multiple requests in the HAR file that are basically the same (since the audio seems to be streamed in chunks).    
    
instructions:    
- load the extension.    
- open up developer tools (the inspector window) and click on the tab that says "getYTAudio".    
- go to the YouTube video that has the audio you're interested in.      
- click on the 'get audio link' button whenever you feel like it. if it doesn't yield any links, try clicking again and/or refreshing the page.    
- underneath each link will be a button to download the audio as a .webm file. sometimes you'll get the audio for any preceding commercials, so you can use the 'check this link' button before downloading!    