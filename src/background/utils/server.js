import { i18n, normalizeTag, sendCmd } from '@/common';
// import { forEachEntry } from '@/common/object';
import storage, { S_SERVER, S_SERVER_PRE, S_SERVER_CONFIG_PRE } from './storage';
// import storage, { S_SERVER, S_SERVER_PRE, S_SERVER_CONFIG, S_SERVER_CONFIG_PRE } from './storage';
import { dbKeys } from './storage-cache';

let maxServerId = 0;
let maxServerPosition = 0;

/** @type {{ [id: string]: MCPServer }} */
const serverMap = {};
/** @type {MCPServer[]} */
const aliveServers = [];
/** @type {MCPServer[]} */
const removedServers = [];

const DEFAULT_SERVER = {
  props: {
    id: 1,
    name: 'Calculator Server',
    description: 'A simple calculator server that can perform basic arithmetic operations',
    lastModified: Date.now(),
    lastUpdated: Date.now(),
    position: 0,
  },
  command: 'node',
  args: ['calculator-server.js'],
  config: {
    enabled: true,
    removed: false,
    shouldUpdate: true,
    connected: false,
  },
  custom: {
    icon: '',
    tags: 'calculator math default',
  },
};

/**
 * @typedef {Object} MCPServer
 * @property {Object} props - Server properties
 * @property {number} props.id - Unique identifier
 * @property {string} props.name - Server name
 * @property {string} props.description - Server description
 * @property {number} props.lastModified - Last modification timestamp
 * @property {number} props.lastUpdated - Last update timestamp
 * @property {number} props.position - Position in the list
 * @property {string} command - Server command
 * @property {string[]} args - Server arguments
 * @property {Object} config - Server configuration
 * @property {boolean} config.enabled - Whether the server is enabled
 * @property {boolean} config.removed - Whether the server is removed
 * @property {boolean} config.shouldUpdate - Whether the server should auto-update
 * @property {boolean} config.connected - Whether the server is currently connected
 * @property {Object} custom - Custom server data
 * @property {string} [custom.icon] - Custom server icon
 * @property {string} [custom.tags] - Custom server tags
 */

export function getDefaultServerConfig() {
  return {
    enabled: true,
    removed: false,
    shouldUpdate: true,
    connected: false,
  };
}

export function getDefaultCustom() {
  return {
    icon: '',
    tags: '',
  };
}

export function newServer() {
  const server = {
    props: {
      id: 0, // Will be set when saving
      name: '',
      description: '',
      lastModified: 0,
      lastUpdated: 0,
      position: 0,
    },
    command: '',
    args: [],
    config: getDefaultServerConfig(),
    custom: getDefaultCustom(),
  };
  return { server };
}

export function getServerById(id) {
  return serverMap[id];
}

export function getServer({ id, uri }) {
  return id ? getServerById(id) : uri && aliveServers.find(script => script.props.uri === uri);
}

export function getServers() {
  return aliveServers;
}

export function getRemovedServers() {
  return removedServers;
}

export function updateServerMap(key, val) {
  const id = +storage[S_SERVER].toId(key);
  if (!id) return;
  if (val) {
    const oldServer = serverMap[id];
    const i1 = aliveServers.indexOf(oldServer);
    const i2 = removedServers.indexOf(oldServer);
    if (i1 >= 0) aliveServers[i1] = val;
    if (i2 >= 0) removedServers[i2] = val;
    serverMap[id] = val;
  } else {
    delete serverMap[id];
  }
  return true;
}

export async function parseServer(src) {
  if (!src.props?.name) throw i18n('msgInvalidServer');
  const update = {
    message: src.message == null ? i18n('msgUpdated') : src.message || '',
  };
  const result = { update };
  const now = Date.now();
  let { id } = src;
  let server;
  let oldServer = getServer({ id });
  
  if (oldServer) {
    server = oldServer;
    id = server.props.id;
  } else {
    ({ server } = newServer());
    maxServerId++;
    id = server.props.id = maxServerId;
    result.isNew = true;
    update.message = i18n('msgInstalled');
    aliveServers.push(server);
  }

  const { config, custom, props } = server;
  
  // Overwriting inner data by `src`, deleting keys for which `src` specifies `null`
  for (const key of ['config', 'custom', 'props']) {
    const dst = server[key];
    const srcData = src[key];
    if (srcData) {
      Object.entries(srcData).forEach(([srcKey, srcVal]) => {
        if (srcVal == null) delete dst[srcKey];
        else dst[srcKey] = srcVal;
      });
    }
  }

  // Handle command and args
  if (src.command != null) server.command = src.command;
  if (src.args != null) server.args = src.args;

  props.lastModified = now;
  config.enabled = Boolean(config.enabled);
  config.removed = false;
  config.shouldUpdate = Boolean(config.shouldUpdate);
  
  custom.tags = custom.tags?.split(/\s+/).map(normalizeTag).filter(Boolean).join(' ').toLowerCase();

  await storage.base.set({
    [S_SERVER_PRE + id]: server,
    [S_SERVER_CONFIG_PRE + id]: config,
  });

  Object.assign(update, server);
  result.where = { id };
  sendCmd('UpdateServer', result);
  return result;
}

export async function removeServers(ids) {
  const idsToRemove = [];
  const newLen = 1 + removedServers.reduce((iAlive, server, i) => {
    const id = server.props.id;
    if (ids.includes(id)) {
      idsToRemove.push(S_SERVER_PRE + id, S_SERVER_CONFIG_PRE + id);
      delete serverMap[id];
    } else if (++iAlive < i) removedServers[iAlive] = server;
    return iAlive;
  }, -1);
  if (removedServers.length !== newLen) {
    removedServers.length = newLen;
    await storage.base.remove(idsToRemove);
    return sendCmd('RemoveServers', ids);
  }
}

// Initialize server data
(async () => {
  let allKeys, keys;
  if (storage.getStorageKeys) {
    allKeys = await storage.getStorageKeys();
    keys = allKeys.filter(key => {
      dbKeys.set(key, 1);
      return key.startsWith(S_SERVER_PRE);
    });
  }

  const data = await storage.base.getMulti(keys);
  const uriMap = {};
  const defaultCustom = getDefaultCustom();

  // If no servers exist, add the default server
  if (Object.keys(data).length === 0) {
    await storage.base.set({
      [S_SERVER_PRE + DEFAULT_SERVER.props.id]: DEFAULT_SERVER,
      [S_SERVER_CONFIG_PRE + DEFAULT_SERVER.props.id]: DEFAULT_SERVER.config,
    });
    data[S_SERVER_PRE + DEFAULT_SERVER.props.id] = DEFAULT_SERVER;
  }

  Object.entries(data).forEach(([key, server]) => {
    const id = +storage[S_SERVER].toId(key);
    if (id && server) {
      // Only check ID conflicts for servers not removed
      if (!server.config.removed) {
        if (serverMap[id] && serverMap[id] !== server) {
          // ID conflicts - should not happen, discard duplicates
          return;
        }
        if (uriMap[server.props.uri]) {
          // URI conflicts - should not happen, discard duplicates
          return;
        }
        uriMap[server.props.uri] = server;
      }

      server.props = {
        ...server.props,
        id,
      };
      server.custom = Object.assign({}, defaultCustom, server.custom);
      
      maxServerId = Math.max(maxServerId, id);
      maxServerPosition = Math.max(maxServerPosition, server.props.position || 0);
      
      (server.config.removed ? removedServers : aliveServers).push(server);
    }
  });
})(); 