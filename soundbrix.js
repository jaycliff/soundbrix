/*
    Copyright 2012 Jaycliff Arcilla

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
        http://www.apache.org/licenses/LICENSE-2.0
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/*
    
    SoundBrix: Experimental HTML5 Sound Object Creation Library powered by Web Audio API (Version 1.1 - 09/05/2012)
    Author: Jaycliff Arcilla
    
    This library was created to provide sweet audio fallback options when crap happens (Flash Epic Fail).
    Moreover, my AoV client (Nigel S. Ball) is reasonably allergic to Flash, making this a perfect non-Flash audio solution for his websites.
    
    UPDATES:
    
    * v1.1 (09/05/2012) Made several enhancements to the creation process. Added gain nodes per sound source. Fixed volume setting method.
    * v1.0 (02/22/2012) Initial release.
    
    NOTES:
    
    * AudioBufferSourceNode can only be played once. To play another sound of the same source, another AudioBufferSourceNode must be created.
    * Callbacks MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements.
    
    ISSUES:
    
    * A gain node cannot accept new inputs starting from when the sound sources start playing. To counter this, a separate gain node for each sound source must be created. However, audio_context.destination doesn't seem to have this limitation.
    
    Passed JSLint checking! (http://www.jslint.com/)
    
    JSLINT OPTIONS:
    
    * Assume console, alert, ...
    * Assume a browser
    * Add 'webkitAudioContext' as a global variable in JSLint
    
*/

(function (global) {
    "use strict";
    var noop = function noop() {
        return;
    };
    function loadSound(url, callback) {
        var request = new XMLHttpRequest();
        // Load sound synchronously (the 'false' flag), 'true' means asynchronous
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.addEventListener('load', function () { callback(request.response); }, false);
        request.send();
    }
    // ds and us mean 'default settings' and 'user settings', respectively. Now you know. - Manny
    function mergeSettings(ds, us) {
        var key, temp = {};
        for (key in ds) {
            if (ds.hasOwnProperty(key)) {
                temp[key] = ds[key];
            }
        }
        for (key in us) {
            if (us.hasOwnProperty(key)) {
                temp[key] = us[key];
            }
        }
        return temp;
    }
    global.SOUNDBRIX = {
        // This type creates a new buffer source everytime an instance of the sound is played to allow multiple playback of the same sound (multishot) but can't be paused or stopped
        "Type1": function Type1(user_settings) {
            var self = this, gain = 1, max_gain = 100, settings, default_settings = {
                loop: false,
                playback_rate: 1
            };
            settings = mergeSettings(default_settings, user_settings);
            if (global.soundbrix_caudio_context === undefined) {
                try {
                    global.soundbrix_caudio_context = new global.webkitAudioContext();
                } catch (e) {
                    alert(e + '\nFailed to create sound object.');
                    return;
                }
            }
            if (settings.source === undefined) {
                alert('ERROR: No sound source url!\nFailed to create sound object.');
                return;
            }
            function setMethods() {
                self.playSound = function playSound() {
                    var channel, gainNode;
                    gainNode = global.soundbrix_caudio_context.createGainNode();
                    gainNode.connect(global.soundbrix_caudio_context.destination);
                    gainNode.gain.value = gain;
                    channel = global.soundbrix_caudio_context.createBufferSource();
                    channel.buffer = self.audio_buffer;
                    channel.loop = false;
                    channel.playbackRate.value = settings.playback_rate;
                    channel.connect(gainNode);
                    channel.noteOn(0);
                };
                self.setVolume = function setVolume(value) {
                    var fraction;
                    if (value > max_gain) { value = max_gain; }
                    fraction = value / max_gain;
                    gain = fraction * fraction; //Using x*x curve to smooth out transition
                };
                self.setPlaybackRate = function setPlaybackRate(value) {
                    settings.playback_rate = value;
                };
            }
            self.playSound = noop;
            self.setVolume = noop;
            self.setPlaybackRate = noop;
            loadSound(settings.source, function (response) {
                // For some instances, the createBuffer method is preferred over decodeAudioData to forcibly decode the buffer without waiting for callbacks
                //self.audio_buffer = global.soundbrix_caudio_context.createBuffer(request.response, false);
                global.soundbrix_caudio_context.decodeAudioData(response, function (buffer) {
                    //This block will run when the buffer has been decoded. Insert all remaining sound object code here
                    self.audio_buffer = buffer;
                    setMethods();
                    if (settings.callback !== undefined && typeof settings.callback === 'function') { setTimeout(settings.callback, 10); } //The callback MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements
                }, function () {
                    alert('Failed to load source!');
                });
            });
        },
        // This type uses 'sound channels' to allow multiple playback of the same sound (multishot)
        "Type2": function Type2(user_settings) {
            var self = this, settings, gainNode = [], gain = 1, max_gain = 100, default_settings = {
                loop: false,
                playback_rate: 1,
                max_channels: 1
            };
            self.channel_busy = [];
            self.source_channels = {};
            self.current_sound_channel = 0;
            self.audio_buffer = null;
            self.is_playing = false;
            settings = mergeSettings(default_settings, user_settings);
            settings.max_channels += 1; //Sneakily increment the number of channels by one to provide a 'buffer' for setting up a new sound source. See the sound channel lag fix inside the self.playSound method
            if (global.soundbrix_caudio_context === undefined) {
                try {
                    global.soundbrix_caudio_context = new global.webkitAudioContext();
                } catch (e) {
                    alert(e + '\nFailed to create sound object.');
                    return;
                }
            }
            if (settings.source === undefined) {
                alert('ERROR: No sound source url!\nFailed to create sound object.');
                return;
            }
            function createChannels() {
                var i;
                for (i = 0; i < settings.max_channels; i += 1) {
                    gainNode[i] = global.soundbrix_caudio_context.createGainNode();
                    gainNode[i].connect(global.soundbrix_caudio_context.destination);
                    gainNode[i].gain.value = gain;
                    self.source_channels[i] = global.soundbrix_caudio_context.createBufferSource();
                    self.source_channels[i].buffer = self.audio_buffer;
                    self.source_channels[i].loop = false;
                    self.source_channels[i].playbackRate.value = settings.playback_rate;
                    self.source_channels[i].connect(gainNode[i]);
                    self.channel_busy[i] = false;
                }
            }
            function setMethods() {
                self.playSound = function playSound() {
                    self.is_playing = true;
                    if (self.channel_busy[self.current_sound_channel]) {
                        self.current_sound_channel += 1;
                        if (self.current_sound_channel >= settings.max_channels) {
                            self.current_sound_channel = 0;
                        }
                    }
                    self.source_channels[self.current_sound_channel].noteOn(0);
                    self.channel_busy[self.current_sound_channel] = true;
                    /*
                        
                        The solution below fixes sound-playing lag caused by some latency when creating new AudioBufferSourceNode (via the context.createBufferSource() method)
                        Basically it re-initializes the sound channel following the current one to prepare the nextchannel for playback (and somewhat avoiding the said latency)
                        
                    */
                    /* Start sound channel lag fix */
                    if (settings.max_channels > 1) {
                        var next_channel;
                        if (self.current_sound_channel + 1 >= settings.max_channels) {
                            next_channel = 0;
                        } else {
                            next_channel = self.current_sound_channel + 1;
                        }
                        if (self.channel_busy[next_channel]) {
                            self.source_channels[next_channel].noteOff(0);
                            gainNode[next_channel] = global.soundbrix_caudio_context.createGainNode();
                            gainNode[next_channel].connect(global.soundbrix_caudio_context.destination);
                            gainNode[next_channel].gain.value = gain;
                            self.source_channels[next_channel] = global.soundbrix_caudio_context.createBufferSource();
                            self.source_channels[next_channel].buffer = self.audio_buffer;
                            self.source_channels[next_channel].loop = false;
                            self.source_channels[next_channel].playbackRate.value = settings.playback_rate;
                            self.source_channels[next_channel].connect(gainNode[next_channel]);
                            self.channel_busy[next_channel] = false;
                        }
                    }
                    /* End sound channel lag fix */
                };
                self.stopSound = function stopSound() {
                    var i;
                    self.is_playing = false;
                    for (i = 0; i < settings.max_channels; i += 1) {
                        self.source_channels[i].noteOff(0);
                    }
                    createChannels();
                };
                self.setVolume = function setVolume(value) {
                    var fraction, i;
                    if (value > max_gain) { value = max_gain; }
                    fraction = value / max_gain;
                    gain = fraction * fraction; //Using x*x curve to smooth out transition
                    for (i = 0; i < gainNode.length; i += 1) {
                        gainNode[i].gain.value = gain;
                    }
                };
                self.setPlaybackRate = function setPlaybackRate(value) {
                    var i;
                    settings.playback_rate = value;
                    for (i = 0; i < settings.max_channels; i += 1) {
                        self.source_channels[i].playbackRate.value = value;
                    }
                };
            }
            self.playSound = noop;
            self.stopSound = noop;
            self.setVolume = noop;
            self.setPlaybackRate = noop;
            loadSound(settings.source, function (response) {
                // For some instances, the createBuffer method is preferred over decodeAudioData to forcibly decode the buffer without waiting for callbacks
                //self.audio_buffer = global.soundbrix_caudio_context.createBuffer(request.response, false);
                global.soundbrix_caudio_context.decodeAudioData(response, function (buffer) {
                    //This block will run when the buffer has been decoded. Insert all remaining sound object code here
                    self.audio_buffer = buffer;
                    createChannels();
                    setMethods();
                    if (settings.callback !== undefined && typeof settings.callback === 'function') { setTimeout(settings.callback, 10); } //The callback MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements
                }, function () {
                    alert('Failed to load source!');
                });
            });
        }
    };
}(window));
