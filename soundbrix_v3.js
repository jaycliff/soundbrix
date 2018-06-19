/*
    Copyright 2018 Jaycliff Arcilla of Eversun Software Philippines Corporation (Davao branch)
    
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
*/
/*global AudioContext, AudioBuffer*/
/*jslint browser: true, devel: true, nomen: true, unparam: true, sub: true, regexp: true */

var SOUNDBRIX = (function (AudioContext) {
    "use strict";
    var ctx = new AudioContext(),
        masterGain = ctx.createGain(),
        noop = Function.prototype,
        hasOwnProperty = Object.prototype.hasOwnProperty;
    masterGain.gain.setValueAtTime(1, ctx.currentTime);
    masterGain.connect(ctx.destination);
    function getSettings(us) {
        var key, ds = {
            html5: false,
            playbackRate: 1,
            volume: 1
        };
        for (key in us) {
            if (hasOwnProperty.call(us, key)) {
                ds[key] = us[key];
            }
        }
        return ds;
    }
    // loadSound creates garbage
    function loadSound(url, callback) {
        var request = new XMLHttpRequest();
        // Load the sound asynchronously ('true' means asynchronous)
        // Synchronous operations in JavaScript are greatly discouraged
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onload = function () {
            callback(request.response);
        };
        request.send();
    }
    function Multishot(settings) {
        var that = this,
            playing = false,
            vol = settings.volume,
            playbackRate = settings.playbackRate,
            audio_buffer = null,
            gainNode = ctx.createGain(),
            internal_list_of_bsn = [],
            source_url = settings.src || settings.href || settings.source || settings.url || settings.location;
        console.log(source_url, settings);
        gainNode.connect(masterGain);
        this.getGainNode = function getGainNode() {
            return gainNode;
        };
        this.getType = function getType() {
            return settings.type;
        };
        this.getDuration = function getDuration() {
            if (audio_buffer) {
                return audio_buffer.duration;
            }
            return 0;
        };
        this.audioBuffer = function audioBuffer(ab) {
            if (arguments.length) {
                audio_buffer = ab;
                return that;
            }
            return audio_buffer;
        };
        this.volume = function volume(value) {
            if (typeof value !== "number") {
                throw new TypeError('parameter must be a number');
            }
            if (arguments.length > 0) {
                vol = value;
                return that;
            }
            return vol;
        };
        this.isReady = function isReady() {
            return !!audio_buffer;
        };
        this.isPlaying = function isPlaying() {
            return playing;
        };
        function onended() {
            internal_list_of_bsn.shift();
            if (internal_list_of_bsn.length === 0) {
                playing = false;
                (settings.onend || noop)();
            }
            //console.log(this === internal_list_of_bsn.shift());
        }
        this.play = function play() {
            var bsNode = ctx.createBufferSource(), currentTime = ctx.currentTime;
            if (audio_buffer) {
                bsNode.buffer = audio_buffer;
                //bsNode.loop = settings.loop;
                //bsNode.detune.setValueAtTime(-1200, ctx.currentTime);
                bsNode.playbackRate.setValueAtTime(playbackRate, currentTime);
                bsNode.onended = onended;
                bsNode.connect(gainNode);
                bsNode.start(currentTime);
                internal_list_of_bsn.push(bsNode);
                if (!playing) {
                    playing = true;
                    (settings.onplay || noop)();
                }
            }
            return that;
        };
        this.stop = function stop() {
            var k, len, bsn;
            if (audio_buffer && playing) {
                playing = false;
                for (k = 0, len = internal_list_of_bsn.length; k < len; k += 1) {
                    bsn = internal_list_of_bsn[k];
                    bsn.onended = null;
                    bsn.stop();
                }
                internal_list_of_bsn.length = 0;
                (settings.onstop || noop)();
            }
            return that;
        };
        loadSound(
            source_url,
            function (response) {
                ctx.decodeAudioData(
                    response,
                    function success(buffer) {
                        audio_buffer = buffer;
                        if (typeof settings.onload === "function") {
                            setTimeout(settings.onload, 0);
                        }
                    },
                    function fail() {
                        throw new Error('Failed to load source from ' + source_url);
                    }
                );
            }
        );
    }
    function Loop(settings) {
        var that = this,
            playing = false,
            breakLoop = false,
            vol = settings.volume,
            playbackRate = settings.playbackRate,
            audio_buffer = settings.audioBuffer instanceof AudioBuffer ? settings.audioBuffer : null,
            gainNode = ctx.createGain(),
            currentBSN = null,
            nextBSN = null,
            nextPlaybackTime = 0,
            source_url = settings.src || settings.href || settings.source || settings.url || settings.location;
        console.log(source_url, settings);
        gainNode.connect(masterGain);
        this.getGainNode = function getGainNode() {
            return gainNode;
        };
        this.getType = function getType() {
            return settings.type;
        };
        this.getDuration = function getDuration() {
            if (audio_buffer) {
                return audio_buffer.duration;
            }
            return 0;
        };
        this.audioBuffer = function audioBuffer(ab) {
            if (arguments.length) {
                audio_buffer = ab;
                return that;
            }
            return audio_buffer;
        };
        this.volume = function volume(value) {
            if (typeof value !== "number") {
                throw new TypeError('parameter must be a number');
            }
            if (arguments.length) {
                vol = value;
                return that;
            }
            return vol;
        };
        this.isReady = function isReady() {
            return !!audio_buffer;
        };
        this.isPlaying = function isPlaying() {
            return playing;
        };
        function onended() {
            if (!breakLoop) {
                nextPlaybackTime += audio_buffer.duration;
                console.log(nextPlaybackTime);
                currentBSN = nextBSN;
                nextBSN = ctx.createBufferSource();
                nextBSN.buffer = audio_buffer;
                nextBSN.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);
                nextBSN.onended = onended;
                nextBSN.connect(gainNode);
                nextBSN.start(nextPlaybackTime);
                (settings.onloop || noop)();
            } else {
                breakLoop = false;
                nextPlaybackTime = 0;
                playing = false;
                currentBSN = null;
                (settings.onstop || noop)();
            }
        }
        this.nextLoopTime = function nextLoopTime() {
            return nextPlaybackTime;
        };
        this.play = function play() {
            var currentTime = ctx.currentTime;
            if (audio_buffer && !playing) {
                playing = true;
                nextPlaybackTime = currentTime + audio_buffer.duration;
                currentBSN = ctx.createBufferSource();
                currentBSN.buffer = audio_buffer;
                currentBSN.playbackRate.setValueAtTime(playbackRate, currentTime);
                currentBSN.onended = onended;
                currentBSN.connect(gainNode);
                currentBSN.start(currentTime);
                nextBSN = ctx.createBufferSource();
                nextBSN.buffer = audio_buffer;
                nextBSN.playbackRate.setValueAtTime(playbackRate, currentTime);
                nextBSN.onended = onended;
                nextBSN.connect(gainNode);
                nextBSN.start(nextPlaybackTime);
                (settings.onplay || noop)();
            }
            return that;
        };
        // 'end' basically stops the loop, but waits for the current sound to finish playing
        this.end = function end() {
            if (audio_buffer && playing) {
                breakLoop = true;
                nextBSN.onended = null;
                nextBSN.stop(0);
                nextBSN = null;
            }
            return that;
        };
        this.stop = function stop() {
            if (audio_buffer && playing) {
                playing = false;
                nextPlaybackTime = 0;
                currentBSN.onended = null;
                nextBSN.onended = null;
                currentBSN.stop(0);
                nextBSN.stop(0);
                currentBSN = null;
                nextBSN = null;
                (settings.onstop || noop)();
            }
            return that;
        };
        loadSound(
            source_url,
            function (response) {
                ctx.decodeAudioData(
                    response,
                    function success(buffer) {
                        audio_buffer = buffer;
                        if (typeof settings.onload === "function") {
                            setTimeout(settings.onload, 0);
                        }
                    },
                    function fail() {
                        throw new Error('Failed to load source from ' + source_url);
                    }
                );
            }
        );
    }
    return {
        createSound: function createSound(user_settings) {
            var settings;
            if (typeof user_settings !== "object") {
                throw new TypeError('parameter must be a plain object');
            }
            settings = getSettings(user_settings);
            switch (settings.type) {
            case 'multishot':
                return new Multishot(settings);
            case 'loop':
                return new Loop(settings);
            default:
                return null;
            }
        },
        ctx: ctx,
        context: ctx,
        masterGain: masterGain
    };
}((typeof AudioContext === "function" && AudioContext) || window.AudioContext || window.webkitAudioContext));