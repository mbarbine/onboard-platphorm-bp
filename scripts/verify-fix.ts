import { generateRequestId } from '../lib/logger'

function main() {
  const requestId = generateRequestId()
  console.log(`Generated Request ID: ${requestId}`)

  const isValid = /^req_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId)
  console.log(`Is valid: ${isValid}`)

  if (!isValid) {
    process.exit(1)
  }
}

main()
