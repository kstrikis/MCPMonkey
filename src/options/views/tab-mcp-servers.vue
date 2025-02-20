/* eslint-disable no-unused-vars, no-undef */
<template>
  <div class="tab-mcp-servers" ref="scroller">
    <div v-if="store.canRenderServers">
      <header class="flex">
        <div class="btn-group">
          <Dropdown
            v-model="state.menuNew"
            :class="{active: state.menuNew}"
            :closeAfterClick="true">
            <Tooltip :content="i18n('buttonNew')" placement="bottom" align="start" :disabled="state.menuNew">
              <a class="btn-ghost" tabindex="0" ref="$menuNew">
                <Icon name="plus" />
              </a>
            </Tooltip>
            <template #content>
              <a class="dropdown-menu-item"
                v-for="([text, props], i) in NEW_LINKS" :key="i" v-text="text" v-bind="props"/>
            </template>
          </Dropdown>
          <Tooltip :content="i18n('updateServersAll')" placement="bottom" align="start">
            <a class="btn-ghost" tabindex="0" @click="handleActionUpdate(null, $event.target)">
              <Icon name="refresh" />
            </a>
          </Tooltip>
        </div>
        <div class="flex-auto"></div>
        <span class="ml-1">{{ i18n('sortOrder') }}
          <select :value="filters.sort" @change="handleOrderChange" class="h-100">
            <option
              v-for="(option, name) in filterOptions.sort"
              v-text="option.title"
              :key="name"
              :value="name">
            </option>
          </select>
        </span>
        <form class="filter-search hidden-xs" @submit.prevent
              :style="{ 'min-width': '10em', 'max-width': 5 + Math.max(20, state.search.value.length) + 'ex' }">
          <label>
            <input
              type="search"
              :class="{'has-error': state.search.error}"
              :title="state.search.error"
              :placeholder="i18n('labelSearchServer')"
              v-model="state.search.value"
              ref="refSearch"
              id="servers-search">
            <Icon name="search" />
          </label>
        </form>
      </header>
      <div v-if="message" class="hint mx-1 my-1 flex flex-col" v-text="message"></div>
      <div class="servers"
        v-focus="!state.server"
        ref="refList"
        :style="`--num-columns:${state.numColumns}`"
        :data-columns="state.numColumns"
        :data-show-order="filters.showOrder || null"
        :data-table="filters.viewTable || null">
        <ServerItem
          v-for="(server, index) in state.sortedServers"
          v-show="!state.search.rules.length || server.$cache.show !== false"
          :key="server.props.id"
          :focused="selectedServer === server"
          :server="server"
          :draggable="true"
          :visible="index < state.batchRender.limit"
          :viewTable="filters.viewTable"
          @remove="handleActionRemove"
          @toggle="handleActionToggle"
          @update="handleActionUpdate"
          @connect="handleActionConnect"
        />
      </div>
    </div>
    <EditServer
      v-if="state.editingServer"
      :serverId="state.editingServer"
      @close="state.editingServer = null"
    />
  </div>
</template>

<script setup>
/* eslint-disable no-unused-vars, no-undef */
import { computed, reactive, nextTick, onMounted, watch, ref, onBeforeUnmount } from 'vue';
import { i18n, sendCmdDirectly, debounce, ensureArray, makePause, trueJoin } from '@/common';
import options from '@/common/options';
import { EXTERNAL_LINK_PROPS, getActiveElement, isTouch, showConfirmation, showMessage, vFocus } from '@/common/ui';
import hookSetting from '@/common/hook-setting';
import { forEachKey } from '@/common/object';
import { setRoute, lastRoute } from '@/common/router';
import { keyboardService, handleTabNavigation } from '@/common/keyboard';
import { TAB_SETTINGS } from '@/common/safe-globals';
import { loadData } from '@/options';
import Dropdown from 'vueleton/lib/dropdown';
import Tooltip from 'vueleton/lib/tooltip';
import Icon from '@/common/ui/icon';
import { customCssElem, findStyleSheetRules } from '@/common/ui/style';
import {
  createSearchRules, performSearch, runInBatch, setLocationHash, store, TOGGLE_OFF, TOGGLE_ON,
} from '../utils';
import ServerItem from './server-item';
import EditServer from './edit-server';

const NEW_LINKS = [
  [i18n('buttonNew'),
    { tabIndex: 0, onclick: () => handleEditServer('_new') }],
  [i18n('connectToServer'),
    { tabIndex: 0, onclick: handleConnectToServer }],
];

const EDIT = 'edit';
const REMOVE = 'remove';
const TOGGLE = 'toggle';
const UPDATE = 'update';
const CONNECT = 'connect';

const filterOptions = {
  sort: {
    alpha: {
      title: i18n('filterAlphabeticalOrder'),
      compare: (
        { $cache: { lowerName: a } },
        { $cache: { lowerName: b } },
      ) => (a < b ? -1 : a > b),
    },
    [UPDATE]: {
      title: i18n('filterLastUpdateOrder'),
      compare: (
        { props: { lastUpdated: a } },
        { props: { lastUpdated: b } },
      ) => (+b || 0) - (+a || 0),
    },
  },
};

const filters = reactive({
  searchScope: null,
  showEnabledFirst: null,
  showOrder: null,
  viewSingleColumn: null,
  viewTable: null,
  sort: null,
});

Object.keys(filters).forEach(key => {
  hookSetting(`filters.${key}`, (val) => {
    filters[key] = val;
    if (key === 'sort' && !filterOptions.sort[val]) filters[key] = Object.keys(filterOptions.sort)[0];
  });
});

const state = reactive({
  focusedIndex: -1,
  menuNew: false,
  search: store.search = {
    value: '',
    error: null,
    ...createSearchRules(''),
  },
  sortedServers: [],
  filteredServers: [],
  server: null,
  numColumns: 1,
  batchRender: {
    limit: 0,
  },
  editingServer: null,
});

const selectedServer = computed(() => state.filteredServers[state.focusedIndex]);
const message = computed(() => {
  if (store.loading) {
    return null;
  }
  if (state.search.rules.length ? !state.sortedServers.find(s => s.$cache.show !== false) : !state.sortedServers.length) {
    return i18n('labelNoSearchServers');
  }
  return null;
});

function handleOrderChange(e) {
  options.set('filters.sort', e.target.value);
}

async function handleConnectToServer() {
  try {
    let url = await showConfirmation(i18n('hintInputServerURL'), {
      input: '',
      ok: { type: 'submit' },
    });
    url = url?.trim();
    if (url) {
      if (!url.includes('://')) url = `wss://${url}`;
      // test if URL is valid
      new URL(url);
      await sendCmdDirectly('ConnectToServer', { url });
    }
  } catch (err) {
    showMessage({ text: err.message || err });
  }
}

function handleActionRemove(server) {
  sendCmdDirectly('RemoveServer', server.props.id);
}

function handleActionToggle(server) {
  return sendCmdDirectly('UpdateServer', {
    id: server.props.id,
    config: {
      enabled: !server.config.enabled,
    },
  });
}

async function handleActionUpdate(what, el) {
  if (el) (el = (el.querySelector('svg') || el.closest('svg') || el).classList).add('rotate');
  await sendCmdDirectly('CheckServerUpdate', what && ensureArray(what).map(s => s.props.id));
  el?.remove('rotate');
}

async function handleActionConnect(server) {
  try {
    await sendCmdDirectly('ConnectToServer', { url: server.props.url });
  } catch (err) {
    showMessage({ text: err.message || err });
  }
}

function handleEditServer(id) {
  state.editingServer = id;
}

const debouncedSearch = debounce(scheduleSearch, 100);
const debouncedRender = debounce(renderScripts);

function scheduleSearch() {
  try {
    state.search = store.search = {
      ...state.search,
      ...createSearchRules(state.search.value),
    };
    state.search.error = null;
  } catch (err) {
    state.search.error = err.message;
  }
  onUpdate();
}

function onUpdate() {
  const servers = [...getCurrentList()];
  const rules = state.search.rules;
  const numFound = rules.length ? performSearch(servers, rules) : servers.length;
  const cmp = filterOptions.sort[filters.sort]?.compare;
  if (cmp) servers.sort(cmp);
  state.sortedServers = servers;
  state.filteredServers = rules.length ? servers.filter(({ $cache }) => $cache.show) : servers;
  selectServer(state.focusedIndex);
  if (!step || numFound < step) renderScripts();
  else debouncedRender();
}

function selectServer(index) {
  index = Math.min(index, state.filteredServers.length - 1);
  index = Math.max(index, -1);
  if (index !== state.focusedIndex) {
    state.focusedIndex = index;
  }
}

function getCurrentList() {
  return store.servers;
}

function renderScripts() {
  state.batchRender.limit = state.sortedServers.length;
}

watch(() => state.search.value, debouncedSearch);

onMounted(() => {
  state.numColumns = Math.max(1, Math.floor(window.innerWidth / 300));
  window.addEventListener('resize', () => {
    state.numColumns = Math.max(1, Math.floor(window.innerWidth / 300));
  });
  onUpdate();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', () => {
    state.numColumns = Math.max(1, Math.floor(window.innerWidth / 300));
  });
});
</script>

<style lang="css">
.tab-mcp-servers {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

.servers {
  display: grid;
  grid-template-columns: repeat(var(--num-columns), 1fr);
  gap: 1rem;
  padding: 1rem 0;
}

.btn-group {
  display: flex;
  gap: 0.5rem;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    background: var(--fill-2);
  }
  svg {
    width: 1.2rem;
    height: 1.2rem;
  }
}

.filter-search {
  position: relative;
  margin-left: 1rem;
  label {
    display: flex;
    align-items: center;
  }
  input {
    padding: 0.5rem 2rem 0.5rem 0.5rem;
    border: 1px solid var(--fill-5);
    border-radius: 4px;
    background: transparent;
    color: var(--fill-9);
    &:focus {
      outline: none;
      border-color: var(--fill-6);
    }
    &.has-error {
      border-color: var(--red-5);
    }
  }
  svg {
    position: absolute;
    right: 0.5rem;
    width: 1rem;
    height: 1rem;
    color: var(--fill-6);
  }
}

.dropdown-menu-item {
  display: block;
  padding: 0.5rem 1rem;
  color: var(--fill-9);
  text-decoration: none;
  cursor: pointer;
  &:hover {
    background: var(--fill-2);
  }
}

.hint {
  padding: 1rem;
  background: var(--fill-1);
  border-radius: 4px;
  color: var(--fill-7);
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.rotate {
  animation: rotate 1s linear infinite;
}
</style> 