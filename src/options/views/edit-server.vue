/* eslint-disable no-unused-vars, no-undef */
<template>
  <div class="edit-server">
    <header class="flex">
      <h2>{{ isNew ? i18n('buttonNew') : i18n('buttonEdit') }}</h2>
      <div class="flex-auto"></div>
      <div class="btn-group">
        <button class="btn-ghost" @click="handleSave">
          <Icon name="save" />
          {{ i18n('buttonSave') }}
        </button>
        <button class="btn-ghost" @click="handleCancel">
          <Icon name="x" />
          {{ i18n('buttonCancel') }}
        </button>
      </div>
    </header>
    <div class="form">
      <div class="form-group">
        <label>{{ i18n('labelName') }}</label>
        <input type="text" v-model="server.props.name" :placeholder="i18n('labelName')" />
      </div>
      <div class="form-group">
        <label>{{ i18n('labelCommand') }}</label>
        <input type="text" v-model="server.command" :placeholder="i18n('hintCommand')" />
      </div>
      <div class="form-group">
        <label>{{ i18n('labelArgs') }}</label>
        <textarea v-model="argsText" :placeholder="i18n('hintArgs')" rows="3"></textarea>
        <div class="hint">{{ i18n('hintArgsFormat') }}</div>
      </div>
      <div class="form-group">
        <label>{{ i18n('labelDescription') }}</label>
        <textarea v-model="server.props.description" :placeholder="i18n('hintDescription')" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>{{ i18n('labelTags') }}</label>
        <input type="text" v-model="server.custom.tags" :placeholder="i18n('hintTags')" />
      </div>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" v-model="server.config.enabled" />
          {{ i18n('labelEnabled') }}
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" v-model="server.config.shouldUpdate" />
          {{ i18n('labelAllowUpdate') }}
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { i18n, sendCmdDirectly } from '@/common';
import Icon from '@/common/ui/icon';
import { showMessage } from '@/common/ui';

const props = defineProps({
  serverId: {
    type: [String, Number],
    default: '_new',
  },
});

const isNew = computed(() => props.serverId === '_new');

const server = ref({
  props: {
    name: '',
    description: '',
  },
  command: '',
  args: [],
  config: {
    enabled: true,
    shouldUpdate: true,
  },
  custom: {
    tags: '',
  },
});

const argsText = computed({
  get: () => server.value.args.join('\n'),
  set: (val) => {
    server.value.args = val.split('\n').map(arg => arg.trim()).filter(Boolean);
  },
});

async function loadServer() {
  if (!isNew.value) {
    try {
      const data = await sendCmdDirectly('GetServer', { id: props.serverId });
      if (data) {
        server.value = {
          ...data,
          command: data.command || '',
          args: data.args || [],
        };
      }
    } catch (err) {
      showMessage({ text: err.message || err });
    }
  }
}

async function handleSave() {
  try {
    const data = {
      ...server.value,
      props: {
        ...server.value.props,
        id: isNew.value ? undefined : props.serverId,
      },
    };
    await sendCmdDirectly(isNew.value ? 'NewServer' : 'UpdateServer', data);
    emit('close');
  } catch (err) {
    showMessage({ text: err.message || err });
  }
}

function handleCancel() {
  emit('close');
}

const emit = defineEmits(['close']);

loadServer();
</script>

<style lang="css">
.edit-server {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

header {
  margin-bottom: 1rem;
  h2 {
    font-size: 1.5rem;
    font-weight: bold;
  }
}

.form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 1rem;
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    &.checkbox {
      font-weight: normal;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  }
  input[type="text"],
  textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--fill-5);
    border-radius: 4px;
    background: transparent;
    color: var(--fill-9);
    &:focus {
      outline: none;
      border-color: var(--fill-6);
    }
  }
  .hint {
    margin-top: 0.25rem;
    font-size: 0.9em;
    color: var(--fill-6);
  }
}

.btn-group {
  display: flex;
  gap: 0.5rem;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
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
</style> 