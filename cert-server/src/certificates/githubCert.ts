import { Base64String, CertificateFieldNameUnder50Bytes } from "@bsv/sdk"

// GitHub Certificate Type Definition
//
// This certificate type is designed to attest that the holder is the owner of a specific
// GitHub username. The certificate is issued after verifying the user's identity through
// GitHub's OAuth flow.
//
// The certificate type identifier is a random 32-byte value encoded as a base64 string.
// This identifier should be unique and not reused across different certificate types.

export const certificateType: Base64String = 'AGfk/WrT1eBDXpz3mcw386Zww2HmqcIn3uY6x4Af1eo='

// Define the fields that will be included in the GitHub identity certificate
export const certificateDefinition: Record<CertificateFieldNameUnder50Bytes, string> = {
  githubUsername: '', // Will be filled with the verified GitHub username
  verified: 'true',   // Indicates this username has been verified through GitHub OAuth
  issuedAt: ''        // Will be filled with timestamp at issuance time
}

// List of fields in the certificate for easy access
export const certificateFields: CertificateFieldNameUnder50Bytes[] = Object.keys(certificateDefinition)