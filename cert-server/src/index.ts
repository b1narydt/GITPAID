/* eslint-disable @typescript-eslint/no-unused-vars */
import * as dotenv from 'dotenv'
import { CertifierServer, CertifierServerOptions } from './CertifierServer'
import { Setup } from '@bsv/wallet-toolbox'
import { Chain } from '@bsv/wallet-toolbox/out/src/sdk'
import express from 'express'
import session from 'express-session'

dotenv.config()

// Load environment variables
const {
  NODE_ENV = 'development',
  BSV_NETWORK = 'main',
  HTTP_PORT = 8080,
  SERVER_PRIVATE_KEY,
  WALLET_STORAGE_URL,
  SESSION_SECRET = 'github-cert-secret',
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET
} = process.env

// Validate required environment variables
if (!SERVER_PRIVATE_KEY) {
  throw new Error('SERVER_PRIVATE_KEY must be set')
}

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('Warning: GITHUB_CLIENT_ID and/or GITHUB_CLIENT_SECRET not set. GitHub OAuth will not work correctly.')
}

async function setupCertifierServer(): Promise<{
  server: CertifierServer
}> {
  try {
    // Initialize the wallet with the server's private key
    const wallet = await Setup.createWalletClientNoEnv({
      chain: BSV_NETWORK as Chain,
      rootKeyHex: SERVER_PRIVATE_KEY,
      storageUrl: WALLET_STORAGE_URL
    })

    // Create Express server with session support
    const app = express()
    
    // Set up session middleware for tracking GitHub authentication state
    app.use(session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: NODE_ENV === 'production', // Only use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }))

    // Set up server options
    const serverOptions: CertifierServerOptions = {
      port: Number(HTTP_PORT),
      wallet,
      app, // Pass the Express app to the server
      monetize: false,
      calculateRequestPrice: async () => {
        return 0 // Price is in satoshis - set to 0 for free certificates
      }
    }
    
    // Create and initialize the certificate server
    const server = new CertifierServer({}, serverOptions)

    return {
      server
    }
  } catch (error) {
    console.error('Error setting up GitHub certificate server:', error)
    throw error
  }
}

// Main function to start the server
(async () => {
  try {
    console.log(`Starting GitHub certificate server in ${NODE_ENV} mode...`)
    const context = await setupCertifierServer()
    context.server.start()
    console.log(`Server running on port ${HTTP_PORT}`)
  } catch (error) {
    console.error('Error starting server:', error)
    process.exit(1)
  }
})().catch(e => {
  console.error('Unhandled exception:', e)
  process.exit(1)
})