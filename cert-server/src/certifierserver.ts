import { WalletInterface } from '@bsv/sdk'
import express, { Express, Request, Response } from 'express'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import * as routes from './routes'
import bodyParser from 'body-parser'

export interface CertifierServerOptions {
  port: number
  wallet: WalletInterface
  app?: Express
  monetize: boolean
  calculateRequestPrice?: (req: Request) => number | Promise<number>
}

export interface CertifierRoute {
  type: 'post' | 'get'
  path: string
  summary: string
  parameters?: object
  exampleBody?: object
  exampleResponse: object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: (req: Request, res: Response, server: CertifierServer) => Promise<any>
}

export class CertifierServer {
  private readonly app: Express
  private readonly port: number
  wallet: WalletInterface
  private readonly monetize: boolean
  private readonly calculateRequestPrice?: (req: Request) => number | Promise<number>

  constructor(storage: any, options: CertifierServerOptions) {
    this.port = options.port
    this.wallet = options.wallet
    this.monetize = options.monetize
    this.calculateRequestPrice = options.calculateRequestPrice
    
    // Use provided Express app or create a new one
    this.app = options.app || express()

    this.setupRoutes()
  }

  private setupRoutes(): void {
    // Parse JSON bodies
    this.app.use(bodyParser.json({ limit: '30mb' }))

    // CORS setup for cross-origin requests
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', '*')
      res.header('Access-Control-Allow-Methods', '*')
      res.header('Access-Control-Expose-Headers', '*')
      res.header('Access-Control-Allow-Private-Network', 'true')
      if (req.method === 'OPTIONS') {
        // Handle CORS preflight requests
        res.sendStatus(200)
      } else {
        next()
      }
    })

    // Set up BSV authentication middleware
    this.app.use(createAuthMiddleware({
      wallet: this.wallet
    }))

    // Set up payment middleware if monetization is enabled
    if (this.monetize) {
      this.app.use(
        createPaymentMiddleware({
          wallet: this.wallet,
          calculateRequestPrice: this.calculateRequestPrice || (() => 0)
        })
      )
    }

    // Set up routes
    const theRoutes: CertifierRoute[] = [
      routes.initiateGithubAuth,   // Start GitHub OAuth flow
      routes.githubCallback,       // Handle GitHub OAuth callback
      routes.signCertificate       // Sign the GitHub identity certificate
    ]

    // Register all routes with the Express app
    for (const route of theRoutes) {
      this.app[route.type](`${route.path}`, async (req: Request, res: Response) => {
        return route.func(req, res, this)
      })
    }

    // Add a simple root route for documentation/health check
    this.app.get('/', (req, res) => {
      res.json({
        name: 'GitHub Certificate Server',
        status: 'running',
        documentation: {
          githubAuth: '/github/auth',
          signCertificate: '/signCertificate'
        }
      })
    })
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`GitHub Certificate Server listening at http://localhost:${this.port}`)
    })
  }

  /**
   * Helper function to validate certificate signing request arguments
   * @param {object} args 
   * @throws {Error} if any required arguments are missing
   */
  certifierSignCheckArgs(args: { clientNonce: string, type: string, fields: Record<string, string>, masterKeyring: Record<string, string> }): void {
    if (!args.clientNonce) {
      throw new Error('Missing client nonce!')
    }
    if (!args.type) {
      throw new Error('Missing certificate type!')
    }
    if (!args.fields) {
      throw new Error('Missing certificate fields to sign!')
    }
    if (!args.masterKeyring) {
      throw new Error('Missing masterKeyring to decrypt fields!')
    }
  }
}