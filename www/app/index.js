'use strict';

function noop() {}

function bindEvents(thisArg, events) {
   Object.keys(events).forEach(function (selector) {
        Object.keys(events[selector]).forEach(function (event) {
            var handler = events[selector][event].bind(thisArg);
            if('document' === selector) {
                document.addEventListener(event, handler, false);
            } else if ('window' === selector) {
                window.addEventListener(event, handler, false);
            } else {
                document.querySelectorAll(selector).forEach(function (dom) {
                    dom.addEventListener(event, handler, false);
                });
            }
        });
    }); // all events bound
}

function f(name, params) {
  params = Array.prototype.slice.call(arguments, 1, arguments.length);
  return name + '(' + params.join(', ') + ') ';
}

var IS_CORDOVA = !!window.cordova;

var app = {
  // options
  DATA_KEY: 'com.metaist.intervalclock.data',
  store: null,
  options: {
    debug: true,
    frequency: 100,
    intervals: ['0:05:00', '0:01:00']
    // intervals: ['0:00:10', '0:00:05']
  },

  // internal
  running: false,
  tstart: 0,
  tpause: 0,
  tnow: 0,

  total: moment.duration(), // total interval

  clock: null,
  prev: 0,

  // DOM
  $app: null,
  $audio: null,
  $ball: null,

  init: function () {
    bindEvents(this, {
      'document': {'deviceready': this.ready},
      'form input': {'change': this.change},
      '#btn-play': {'click': this.play},
      '#btn-reset': {'click': this.reset},
      '#btn-pause': {'click': this.pause}
    });

    if(!IS_CORDOVA) {
      this.options.debug && console.log('NOT cordova');
      bindEvents(this, {'window': {'load': this.ready}});
    }

    return this;
  },

  ready: function () {
    // Store DOM nodes
    this.$app = $('#app');
    this.$audio = $('audio')[0];
    this.$ball = $('#ball')[0];

    // Grab preferences
    if(IS_CORDOVA) {
      this.store = plugins.appPreferences;
      this.store.fetch(this.DATA_KEY).then(function (data) {
        Object.assign(this.options, data || {});
        this.options.intervals.forEach(function (interval, idx) {
          this.total.add(interval);
          document.querySelector('#int-' + (idx + 1)).parentElement
                  .MaterialTextfield.change(interval);
        }.bind(this));
        this.reset();
      }.bind(this));
    }

    return this;
  },

  change: function () {
    this.total = moment.duration();
    var i = 1;
    var ints = [];
    var box = document.querySelector('#int-' + i);
    while(box) {
      ints.push(box.value);
      this.total.add(box.value);

      i++;
      box = document.querySelector('#int-' + i);
    }

    this.options.intervals = ints;

    if (IS_CORDOVA) {
      this.store.store(noop, noop, this.DATA_KEY, this.options);
    }//end if: options stored

    return this.reset();
  },

  render: function () {
    var elapsed = (this.running ? moment.now() - this.tstart : 0) + this.tpause;
    var total = this.total.asMilliseconds();
    var into = moment.duration(elapsed % total);
    var curr = null;

    var acc = moment.duration();
    this.options.intervals.forEach(function (item, idx) {
      var interval = moment.duration(item);
      acc.add(interval);

      if (acc.asMilliseconds() <= into.asMilliseconds()) {
        into.subtract(interval);
      } else if (null === curr) {
        curr = interval;
      }

      var percent = acc.asMilliseconds() / total;
      document.querySelector('.stop-' + (idx + 1)).style.transform =
        f('rotate', ((percent * 360) + 270) + 'deg') +
        f('translate', '45.5vmin');
    }.bind(this));

    var diff = curr.asMilliseconds() - into.asMilliseconds();
    var fmt = 'H:mm:ss';
    if (diff < 1 * 60 * 1000) { fmt = 'mm:ss.S'; }

    $('#time').set({text: moment.utc(diff).format(fmt)});
    // $('#debug').text(diff);
    if (diff < 2 * this.options.frequency) {
      this.ding();
    }

    var percent = elapsed / total;
    $('#laps').set({text: 'Round ' + (Math.floor(percent) + 1)});
    this.$ball.style.transform =
      f('rotate', ((elapsed / total * 360) + 270)  + 'deg') +
      f('translate', '45.5vmin');

    this.$app
      .toggleClass('is-playing', this.running)
      .toggleClass('is-paused', !this.running);

    return this;
  },

  ding: function () {
    var now = moment.now();
    if (now - this.prev < 2 * this.options.frequency) { return this; }

    this.prev = now;
    this.$audio.currentTime = 0.0;
    this.$audio.play();
    return this;
  },

  play: function () {
    this.tstart = moment.now();
    this.running = true;
    this.clock = window.setInterval(
      this.render.bind(this),
      this.options.frequency);

    return this.render();
  },

  pause: function () {
    window.clearInterval(this.clock);
    if(!this.$audio.paused) { app.$audio.pause(); }
    this.clock = null;
    this.tpause = moment.now() - this.tstart + this.tpause;
    this.running = false;
    return this.render();
  },

  reset: function () {
    window.clearInterval(this.clock);
    if(!this.$audio.paused) { app.$audio.pause(); }
    this.running = false;
    this.tstart = 0;
    this.tpause = 0;
    this.tnow = 0;
    return this.render();
  }
};

app.init();
