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
var SOUNDBRIX;
(function (global) {
    "use strict";
    var noop,
        hasAudioContext,
        loadSound,
        mergeSettings,
        soundbrix_audio_context;
    if (typeof SOUNDBRIX === 'object' && SOUNDBRIX.audioContext !== undefined) {
        console.log('An instance of SoundBrix has already been created.');
        return;
    }
    hasAudioContext = function hasAudioContext() {
        var vendor_prefixes,
            entry,
            audio_context_string,
            length,
            x;
        if (!global.AudioContext) {
            vendor_prefixes = ['ms', 'moz', 'webkit', 'o'];
            audio_context_string = 'AudioContext';
            length = vendor_prefixes.length;
            for (x = 0; x < length; x += 1) {
                entry = global[vendor_prefixes[x] + audio_context_string];
                if (entry && typeof entry === 'function') {
                    global.AudioContext = entry;
                    return true;
                }
            }
            return false;
        }
        return true;
    };
    if (hasAudioContext()) {
        noop = function noop() {
            return;
        };
        soundbrix_audio_context = new global.AudioContext();
    } else {
        console.log("This host doesn't have a Web Audio API implementation.");
        return;
    }
    loadSound = function loadSound(url, callback) {
        var request = new XMLHttpRequest();
        // Load sound synchronously (the 'false' flag), 'true' means asynchronous
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.addEventListener('load', function () { callback(request.response); }, false);
        request.send();
    };
    // ds and us mean 'default settings' and 'user settings', respectively. Now you know. - Manny
    mergeSettings = function mergeSettings(ds, us) {
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
    };
    SOUNDBRIX = {
        // This type creates a new buffer source everytime an instance of the sound is played to allow multiple playback of the same sound (multishot) but can't be paused or stopped
        "Type1": function Type1(user_settings) {
            var self = this,
                max_gain = 100,
                settings,
                default_settings = {
                    loop: false,
                    playback_rate: 1,
                    gain: 100
                };
            settings = mergeSettings(default_settings, user_settings);
            settings.gain = (settings.gain >= max_gain) ? 1 : (settings.gain / max_gain) * (settings.gain / max_gain);
            if (settings.source === undefined) {
                alert('ERROR: No sound source url!\nFailed to create sound object.');
                return;
            }
            function setMethods() {
                self.playSound = function playSound() {
                    var channel, gainNode;
                    channel = soundbrix_audio_context.createBufferSource();
                    channel.buffer = self.audio_buffer;
                    channel.loop = false;
                    channel.playbackRate.value = settings.playback_rate;
                    if (soundbrix_audio_context.createGainNode === undefined) {
                        channel.connect(soundbrix_audio_context.destination);
                    } else {
                        gainNode = soundbrix_audio_context.createGainNode();
                        gainNode.connect(soundbrix_audio_context.destination);
                        gainNode.gain.value = settings.gain;
                        channel.connect(gainNode);
                    }
                    if (channel.noteOn !== undefined) { channel.noteOn(0); }
                };
                self.setVolume = function setVolume(value) {
                    var fraction;
                    if (value > max_gain) { value = max_gain; }
                    fraction = value / max_gain;
                    settings.gain = fraction * fraction; // Using x * x curve to smooth out transition
                };
                self.setPlaybackRate = function setPlaybackRate(value) {
                    settings.playback_rate = value;
                };
            }
            function loadSuccess(buffer) {
                // This block will run when the buffer has been decoded. Insert all remaining sound object code here
                self.audio_buffer = buffer;
                setMethods();
                if (settings.callback !== undefined && typeof settings.callback === 'function') { setTimeout(settings.callback, 10); } //The callback MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements
            }
            function loadFail() {
                alert('Failed to load source!');
            }
            function loadCallback(response) {
                // For some instances, the createBuffer method is preferred over decodeAudioData to forcibly decode the buffer without waiting for callbacks
                //self.audio_buffer = soundbrix_audio_context.createBuffer(request.response, false);
                soundbrix_audio_context.decodeAudioData(response, loadSuccess, loadFail);
            }
            self.playSound = noop;
            self.setVolume = noop;
            self.setPlaybackRate = noop;
            loadSound(settings.source, loadCallback);
        },
        // This type uses 'sound channels' to allow multiple playback of the same sound (multishot)
        "Type2": function Type2(user_settings) {
            var self = this,
                settings,
                gainNode = [],
                max_gain = 100,
                default_settings = {
                    loop: false,
                    playback_rate: 1,
                    gain: 100,
                    max_channels: 1
                };
            self.channel_busy = [];
            self.source_channels = {};
            self.current_sound_channel = 0;
            self.audio_buffer = null;
            self.is_playing = false;
            settings = mergeSettings(default_settings, user_settings);
            settings.gain = (settings.gain >= max_gain) ? 1 : (settings.gain / max_gain) * (settings.gain / max_gain);
            settings.max_channels += 1; // Sneakily increment the number of channels by one to provide a 'buffer' for setting up a new sound source. See the sound channel lag fix inside the self.playSound method
            if (settings.source === undefined) {
                alert('ERROR: No sound source url!\nFailed to create sound object.');
                return;
            }
            function createChannels() {
                var i;
                for (i = 0; i < settings.max_channels; i += 1) {
                    self.source_channels[i] = soundbrix_audio_context.createBufferSource();
                    self.source_channels[i].buffer = self.audio_buffer;
                    self.source_channels[i].loop = false;
                    self.source_channels[i].playbackRate.value = settings.playback_rate;
                    if (soundbrix_audio_context.createGainNode === undefined) {
                        self.source_channels[i].connect(soundbrix_audio_context.destination);
                    } else {
                        gainNode[i] = soundbrix_audio_context.createGainNode();
                        gainNode[i].connect(soundbrix_audio_context.destination);
                        gainNode[i].gain.value = settings.gain;
                        self.source_channels[i].connect(gainNode[i]);
                    }
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
                    if (self.source_channels[self.current_sound_channel].noteOn !== undefined) { self.source_channels[self.current_sound_channel].noteOn(0); }
                    self.channel_busy[self.current_sound_channel] = true;
                    /*
                        
                        The solution below fixes sound-playing lag caused by some latency when creating new AudioBufferSourceNode (via the context.createBufferSource() method)
                        Basically it re-initializes the sound channel following the current one to prepare the nextchannel for playback (and somewhat avoiding the said latency)
                        
                    */
                    // Start sound channel lag fix
                    if (settings.max_channels > 1) {
                        var next_channel;
                        if (self.current_sound_channel + 1 >= settings.max_channels) {
                            next_channel = 0;
                        } else {
                            next_channel = self.current_sound_channel + 1;
                        }
                        if (self.channel_busy[next_channel]) {
                            if (self.source_channels[next_channel].noteOff !== undefined) { self.source_channels[next_channel].noteOff(0); }
                            self.source_channels[next_channel] = soundbrix_audio_context.createBufferSource();
                            self.source_channels[next_channel].buffer = self.audio_buffer;
                            self.source_channels[next_channel].loop = false;
                            self.source_channels[next_channel].playbackRate.value = settings.playback_rate;
                            if (soundbrix_audio_context.createGainNode === undefined) {
                                self.source_channels[next_channel].connect(soundbrix_audio_context.destination);
                            } else {
                                gainNode[next_channel] = soundbrix_audio_context.createGainNode();
                                gainNode[next_channel].connect(soundbrix_audio_context.destination);
                                gainNode[next_channel].gain.value = settings.gain;
                                self.source_channels[next_channel].connect(gainNode[next_channel]);
                            }
                            self.channel_busy[next_channel] = false;
                        }
                    }
                    // End sound channel lag fix
                };
                self.stopSound = function stopSound() {
                    var i;
                    if (self.is_playing) {
                        self.is_playing = false;
                        for (i = 0; i < settings.max_channels; i += 1) {
                            if (self.source_channels[i].noteOff !== undefined) {
                                // Let's check first if the current channel is 'busy' before calling noteOff. Why? Because Chrome throws an error when calling noteOff on unplayed buffer sources.
                                if (self.channel_busy[i]) {
                                    self.source_channels[i].noteOff(0);
                                }
                            }
                        }
                        createChannels();
                    }
                };
                self.setVolume = function setVolume(value) {
                    var fraction, i;
                    if (value > max_gain) { value = max_gain; }
                    fraction = value / max_gain;
                    settings.gain = fraction * fraction; // Using x * x curve to smooth out transition
                    for (i = 0; i < gainNode.length; i += 1) {
                        gainNode[i].gain.value = settings.gain;
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
            function loadSuccess(buffer) {
                // This block will run when the buffer has been decoded. Insert all remaining sound object code here
                self.audio_buffer = buffer;
                createChannels();
                setMethods();
                if (settings.callback !== undefined && typeof settings.callback === 'function') { setTimeout(settings.callback, 10); } //The callback MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements
            }
            function loadFail() {
                alert('Failed to load source!');
            }
            function loadCallback(response) {
                // For some instances, the createBuffer method is preferred over decodeAudioData to forcibly decode the buffer without waiting for callbacks
                //self.audio_buffer = soundbrix_audio_context.createBuffer(request.response, false);
                soundbrix_audio_context.decodeAudioData(response, loadSuccess, loadFail);
            }
            self.playSound = noop;
            self.stopSound = noop;
            self.setVolume = noop;
            self.setPlaybackRate = noop;
            loadSound(settings.source, loadCallback);
        }
    };
    Object.defineProperty(SOUNDBRIX, 'audioContext', {
        get: function get() {
            return soundbrix_audio_context;
        },
        set: function set(value) {
            console.log('Sorry, you are not allowed to modify this property. You entered: ' + value);
            return soundbrix_audio_context;
        },
        enumerable: true,
        configurable: false
    });
}(window));
