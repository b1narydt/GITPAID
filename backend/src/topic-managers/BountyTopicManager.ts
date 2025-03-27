import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, ProtoWallet, Utils } from '@bsv/sdk'
import docs from './BountyTopicDocs.md.js'
import bountyContractJson from '../../artifacts/Bounty.json' with { type: 'json' }
import { BountyContract } from '../contracts/BountyContract.js'
BountyContract.loadArtifact(bountyContractJson)

// Create a wallet for verification purposes
const anyoneWallet = new ProtoWallet('anyone')

/**
 * Topic Manager for Bounty contracts
 */
export default class BountyTopicManager implements TopicManager {
  /**
   * Identify if the outputs are admissible depending on the particular protocol requirements
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    try {
      const parsedTransaction = Transaction.fromBEEF(beef)

      // Try to decode and validate transaction outputs
      for (const [i, output] of parsedTransaction.outputs.entries()) {
        try {
          // Parse sCrypt locking script
          const script = output.lockingScript.toHex()
          
          // Ensure BountyContract can be constructed from script
          const bounty = BountyContract.fromLockingScript(script) as BountyContract
          
          // Verify creator signature came from creator identity key
          const verifyResult = await anyoneWallet.verifySignature({
            protocolID: [0, 'bounty'],
            keyID: '1',
            counterparty: bounty.creatorIdentityKey,
            data: [1],
            signature: Utils.toArray(bounty.creatorSignature, 'hex')
          })
          
          if (verifyResult.valid !== true) {
            console.warn('Signature validation failed for output', i)
            continue
          }
          
          // Additional validation could be added here:
          // - Verify issueId format (valid GitHub issue format)
          // - Validate deadline is reasonable
          // - Check minimum bounty amount threshold
          
          // Add the validated bounty output to admitted list
          outputsToAdmit.push(i)
          console.log(`Admitted bounty output at index ${i}`)
        } catch (error) {
          // This output is not a valid bounty contract, skip it
          console.debug(`Output ${i} is not a bounty contract: ${error.message}`)
          continue
        }
      }
      
      if (outputsToAdmit.length === 0) {
        console.warn('No bounty outputs admitted in transaction')
      }
    } catch (error) {
      const beefStr = JSON.stringify(beef.slice(0, 100), null, 2) + '...' // Trim for logging
      throw new Error(
        `BountyTopicManager: Error identifying admissible outputs: ${error.message} beef: ${beefStr}`
      )
    }

    return {
      outputsToAdmit,
      coinsToRetain: previousCoins
    }
  }

  /**
   * Get the documentation associated with this topic manager
   * @returns A promise that resolves to a string containing the documentation
   */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /**
   * Get metadata about the topic manager
   * @returns A promise that resolves to an object containing metadata
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'Bounty Topic Manager',
      shortDescription: 'Tracks GitHub issue bounties on the BSV blockchain',
      version: '1.0.0',
      informationURL: 'https://github.com/example/bounty-system'
    }
  }
}