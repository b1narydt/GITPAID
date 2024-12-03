import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, ProtoWallet, Utils } from '@bsv/sdk'
import docs from './MeterTopicDocs.md.js'
import meterContractJson from '../../artifacts/Meter.json'
import { MeterContract } from 'src/contracts/Meter.js'
MeterContract.loadArtifact(meterContractJson)

const anyoneWallet = new ProtoWallet('anyone')

/**
 *  Note: The PushDrop package is used to decode BRC-48 style Pay-to-Push-Drop tokens.
 */
export default class MeterTopicManager implements TopicManager {
  /**
   * Identify if the outputs are admissible depending on the particular protocol requirements
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    try {
      const parsedTransaction = Transaction.fromBEEF(beef)

      // Try to decode and validate transaction outputs
      for (const [i, output] of parsedTransaction.outputs.entries()) {
        try {
          // Parse sCrypt locking script
          const script = output.lockingScript.toHex()
          // Ensure Meter can be constructed from script
          const meter = MeterContract.fromLockingScript(script) as MeterContract
          console.log(meter)
          // This is where other overlay-level validation rules would be enforced
          // Verify creator signature came from creator public key
          const verifyResult = await anyoneWallet.verifySignature({
            protocolID: [0, 'meter'],
            keyID: '1',
            counterparty: meter.creatorIdentityKey,
            data: [1],
            signature: Utils.toArray(meter.creatorSignature, 'hex')
          })
          console.log(verifyResult)
          if (verifyResult.valid !== true) {
            throw new Error('Signature invalid')
          }

          outputsToAdmit.push(i)
        } catch (error) {
          console.error('Error processing output:', error)
          // Continue processing other outputs
        }
      }
      if (outputsToAdmit.length === 0) {
        console.warn('No outputs admitted!')
        // throw new ERR_BAD_REQUEST('No outputs admitted!')
      }
    } catch (error) {
      console.error('Error identifying admissible outputs:', error)
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
   * @throws An error indicating the method is not implemented
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    throw new Error('Method not implemented.')
  }
}
