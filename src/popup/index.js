import '@/common/browser';
import { sendCmdDirectly } from '@/common';
import handlers from '@/common/handlers';
import { loadScriptIcon } from '@/common/load-script-icon';
import { mapEntry } from '@/common/object';
import { isTouch, render } from '@/common/ui';
import '@/common/ui/style';
import App from './views/app';
import { emptyStore, store } from './utils';

let mutex, mutexResolve, port;
let hPrev;

initialize();
render(App);

Object.assign(handlers, {
  /** Must be synchronous to prevent the wrong visible popup from responding to the message */
  Run({ reset }, { [kFrameId]: frameId, tab }) {
    // The tab got reloaded so Run+reset comes right before SetPopup, see cmd-run.js
    if (reset && !frameId && isMyTab(tab)) {
      initialize();
    }
  },
  /** Must be synchronous to prevent the wrong visible popup from responding to the message */
  SetPopup(data, src) {
    if (isMyTab(src.tab)) {
      return setPopup(data, src);
    }
  },
});

async function setPopup(data = {}, { [kFrameId]: frameId, url } = {}) {
  try {
    const isTop = frameId === 0;
    if (!data[MORE]) {
      if (!data[IDS]) data[IDS] = {};
      Object.assign(data[IDS], await sendCmdDirectly('GetMoreIds', {
        url,
        [kTop]: isTop,
        [IDS]: data[IDS],
      }));
    }
    if (!isTop) await mutex;
    else {
      store[IS_APPLIED] = data[INJECT_INTO] !== 'off';
    }
    
    // Ensuring top script's menu wins over a per-frame menu with different commands
    store.commands = Object.assign(data.menus || {}, !isTop && store.commands);
    const idMapAllFrames = store.idMap;
    const idMapMain = idMapAllFrames[0] || (idMapAllFrames[0] = {});
    const idMapOld = idMapAllFrames[frameId] || (idMapAllFrames[frameId] = {});
    const idMap = (data[IDS] || {})::mapEntry(null, (id, val) => val !== idMapOld[id] && id);
    const ids = Object.keys(idMap).map(Number);
    
    if (ids.length) {
      Object.assign(idMapOld, idMap);
      const { frameScripts } = store;
      const scope = isTop ? store[SCRIPTS] : frameScripts;
      const metas = (data[SCRIPTS]?.filter(({ props: { id } = {} }) => ids.includes(id))
        || (Object.assign(data, await sendCmdDirectly('GetData', { ids })))[SCRIPTS]) || [];
      
      metas.forEach(script => {
        if (!script) return;
        loadScriptIcon(script, data);
        const { id } = script.props || {};
        if (!id) return;
        const state = idMap[id];
        const more = state === MORE;
        const badRealm = state === ID_BAD_REALM;
        const renderedScript = scope.find(({ props }) => props?.id === id);
        if (renderedScript) script = renderedScript;
        else if (isTop || !(id in idMapMain)) {
          scope.push(script);
          if (isTop) {
            const i = frameScripts.findIndex(({ props }) => props?.id === id);
            if (i >= 0) frameScripts.splice(i, 1);
          }
        }
        script.runs = state === CONTENT || state === PAGE;
        script.pageUrl = url;
        script.failed = badRealm || state === ID_INJECTING || more;
        script[MORE] = more;
        script.syntax = state === ID_INJECTING;
        if (badRealm && !store.injectionFailure) {
          store.injectionFailure = { fixable: data[INJECT_INTO] === PAGE };
        }
      });
    }
    if (isTop) mutexResolve();
    if (!hPrev) {
      hPrev = Math.max(innerHeight, 100);
      window.onresize = onResize;
      if (isTouch && hPrev > document.body.clientHeight) onResize();
    }
  } catch (err) {
    console.error('Error in setPopup:', err);
    mutexResolve();
  }
}

function initMutex(delay = 100) {
  mutex = new Promise(resolve => {
    mutexResolve = resolve;
    // pages like Chrome Web Store may forbid injection in main page so we need a timeout
    setTimeout(resolve, delay);
  });
}

async function initialize() {
  initMutex();
  Object.assign(store, emptyStore());
  try {
    let [cached, data = {}, [failure, reason, reason2] = []] = await sendCmdDirectly('InitPopup') || [];
    if (!data) data = {};
    if (!reason) {
      failure = '';
    } else if (reason === INJECT_INTO) {
      reason = 'noninjectable';
      data.injectable = false;
      mutexResolve();
    } else if (reason === SKIP_SCRIPTS) {
      reason = 'scripts-skipped';
    } else if (reason === IS_APPLIED) {
      reason = 'scripts-disabled';
    } else { // blacklisted
      data[reason] = reason2;
    }
    Object.assign(store, data, {
      failure: reason,
      failureText: failure,
    });
    if (cached) {
      for (const id in cached) {
        if (cached[id] && Array.isArray(cached[id])) {
          handlers.SetPopup(...cached[id]);
        }
      }
    }
    if (!port) {
      port = browser.runtime.connect({ name: `Popup:${cached ? 'C' : ''}:${data.tab?.id || ''}` });
      port.onMessage.addListener(initialize);
    }
  } catch (err) {
    console.error('Failed to initialize popup:', err);
    Object.assign(store, {
      failure: 'initialization-failed',
      failureText: err.message || 'Unknown error',
    });
    mutexResolve();
  }
}

function isMyTab(tab) {
  // No `tab` is a FF bug when it sends messages from removed iframes
  return tab && (!store.tab || store.tab.id === tab.id);
}

function onResize(evt) {
  const h = innerHeight;
  if (!evt
  // ignoring intermediate downsize
  || h > hPrev
  // ignoring  initial devicePixelRatio which is based on page zoom in this extension's tabs
    && document.readyState !== 'loading'
  // ignoring off-by-1 e.g. due to clientHeight being fractional
    && document.body.clientHeight - 1 > h
  ) {
    window.onresize = null;
    store.maxHeight = h + 'px';
  }
  hPrev = h;
}
