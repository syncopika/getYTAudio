## getYTAudio
    
a Chrome extension that extends the developer tools inspector with a new panel that helps grab the link to the audio data for a particular YouTube video so you can download just the audio!    
    
![current look of the extension](screenshot.png "current look")    
    
The first link is the original, while the second has the range parameter modified. Depending on how much or what part of the audio you want, the range should be changed accordingly. In the future I hope to implement some features that would allow users to specify what part of the audio they want. 
These links can then be accessed to download the audio data (so far I've seen only webm and mp4, which can be easily converted using various online services). After you request the audio link, you may get a bunch of duplicates due to multiple requests in the HAR file that are basically the same (since the audio seems to be streamed in chunks). I should figure out a way to deal with that as well.    
