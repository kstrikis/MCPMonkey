/* eslint-disable no-unused-vars, no-undef */
<template>
  <div class="server" :class="{focused}" :data-id="server.props.id">
    <div class="server-info">
      <div class="server-name">
        <span class="server-status" :class="{ connected: server.config.connected }"></span>
        <span v-text="server.props.name"></span>
      </div>
      <div class="server-meta">
        <span class="server-command">{{ server.command }}</span>
        <span class="server-args" v-if="server.args.length">{{ server.args.join(' ') }}</span>
      </div>
      <div class="server-desc" v-if="server.props.description" v-text="server.props.description"></div>
      <div class="server-tags" v-if="server.custom.tags">
        <span class="tag" v-for="tag in server.custom.tags.split(' ')" :key="tag" v-text="tag"></span>
      </div>
    </div>
    <div class="server-buttons">
      <Tooltip :content="server.config.enabled ? i18n('buttonDisable') : i18n('buttonEnable')" placement="bottom">
        <div class="server-button" @click="$emit('toggle', server)">
          <Icon :name="server.config.enabled ? TOGGLE_ON : TOGGLE_OFF" />
        </div>
      </Tooltip>
      <Tooltip :content="i18n('buttonUpdate')" placement="bottom" v-if="server.$canUpdate">
        <div class="server-button" @click="$emit('update', server, $event.target)">
          <Icon name="refresh" />
        </div>
      </Tooltip>
      <Tooltip :content="i18n('buttonConnect')" placement="bottom">
        <div class="server-button" @click="$emit('connect', server)" :class="{ active: server.config.connected }">
          <Icon name="link" />
        </div>
      </Tooltip>
      <Tooltip :content="i18n('buttonRemove')" placement="bottom">
        <div class="server-button" @click="$emit('remove', server)">
          <Icon name="trash" />
        </div>
      </Tooltip>
    </div>
  </div>
</template>

<script setup>
import { TOGGLE_OFF, TOGGLE_ON } from '../utils';
import Icon from '@/common/ui/icon';
import Tooltip from 'vueleton/lib/tooltip';

defineProps({
  server: {
    type: Object,
    required: true,
  },
  focused: {
    type: Boolean,
    default: false,
  },
  visible: {
    type: Boolean,
    default: true,
  },
  viewTable: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['toggle', 'update', 'remove', 'connect']);
</script>

<style lang="css">
.server {
  display: flex;
  padding: 1rem;
  border-bottom: 1px solid var(--fill-5);
  transition: background-color 0.2s;
  &:hover {
    background: var(--fill-0-5);
  }
  &.focused {
    background: var(--fill-2);
  }
}

.server-info {
  flex: 1;
  min-width: 0;
  margin-right: 1rem;
}

.server-name {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
}

.server-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fill-6);
  margin-right: 0.5rem;
  transition: background-color 0.2s;
  &.connected {
    background: var(--green-5);
  }
}

.server-meta {
  color: var(--fill-6);
  font-size: 0.9em;
  margin-bottom: 0.5rem;
  .server-command {
    font-family: monospace;
  }
  .server-args {
    margin-left: 1rem;
    font-family: monospace;
    color: var(--fill-5);
  }
}

.server-desc {
  color: var(--fill-7);
  font-size: 0.9em;
  margin-bottom: 0.5rem;
}

.server-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  .tag {
    background: var(--fill-2);
    color: var(--fill-7);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8em;
  }
}

.server-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.server-button {
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
  &:hover {
    background: var(--fill-2);
  }
  &.active {
    color: var(--green-5);
  }
  svg {
    width: 1.2rem;
    height: 1.2rem;
  }
}
</style> 