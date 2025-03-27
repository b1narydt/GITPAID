/* eslint-disable @typescript-eslint/no-unused-vars */
import { Certificate, CertificateFieldNameUnder50Bytes, CreateActionArgs, createNonce, MasterCertificate, PushDrop, Random, SymmetricKey, Utils, VerifiableCertificate, verifyNonce } from '@bsv/sdk'
import { certificateFields } from '../certificates/githubCert'
import { CertifierRoute } from '../CertifierServer'

/*
 * This route handles signCertificate for the GitHub identity certificate protocol.
 *
 * It validates the certificate signing request (CSR) received from the client,
 * decrypts and validates the field values, ensuring the GitHub username matches
 * what was previously verified through OAuth.
 *
 * The validated and signed certificate is returned to the client where the client saves their copy.
 */
export const signCertificate: CertifierRoute = {
  type: 'post',
  path: '/signCertificate',
  summary: 'Sign a GitHub identity certificate after successful GitHub OAuth verification',
  exampleBody: {
    type: 'AGfk/WrT1eBDXpz3mcw386Zww2HmqcIn3uY6x4Af1eo=',
    clientNonce: 'VhQ3UUGl4L76T9v3M2YLd/Es25CEwAAoGTowblLtM3s=',
    fields: {
      githubUsername: 'encrypted_username_here',
      verified: 'encrypted_value_here',
      issuedAt: 'encrypted_timestamp_here'
    },
    keyring: {
      githubUsername: 'encrypted_symmetric_key_here',
      verified: 'encrypted_symmetric_key_here',
      issuedAt: 'encrypted_symmetric_key_here'
    }
  },
  exampleResponse: {
    certificate: {
      type: 'AGfk/WrT1eBDXpz3mcw386Zww2HmqcIn3uY6x4Af1eo=',
      subject: '02a1c81d78f5c404fd34c418525ba4a3b52be35328c30e67234bfcf30eb8a064d8',
      serialNumber: 'C9JwOFjAqOVgLi+lK7HpHlxHyYtNNN/Fgp9SJmfikh0=',
      fields: {
        githubUsername: 'example-user',
        verified: 'true',
        issuedAt: '2025-03-27T12:34:56Z'
      },
      revocationOutpoint: '000000000000000000000000000000000000000000000000000000000000000000000000',
      certifier: '025384871bedffb233fdb0b4899285d73d0f0a2b9ad18062a062c01c8bdb2f720a',
      signature: '3045022100a613d9a094fac52779b29c40ba6c82e8deb047e45bda90f9b15e976286d2e3a7022017f4dead5f9241f31f47e7c4bfac6f052067a98021281394a5bc859c5fb251cc'
    },
    serverNonce: 'UFX3UUGl4L76T9v3M2YLd/Es25CEwAAoGTowblLtM3s='
  },
  func: async (req, res, server) => {
    try {
      const { clientNonce, type, fields, masterKeyring } = req.body
      
      // Validate params
      try {
        server.certifierSignCheckArgs(req.body)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid parameters'
        return res.status(400).json({
          status: 'error',
          description: message
        })
      }

      // Verify the client actually created the provided nonce
      await verifyNonce(clientNonce, server.wallet, (req as any).auth.identityKey)

      // Server creates a random nonce that the client can verify
      const serverNonce = await createNonce(server.wallet, (req as any).auth.identityKey)
      
      // The server computes a serial number from the client and server nonces
      const { hmac } = await server.wallet.createHmac({
        data: Utils.toArray(clientNonce + serverNonce, 'base64'),
        protocolID: [2, 'certificate issuance'],
        keyID: serverNonce + clientNonce,
        counterparty: (req as any).auth.identityKey
      })
      const serialNumber = Utils.toBase64(hmac)

      // Decrypt certificate fields and verify them before signing
      const decryptedFields = await MasterCertificate.decryptFields(
        server.wallet,
        masterKeyring,
        fields,
        (req as any).auth.identityKey
      )

      // Verify that we have a GitHub username in the session
      // and that it matches the one in the certificate request
      if (!req.session.verifiedGithubUsername) {
        return res.status(401).json({
          status: 'error',
          description: 'No verified GitHub username found. Please complete GitHub authentication first.'
        })
      }

      // Ensure the GitHub username in the certificate matches the verified one
      if (decryptedFields.githubUsername !== req.session.verifiedGithubUsername) {
        return res.status(400).json({
          status: 'error',
          description: 'GitHub username in certificate request does not match verified username'
        })
      }

      // Ensure that the verified field is true
      if (!decryptedFields.verified || decryptedFields.verified !== 'true') {
        return res.status(400).json({
          status: 'error',
          description: 'Certificate field "verified" must be set to "true"'
        })
      }

      // Add issuance timestamp if not already present
      if (!decryptedFields.issuedAt) {
        decryptedFields.issuedAt = new Date().toISOString()
      }

      // Create a revocation outpoint
      // In a production system, you would want to implement a proper revocation mechanism
      const revocationTxid = '000000000000000000000000000000000000000000000000000000000000000000000000'

      // Create and sign the certificate
      const signedCertificate = new Certificate(
        type,
        serialNumber,
        (req as any).auth.identityKey,
        ((await server.wallet.getPublicKey({ identityKey: true })).publicKey),
        revocationTxid,
        decryptedFields
      )

      await signedCertificate.sign(server.wallet)

      // Return the signed certificate to the user
      return res.status(200).json({
        certificate: signedCertificate,
        serverNonce
      })
    } catch (e) {
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}