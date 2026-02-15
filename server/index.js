import { app, start } from './src/app/server.js'

const isDirectExecution = () => {
  if (!process.argv[1]) return false
  return import.meta.url === new URL(process.argv[1], 'file://').href
}

if (isDirectExecution()) {
  start().catch((error) => {
    console.error('Failed to start server', error)
    process.exit(1)
  })
}

export { app, start }
