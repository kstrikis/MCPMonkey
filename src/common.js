'use strict';

_ = window._ || {};
_.i18n = chrome.i18n.getMessage;

_.options = function () {
  var defaults = {
    isApplied: true,
    autoUpdate: true,
    ignoreGrant: false,
    lastUpdate: 0,
    exportValues: true,
    closeAfterInstall: false,
    trackLocalFile: false,
    injectMode: 0,
  };

  function getOption(key, def) {
    var value = localStorage.getItem(key), obj;
    if (value)
      try {
        obj = JSON.parse(value);
      } catch(e) {
        obj = def;
      }
      else obj = def;
      if (obj == null) obj = defaults[key];
      return obj;
  }

  function setOption(key, value) {
    if (key in defaults)
      localStorage.setItem(key, JSON.stringify(value));
  }

  function getAllOptions() {
    var options = {};
    for (var i in defaults) options[i] = getOption(i);
    return options;
  }

  return {
    get: getOption,
    set: setOption,
    getAll: getAllOptions,
  };
}();

/*
function format() {
  var args = arguments;
  if (args[0]) return args[0].replace(/\$(?:\{(\d+)\}|(\d+))/g, function(value, group1, group2) {
		var index = typeof group1 != 'undefined' ? group1 : group2;
		return index >= args.length ? value : (args[index] || '');
  });
}
*/

function safeHTML(html) {
	return html.replace(/[&<]/g, function (m) {
		return {
			'&': '&amp;',
			'<': '&lt;',
		}[m];
	});
}
