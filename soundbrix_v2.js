/*
    Copyright 2012 Jaycliff Arcilla of Eversun Software Philippines Corporation (Davao branch)

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
    
    SoundBrix: Experimental HTML5 Sound Object Creation Library powered by Web Audio API (Version 1.3 - 06/30/2014)
    Author: Jaycliff Arcilla
    
    This library was created to provide sweet audio fallback options when crap happens (Flash Epic Fail).
    Moreover, my previous AoV client (Nigel S. Ball) is reasonably allergic to Flash, making this a perfect non-Flash audio solution for his websites.
    
    UPDATES:
    
    * v1.3 (06/30/2014) Refactored the sound object creation process and made several optimizations regarding the channel-switching playback of buffers
    * v1.2 (05/19/2014) Refactored checking for AudioContext constructor. Several optimizations.
    * v1.1 (09/05/2012) Made several enhancements to the creation process. Added gain nodes per sound source. Fixed volume setting method.
    * v1.0 (02/22/2012) Initial release.
    
    NOTES:
    
    * AudioBufferSourceNode can only be played once. To play another sound of the same source, another AudioBufferSourceNode must be created, which is stupid.
    * Callbacks MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements.
    
    ISSUES:
    
    * A gain node cannot accept new inputs starting from when the sound sources start playing. To counter this, a separate gain node for each sound source must be created. However, audio_context.destination doesn't seem to have this limitation.
    
    Passed JSLint checking! (http://www.jslint.com/)
    
    JSLINT OPTIONS:
    
    * Assume console, alert, ...
    * Assume a browser
    
*/

var SOUNDBRIX;
(function (global) {
    "use strict";
    var hasAudioContext,
        noop,
        loadSound,
        mergeSettings,
        soundbrix_audio_context;
    if (typeof SOUNDBRIX === 'object' && SOUNDBRIX.audioContext !== undefined) {
        console.log('An instance of SoundBrix has already been created.');
        return;
    }
    (function hasAudioContextSetup() {
        var vendor_prefixes = ['ms', 'moz', 'webkit', 'o'], audio_context_string = 'AudioContext';
        hasAudioContext = function hasAudioContext() {
            var entry,
                length,
                x;
            if (!global.AudioContext) {
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
    }());
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
        // Avoid using synchronous operations in JavaScript
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
    (function soundBrixSetup() {
        var max_gain = 100, default_settings = {
            exp: false,
            loop: false,
            playback_rate: 1,
            gain: 100,
            max_channels: 1
        };
        function Type1(settings) {
            var that = this, gain_rate = settings.gain / max_gain;
            function setMethods() {
                that.playSound = function playSound() {
                    var channel, gainNode;
                    channel = soundbrix_audio_context.createBufferSource();
                    channel.buffer = that.audio_buffer;
                    channel.loop = settings.loop;
                    channel.playbackRate.value = settings.playback_rate;
                    if (soundbrix_audio_context.createGain === undefined) {
                        channel.connect(soundbrix_audio_context.destination);
                    } else {
                        gainNode = soundbrix_audio_context.createGain();
                        gainNode.connect(soundbrix_audio_context.destination);
                        gainNode.gain.value = gain_rate * gain_rate;
                        channel.connect(gainNode);
                    }
                    if (channel.start !== undefined) {
                        channel.start(0);
                    }
                };
                that.setVolume = function setVolume(value) {
                    var fraction;
                    if (value > max_gain) { value = max_gain; }
                    fraction = value / max_gain;
                    settings.gain = fraction * fraction; // Using x * x curve to smooth out transition
                };
                that.setPlaybackRate = function setPlaybackRate(value) {
                    settings.playback_rate = value;
                };
            }
            function loadSuccess(buffer) {
                // This block will run when the buffer has been decoded. Insert all remaining sound object code here
                // For some instances, the createBuffer method is preferred over decodeAudioData to forcibly decode the buffer without waiting for callbacks
                //that.audio_buffer = soundbrix_audio_context.createBuffer(request.response, false);
                that.audio_buffer = buffer;
                setMethods();
                if (settings.callback !== undefined && typeof settings.callback === 'function') { setTimeout(settings.callback, 10); } //The callback MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements
            }
            function loadFail() {
                throw new Error('Failed to load source from ' + settings.source);
            }
            function loadCallback(response) {
                soundbrix_audio_context.decodeAudioData(response, loadSuccess, loadFail);
            }
            that.playSound = noop;
            that.stopSound = function stopSound() {
                console.log('This sound object cannot be stopped manually.');
                return;
            };
            that.setVolume = noop;
            that.setPlaybackRate = noop;
            loadSound(settings.source, loadCallback);
        }
        function Type2(settings) {
            var that = this, gainNode = [], gain_rate = settings.gain / max_gain;
            that.channel_busy = [];
            that.source_channels = {};
            that.current_sound_channel = 0;
            that.audio_buffer = null;
            that.is_playing = false;
            // Sneakily increment the number of channels by one to provide a 'buffer' for setting up a new sound source. See the sound channel lag fix inside the that.playSound method
            //settings.max_channels += 1;
            function createChannels() {
                var i;
                for (i = 0; i < settings.max_channels; i += 1) {
                    that.source_channels[i] = soundbrix_audio_context.createBufferSource();
                    that.source_channels[i].buffer = that.audio_buffer;
                    that.source_channels[i].loop = settings.loop;
                    that.source_channels[i].playbackRate.value = settings.playback_rate;
                    if (soundbrix_audio_context.createGain === undefined) {
                        console.log('No gain nodes.');
                        console.log(soundbrix_audio_context);
                        that.source_channels[i].connect(soundbrix_audio_context.destination);
                    } else {
                        gainNode[i] = soundbrix_audio_context.createGain();
                        gainNode[i].connect(soundbrix_audio_context.destination);
                        gainNode[i].gain.value = gain_rate * gain_rate;
                        that.source_channels[i].connect(gainNode[i]);
                    }
                    that.channel_busy[i] = false;
                }
            }
            function setMethods() {
                that.playSound = function playSound() {
                    that.is_playing = true;
                    if (that.channel_busy[that.current_sound_channel]) {
                        that.current_sound_channel += 1;
                        if (that.current_sound_channel === settings.max_channels) {
                            that.current_sound_channel = 0;
                        }
                    }
                    if (that.source_channels[that.current_sound_channel].start !== undefined) {
                        that.source_channels[that.current_sound_channel].start(0);
                    }
                    that.channel_busy[that.current_sound_channel] = true;
                    /*
                        
                        The solution below fixes sound-playing lag caused by some latency when creating new AudioBufferSourceNode (via the context.createBufferSource() method)
                        Basically it re-initializes the sound channel following the current one to prepare the nextchannel for playback (and somewhat avoiding the said latency)
                        
                    */
                    // Start sound channel lag fix
                    var next_channel;
                    next_channel = that.current_sound_channel + 1;
                    if (next_channel === settings.max_channels) {
                        next_channel = 0;
                    }
                    if (that.channel_busy[next_channel]) {
                        //if (that.source_channels[next_channel].stop !== undefined) { that.source_channels[next_channel].stop(0); }
                        // Simply replace the next busy channel with a new one. The old one will keep on playing and will eventually be collected.
                        that.source_channels[next_channel] = soundbrix_audio_context.createBufferSource();
                        that.source_channels[next_channel].buffer = that.audio_buffer;
                        that.source_channels[next_channel].loop = settings.loop;
                        that.source_channels[next_channel].playbackRate.value = settings.playback_rate;
                        if (soundbrix_audio_context.createGain === undefined) {
                            that.source_channels[next_channel].connect(soundbrix_audio_context.destination);
                        } else {
                            gainNode[next_channel] = soundbrix_audio_context.createGain();
                            gainNode[next_channel].connect(soundbrix_audio_context.destination);
                            gainNode[next_channel].gain.value = settings.gain;
                            that.source_channels[next_channel].connect(gainNode[next_channel]);
                        }
                        that.channel_busy[next_channel] = false;
                    }
                    // End sound channel lag fix
                };
                that.stopSound = function stopSound() {
                    var i;
                    if (that.is_playing) {
                        that.is_playing = false;
                        for (i = 0; i < settings.max_channels; i += 1) {
                            if (that.source_channels[i].stop !== undefined) {
                                // Let's check first if the current channel is 'busy' before calling stop. Why? Because Chrome throws an error when calling stop on unplayed buffer sources.
                                if (that.channel_busy[i]) {
                                    that.source_channels[i].stop(0);
                                }
                            }
                        }
                        createChannels();
                    }
                };
                that.setVolume = function setVolume(value) {
                    var fraction, i;
                    if (value > max_gain) { value = max_gain; }
                    fraction = value / max_gain;
                    settings.gain = fraction * fraction; // Using x * x curve to smooth out transition
                    for (i = 0; i < gainNode.length; i += 1) {
                        gainNode[i].gain.value = settings.gain;
                    }
                };
                that.setPlaybackRate = function setPlaybackRate(value) {
                    var i;
                    settings.playback_rate = value;
                    for (i = 0; i < settings.max_channels; i += 1) {
                        that.source_channels[i].playbackRate.value = value;
                    }
                };
            }
            function loadSuccess(buffer) {
                // This block will run when the buffer has been decoded. Insert all remaining sound object code here
                // For some instances, the createBuffer method is preferred over decodeAudioData to forcibly decode the buffer without waiting for callbacks
                //that.audio_buffer = soundbrix_audio_context.createBuffer(request.response, false);
                that.audio_buffer = buffer;
                createChannels();
                //console.log(that.source_channels[0]);
                setMethods();
                //The callback MUST be set off using a timer (setTimeout) so as not to wait for the callback to finish executing to proceed with the next statements
                if (settings.callback !== undefined && typeof settings.callback === 'function') { setTimeout(settings.callback, 10); }
            }
            function loadFail() {
                throw new Error('Failed to load source from ' + settings.source);
            }
            function loadCallback(response) {
                soundbrix_audio_context.decodeAudioData(response, loadSuccess, loadFail);
            }
            that.playSound = noop;
            that.stopSound = noop;
            that.setVolume = noop;
            that.setPlaybackRate = noop;
            loadSound(settings.source, loadCallback);
        }
        SOUNDBRIX = {
            createSound: function createSound(user_settings) {
                var settings;
                if (user_settings === undefined || typeof user_settings !== 'object') {
                    throw new Error('ERROR: A valid object parameter is required.');
                }
                user_settings.source = user_settings.source || user_settings.src || user_settings.href;
                if (user_settings.source === undefined) {
                    throw new Error('ERROR: No valid sound source url found!\nFailed to create sound object.');
                }
                settings = mergeSettings(default_settings, user_settings);
                // The actual gain value that should be in use for the buffer(s) must not be greater than one (1)
                settings.gain = (settings.gain >= max_gain) ? 1 : (settings.gain / max_gain) * (settings.gain / max_gain);
                if (settings.exp) {
                    return new Type1(settings);
                }
                return new Type2(settings);
            }
        };
    }());
    Object.defineProperty(SOUNDBRIX, 'audioContext', {
        get: function get() {
            return soundbrix_audio_context;
        },
        set: function set(value) {
            console.log('This property is read-only. You entered: ' + value);
            return;
        },
        enumerable: true,
        configurable: false
    });
    if (Object.freeze) {
        Object.freeze(SOUNDBRIX);
    }
}(window));
