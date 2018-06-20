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

    NOTE(S):
        - AudioScheduledSourceNode.onended fires when it has literally finished the playback, yes that means even when deliberately stopped via the stop() method
        - create silence -> SOUNDBRIX.ctx.createBuffer(2, SOUNDBRIX.ctx.sampleRate * sound.audioBuffer().duration, SOUNDBRIX.ctx.sampleRate)
*/
/*global AudioContext, AudioBuffer*/
/*jslint browser: true, devel: true, nomen: true, unparam: true, sub: true, regexp: true */

var SOUNDBRIX = (function (AudioContext, max) {
    "use strict";
    var ctx = new AudioContext(),
        masterGain = ctx.createGain(),
        noop = Function.prototype,
        hasOwnProperty = Object.prototype.hasOwnProperty;
    masterGain.gain.setValueAtTime(1, ctx.currentTime);
    masterGain.connect(ctx.destination);
    function getSettings(us) {
        var key, ds = {
            type: 'multishot',
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
    function toString() {
        return 'function ' + this.name + '() { [native code] }';
    }
    function Multishot(settings) {
        var that = this,
            playing = false,
            vol = settings.volume,
            playbackRate = settings.playbackRate,
            internalAudioBuffer = settings.audioBuffer instanceof AudioBuffer ? settings.audioBuffer : null,
            gainNode = ctx.createGain(),
            internalListOfBSN = [],
            sourceURL = settings.src || settings.href || settings.source || settings.url || settings.location;
        gainNode.connect(masterGain);
        this.getGainNode = function getGainNode() {
            return gainNode;
        };
        this.getType = function getType() {
            return settings.type;
        };
        this.getDuration = function getDuration() {
            if (internalAudioBuffer) {
                return internalAudioBuffer.duration;
            }
            return 0;
        };
        this.audioBuffer = function audioBuffer(ab) {
            if (arguments.length) {
                internalAudioBuffer = ab;
                return that;
            }
            return internalAudioBuffer;
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
            return !!internalAudioBuffer;
        };
        this.isPlaying = function isPlaying() {
            return playing;
        };
        function onended() {
            internalListOfBSN.shift();
            if (internalListOfBSN.length === 0) {
                playing = false;
                (settings.onend || noop).call(this);
            }
            //console.log(this === internalListOfBSN.shift());
        }
        this.play = function play() {
            var bsNode = ctx.createBufferSource(), currentTime = ctx.currentTime;
            if (internalAudioBuffer) {
                bsNode.buffer = internalAudioBuffer;
                //bsNode.loop = settings.loop;
                //bsNode.detune.setValueAtTime(-1200, ctx.currentTime);
                bsNode.playbackRate.setValueAtTime(playbackRate, currentTime);
                bsNode.onended = onended;
                bsNode.connect(gainNode);
                bsNode.start(currentTime);
                internalListOfBSN.push(bsNode);
                if (!playing) {
                    playing = true;
                    (settings.onplay || noop).call(this);
                }
            }
            return that;
        };
        this.stop = function stop() {
            var k, len, bsn;
            if (internalAudioBuffer && playing) {
                playing = false;
                for (k = 0, len = internalListOfBSN.length; k < len; k += 1) {
                    bsn = internalListOfBSN[k];
                    bsn.onended = null;
                    bsn.stop();
                }
                internalListOfBSN.length = 0;
                (settings.onstop || noop).call(this);
            }
            return that;
        };
        if (!internalAudioBuffer) {
            loadSound(
                sourceURL,
                function (response) {
                    ctx.decodeAudioData(
                        response,
                        function success(buffer) {
                            internalAudioBuffer = buffer;
                            setTimeout((settings.onload || noop), 0);
                        },
                        function fail() {
                            throw new Error('Failed to load source from ' + sourceURL);
                        }
                    );
                }
            );
        } else {
            setTimeout((settings.onload || noop), 0);
        }
    }
    function Loop(settings) {
        var that = this,
            playing = false,
            breakLoop = false,
            playTimerID = 0,
            isPlayTimerSet = false,
            vol = settings.volume,
            playbackRate = settings.playbackRate,
            internalAudioBuffer = settings.audioBuffer instanceof AudioBuffer ? settings.audioBuffer : null,
            gainNode = ctx.createGain(),
            currentBSN = null,
            nextBSN = null,
            nextPlaybackTime = 0,
            sourceURL = settings.src || settings.href || settings.source || settings.url || settings.location;
        gainNode.connect(masterGain);
        this.getGainNode = function getGainNode() {
            return gainNode;
        };
        this.getType = function getType() {
            return settings.type;
        };
        this.getDuration = function getDuration() {
            if (internalAudioBuffer) {
                return internalAudioBuffer.duration;
            }
            return 0;
        };
        this.audioBuffer = function audioBuffer(ab) {
            if (arguments.length) {
                internalAudioBuffer = ab;
                return that;
            }
            return internalAudioBuffer;
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
            return !!internalAudioBuffer;
        };
        this.isPlaying = function isPlaying() {
            return playing;
        };
        this.isWaiting = function isWaiting() {
            return isPlayTimerSet;
        };
        function onended() {
            if (!breakLoop) {
                nextPlaybackTime += internalAudioBuffer.duration;
                currentBSN = nextBSN;
                nextBSN = ctx.createBufferSource();
                nextBSN.buffer = internalAudioBuffer;
                nextBSN.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);
                nextBSN.onended = onended;
                nextBSN.connect(gainNode);
                nextBSN.start(nextPlaybackTime);
                (settings.onloop || noop).call(this, nextPlaybackTime);
            } else {
                breakLoop = false;
                nextPlaybackTime = 0;
                playing = false;
                currentBSN = null;
                (settings.onstop || noop).call(this);
            }
        }
        this.nextLoopTime = function nextLoopTime() {
            return nextPlaybackTime;
        };
        function playEventTimerCallback() {
            playing = true;
            isPlayTimerSet = false;
            (settings.onplay || noop).call(this, nextPlaybackTime);
        }
        this.play = function play(specificTime) {
            var currentTime = ctx.currentTime, startTime = 0, timeout = 0;
            if (arguments.length > 0) {
                if (typeof specificTime !== "number") {
                    throw new TypeError('parameter must be a number');
                }
            } else {
                specificTime = 0;
            }
            if (internalAudioBuffer && !playing && !isPlayTimerSet) {
                startTime = max(specificTime, currentTime);
                nextPlaybackTime = startTime + internalAudioBuffer.duration;
                currentBSN = ctx.createBufferSource();
                currentBSN.buffer = internalAudioBuffer;
                currentBSN.playbackRate.setValueAtTime(playbackRate, startTime);
                currentBSN.onended = onended;
                currentBSN.connect(gainNode);
                currentBSN.start(startTime);
                nextBSN = ctx.createBufferSource();
                nextBSN.buffer = internalAudioBuffer;
                nextBSN.playbackRate.setValueAtTime(playbackRate, startTime);
                nextBSN.onended = onended;
                nextBSN.connect(gainNode);
                nextBSN.start(nextPlaybackTime);
                timeout = max(0, (specificTime - currentTime) * 1000);
                if (timeout === 0) {
                    playing = true;
                    (settings.onplay || noop).call(this, nextPlaybackTime);
                } else {
                    playTimerID = setTimeout(playEventTimerCallback, timeout);
                    isPlayTimerSet = true;
                    (settings.onwait || noop).call(this, startTime);
                }
            }
            return that;
        };
        // 'end' basically stops the loop, but waits for the current sound to finish playing
        this.end = function end() {
            if (internalAudioBuffer && playing || isPlayTimerSet) {
                breakLoop = true;
                nextBSN.onended = null;
                nextBSN.stop(0);
                nextBSN = null;
            }
            return that;
        };
        function resetBSNs() {
            nextPlaybackTime = 0;
            currentBSN.onended = null;
            currentBSN.stop(0);
            currentBSN = null;
            if (!breakLoop) {
                nextBSN.onended = null;
                nextBSN.stop(0);
                nextBSN = null;
            } else {
                breakLoop = false;
            }
        }
        this.stop = function stop() {
            if (internalAudioBuffer && playing) {
                playing = false;
                resetBSNs();
                (settings.onstop || noop).call(this);
            } else if (isPlayTimerSet) {
                clearTimeout(playTimerID);
                isPlayTimerSet = false;
                resetBSNs();
                (settings.onwaitcancel || noop).call(this);
            }
            return that;
        };
        if (!internalAudioBuffer) {
            loadSound(
                sourceURL,
                function (response) {
                    ctx.decodeAudioData(
                        response,
                        function success(buffer) {
                            internalAudioBuffer = buffer;
                            setTimeout((settings.onload || noop), 0);
                        },
                        function fail() {
                            throw new Error('Failed to load source from ' + sourceURL);
                        }
                    );
                }
            );
        } else {
            setTimeout((settings.onload || noop), 0);
        }
    }
    Multishot.toString = toString;
    Loop.toString = toString;
    toString.toString = toString;
    return {
        createSound: function createSound(userSettings) {
            var settings;
            if (typeof userSettings !== "object") {
                throw new TypeError('parameter must be a plain object');
            }
            settings = getSettings(userSettings);
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
}((typeof AudioContext === "function" && AudioContext) || window.AudioContext || window.webkitAudioContext, Math.max));