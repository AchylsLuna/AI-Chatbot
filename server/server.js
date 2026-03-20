import 'dotenv/config';
import { startServer, stopInMemoryMongo } from './app.js';

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        void stopInMemoryMongo().finally(() => process.exit(0));
    });
}

void startServer();
