import { loadConfig } from './config.js';
import { log } from './log.js';
import { startHttpServer } from './server/httpServer.js';
import { createSource } from './feed/source.js';

function main(): void {
  const config = loadConfig();
  const server = startHttpServer(config);
  const source = createSource(config);

  log.info(`source: ${source.describe()}`);

  source.start({
    onTick: (tick) => server.hub.broadcast(tick),
    onEnd: () => log.info('source: stream ended (last tick held for late joiners)'),
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`shutdown (${signal})`);
    source.stop();
    void server.close().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
