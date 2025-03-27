import { Request, Response } from 'express'
import { CertifierRoute, CertifierServer } from '../CertifierServer'
import axios from 'axios'

// These should be environment variables in production
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'your_github_client_id'
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'your_github_client_secret'
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:8080/githubCallback'

/**
 * Initiates GitHub OAuth flow by redirecting to GitHub's authorization page
 */
export const initiateGithubAuth: CertifierRoute = {
  type: 'get',
  path: '/github/auth',
  summary: 'Initiates GitHub OAuth flow',
  exampleResponse: {
    status: 'Redirecting to GitHub...'
  },
  func: async (req: Request, res: Response) => {
    try {
      // Generate random state parameter to prevent CSRF attacks
      const state = Math.random().toString(36).substring(2, 15)
      
      // Store state in session (you might want to use a proper session store)
      req.session.oauthState = state
      
      // Redirect to GitHub OAuth authorization endpoint
      const githubAuthUrl = 'https://github.com/login/oauth/authorize'
      const url = `${githubAuthUrl}?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}&scope=read:user`
      
      return res.redirect(url)
    } catch (error) {
      console.error('Error initiating GitHub auth:', error)
      return res.status(500).json({
        status: 'error',
        description: 'Failed to initiate GitHub authentication'
      })
    }
  }
}

/**
 * Handles the OAuth callback from GitHub, exchanges code for access token
 * and fetches user data to verify GitHub identity
 */
export const githubCallback: CertifierRoute = {
  type: 'get',
  path: '/githubCallback',
  summary: 'Processes GitHub OAuth callback and issues certificate',
  exampleResponse: {
    status: 'success',
    message: 'GitHub verification complete',
    username: 'example-user',
    certificateRequest: {
      url: '/signCertificate'
    }
  },
  func: async (req: Request, res: Response, server: CertifierServer) => {
    try {
      const { code, state } = req.query
      
      // Verify state parameter to prevent CSRF attacks
      if (state !== req.session.oauthState) {
        return res.status(403).json({
          status: 'error',
          description: 'State validation failed'
        })
      }
      
      // Clean up session state
      delete req.session.oauthState
      
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI
        },
        {
          headers: {
            Accept: 'application/json'
          }
        }
      )
      
      const { access_token } = tokenResponse.data
      
      if (!access_token) {
        return res.status(400).json({
          status: 'error',
          description: 'Failed to obtain access token'
        })
      }
      
      // Use access token to fetch user information
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${access_token}`
        }
      })
      
      const githubUsername = userResponse.data.login
      
      if (!githubUsername) {
        return res.status(400).json({
          status: 'error',
          description: 'Failed to retrieve GitHub username'
        })
      }
      
      // Store the verified GitHub username in the user's session
      req.session.verifiedGithubUsername = githubUsername
      
      // If there's a front-end, redirect to it with the username as a query parameter
      // Otherwise, return the username and next steps
      return res.status(200).json({
        status: 'success',
        message: 'GitHub verification complete',
        username: githubUsername,
        // Provide information on how to request the certificate
        certificateRequest: {
          url: '/signCertificate',
          method: 'POST',
          description: 'Use this endpoint with your wallet to complete the certificate issuance process'
        }
      })
    } catch (error) {
      console.error('Error in GitHub callback:', error)
      return res.status(500).json({
        status: 'error',
        description: 'Failed to process GitHub authentication'
      })
    }
  }
}