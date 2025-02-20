import { addOwnCommands } from './init';
import { getServer, getServers, getRemovedServers, parseServer } from './server';
import storage, { S_SERVER, S_SERVER_CONFIG } from './storage';

addOwnCommands({
  GetServerData: async ({ id, sizes }) => {
    const servers = id ? [getServer({ id })] : getServers();
    const removedServers = getRemovedServers();
    return {
      servers,
      removedServers,
      ...(sizes && { sizes: await storage[S_SERVER].getSizes(servers.map(server => server.props.id)) }),
    };
  },

  /** @return {Promise<MCPServer>} */
  GetServer: getServer,

  /** @return {Promise<{ isNew?, update, where }>} */
  async NewServer(data) {
    return parseServer({
      props: {
        name: 'New Server',
        url: '',
        version: '',
        description: '',
      },
      config: {},
      custom: {},
      ...data,
    });
  },

  /** @return {Promise<{ isNew?, update, where }>} */
  async UpdateServer(data) {
    return parseServer(data);
  },

  /** @return {Promise<void>} */
  async ConnectToServer({ url }) {
    // TODO: Implement WebSocket connection logic
    return parseServer({
      props: {
        name: url,
        url,
        version: '',
        description: '',
      },
      config: {
        enabled: true,
        connected: false,
      },
      custom: {},
    });
  },

  /** @return {Promise<void>} */
  async CheckServerUpdate(ids) {
    const servers = ids
      ? ids.map(id => getServer({ id })).filter(Boolean)
      : getServers().filter(server => server.config.shouldUpdate);
    
    // TODO: Implement server update checking logic
    for (const server of servers) {
      try {
        // Placeholder for update check logic
        server.props.lastUpdated = Date.now();
        await storage[S_SERVER].set({ [server.props.id]: server });
      } catch (err) {
        console.error(`Failed to check updates for server ${server.props.name}:`, err);
      }
    }
  },

  /** @return {Promise<void>} */
  async MarkServerRemoved({ id, removed }) {
    const server = getServer({ id });
    if (server) {
      server.config.removed = removed;
      await storage[S_SERVER].set({ [id]: server });
    }
  },

  /** @return {Promise<void>} */
  async RemoveServer(id) {
    await storage.base.remove([
      storage[S_SERVER].toKey(id),
      storage[S_SERVER_CONFIG].toKey(id),
    ]);
  },
}); 