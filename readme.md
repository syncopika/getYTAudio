## getYTAudio
    
a Chrome extension that extends the developer tools inspector with a new panel that helps grab the link to the audio data for a particular YouTube video so you can download just the audio!    
    
![current look of the extension](screenshot.png "current look")    
    
update: found a way to just download the audio as webm instead of weba (they seem to all be weba, which I guess makes sense to have uniformity), which makes the file immediately playable at least on the default media player on Windows 10. a little more useful now :)    
    
The first link is the original, while the second has the range parameter modified. These links can then be accessed to download the audio data (so far I've seen only webm and mp4 as the file type, which can be easily converted using various online services).    
    
~~Depending on how much or what part of the audio you want, the range should be changed accordingly.~~ Actually, it seems like the audio won't be streamed (and so you can't collect the data) if you don't start the range at 0, unfortunately.    
    
After you request the audio link, you may get a bunch of duplicates due to multiple requests in the HAR file that are basically the same (since the audio seems to be streamed in chunks).    
    
There's also a parse_weba.js file and an example .weba file (.weba is another potential file type to be seen - it's basically .webm) in the parse_weba_file folder. The parse_weba.js file uses Node.js and tries to read the .weba file for possibly important fields and of course the Opus-encoded audio data (which I have not yet been able to do). I didn't get too far but I learned quite a bit about Matroska and webm container formats and variable size integers. It was also a somewhat fun exercise/review in binary to/from hex conversion. My hope was to extract the Opus-encoded audio data but then I realized I think I'd have to put that data in another container like Ogg for it to be playable which sounds like another crazy long problem :/. And converting it would mean first decoding it to PCM data which also doesn't sound too pleasant.    
    
    
instructions:    
load the extension.    
go to the YouTube video that has the audio you're interested in.    
open up developer tools (the inspector window) and click on the tab that says "My Panel".    
click on the 'get audio link' button whenever you feel like it. if it doesn't yield any links, try clicking again and/or refreshing the page.    
the links should lead you to an audio player, from which you can download the audio you wanted!       
