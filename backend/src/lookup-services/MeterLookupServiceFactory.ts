import { LookupService, LookupQuestion, LookupAnswer, LookupFormula } from '@bsv/overlay'
import { MeterStorage } from './MeterStorage.js'
import { Script, Utils } from '@bsv/sdk'
import { getDocumentation } from '../utils/getDocumentation.js'

import meterContractJson from '../../artifacts/Meter.json'
import { MeterContract } from 'src/contracts/Meter.js'
MeterContract.loadArtifact(meterContractJson)


/**
 * Implements a Meter lookup service
 *
 * Note: The sCrypt contract is used to decode Meter tokens.
 *
 * @public
 */
class MeterLookupService implements LookupService {
  /**
   * Constructs a new MeterLookupService instance
   * @param storage - The storage instance to use for managing records
   */
  constructor(public storage: MeterStorage) { }

  /**
   * Notifies the lookup service of a new output added.
   *
   * @param {string} txid - The transaction ID containing the output.
   * @param {number} outputIndex - The index of the output in the transaction.
   * @param {Script} outputScript - The script of the output to be processed.
   * @param {string} topic - The topic associated with the output.
   *
   * @returns {Promise<void>} A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with storing the record in the storage engine.
   */
  async outputAdded?(txid: string, outputIndex: number, outputScript: Script, topic: string): Promise<void> {
    if (topic !== 'tm_meter') return
    try {
      // Decode the Meter token fields from the Bitcoin outputScript with the contract class
      const meter = MeterContract.fromLockingScript(outputScript.toHex()) as MeterContract

      // Parse out the message field
      const value = Number(meter.count)
      const creatorIdentityKey = Utils.toHex(Utils.toArray(meter.creatorIdentityKey, 'utf8'))

      // Store the token fields for future lookup
      await this.storage.storeRecord(
        txid,
        outputIndex,
        value,
        creatorIdentityKey
      )
    } catch (e) {
      console.error('Error indexing token in lookup database', e)
      return
    }
  }

  /**
   * Notifies the lookup service that an output was spent
   * @param txid - The transaction ID of the spent output
   * @param outputIndex - The index of the spent output
   * @param topic - The topic associated with the spent output
   */
  async outputSpent?(txid: string, outputIndex: number, topic: string): Promise<void> {
    if (topic !== 'tm_meter') return
    await this.storage.deleteRecord(txid, outputIndex)
  }

  /**
   * Notifies the lookup service that an output has been deleted
   * @param txid - The transaction ID of the deleted output
   * @param outputIndex - The index of the deleted output
   * @param topic - The topic associated with the deleted output
   */
  async outputDeleted?(txid: string, outputIndex: number, topic: string): Promise<void> {
    if (topic !== 'tm_meter') return
    await this.storage.deleteRecord(txid, outputIndex)
  }

  /**
   * Answers a lookup query
   * @param question - The lookup question to be answered
   * @returns A promise that resolves to a lookup answer or formula
   */
  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    if (question.query === undefined || question.query === null) {
      throw new Error('A valid query must be provided!')
    }
    if (question.service !== 'ls_meter') {
      throw new Error('Lookup service not supported!')
    }

    if (question.query === 'findAll') {
      return await this.storage.findAll()
    } else {
      throw new Error('Unknown query type')
    }
  }

  /**
   * Returns documentation specific to this overlay lookup service
   * @returns A promise that resolves to the documentation string
   */
  async getDocumentation(): Promise<string> {
    return await getDocumentation('./docs/HelloWorld/helloworld-lookup-service.md')
  }

  /**
   * Returns metadata associated with this lookup service
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

// Factory function
export default (db: Db): MeterLookupService => {
  return new MeterLookupService(new MeterStorage(db))
}
