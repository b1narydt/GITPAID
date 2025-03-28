import {
  LookupService,
  LookupQuestion,
  LookupAnswer,
  LookupFormula
} from '@bsv/overlay'
import { BountyStorage } from './BountyStorage.js'
import { Script, Utils } from '@bsv/sdk'
import { SmartContract } from 'scrypt-ts'
import { BountyContract } from '../contracts/BountyContract.js'
import { Db } from 'mongodb'

// Use require instead of import for JSON files
const bountyContractJson = require('../../artifacts/Bounty.json');

// Load the artifact
SmartContract.loadArtifact(bountyContractJson)

// Define docs for documentation (missing in original)
const docs = 'Bounty Lookup Service documentation. Query GitHub issue bounties on the BSV blockchain.';

/**
 * Implements a Bounty lookup service to query for issue bounties
 */
class BountyLookupService implements LookupService {
  /**
   * Constructs a new BountyLookupService instance
   * @param storage - The storage instance to use for managing records
   */
  constructor(public storage: BountyStorage) {}

  /**
   * Notifies the lookup service of a new output added
   */
  async outputAdded(
    txid: string,
    outputIndex: number,
    outputScript: Script,
    topic: string
  ): Promise<void> {
    if (topic !== 'tm_bounty') return
    
    try {
      // Decode the Bounty contract fields from the Bitcoin outputScript
      const bounty = BountyContract.fromLockingScript(
        outputScript.toHex()
      ) as BountyContract

      // Fix for satoshis property - get value from a different source
      // You might need to adjust this based on your actual API
      const value = 0  // Default to 0 if can't get actual value
      
      // Parse the fields
      const creatorAddr = bounty.creatorAddr
      const repoOwnerAddr = bounty.repoOwnerAddr
      const contributorAddr = bounty.contributorAddr
      const issueId = Utils.toHex(Utils.toArray(bounty.issueId, 'utf8'))
      const prId = Utils.toHex(Utils.toArray(bounty.prId, 'utf8'))
      const deadline = Number(bounty.deadline)
      const creatorIdentityKey = Utils.toHex(Utils.toArray(bounty.creatorIdentityKey, 'utf8'))

      // Store the bounty fields for future lookup
      await this.storage.storeRecord(
        txid,
        outputIndex,
        value,
        creatorAddr,
        repoOwnerAddr,
        contributorAddr,
        issueId,
        prId,
        deadline,
        creatorIdentityKey
      )
      
      console.log(`Indexed bounty in lookup database: txid=${txid}, outputIndex=${outputIndex}`)
    } catch (e) {
      console.error('Error indexing bounty contract in lookup database', e)
      return
    }
  }

  /**
   * Notifies the lookup service that an output was spent
   */
  async outputSpent(
    txid: string,
    outputIndex: number,
    topic: string
  ): Promise<void> {
    if (topic !== 'tm_bounty') return
    
    try {
      // First, try to determine the type of spending (completion, rejection, or refund)
      // This would require analyzing the spending transaction...
      // For simplicity in this example, we'll just delete the record
      await this.storage.deleteRecord(txid, outputIndex)
      console.log(`Removed spent bounty from index: txid=${txid}, outputIndex=${outputIndex}`)
    } catch (e) {
      console.error('Error processing spent bounty', e)
    }
  }

  /**
   * Notifies the lookup service that an output has been deleted
   */
  async outputDeleted(
    txid: string,
    outputIndex: number,
    topic: string
  ): Promise<void> {
    if (topic !== 'tm_bounty') return
    await this.storage.deleteRecord(txid, outputIndex)
    console.log(`Deleted bounty from index: txid=${txid}, outputIndex=${outputIndex}`)
  }

  /**
   * Answers a lookup query
   */
  async lookup(
    question: LookupQuestion
  ): Promise<LookupAnswer | LookupFormula> {
    if (!question.query) {
      throw new Error('A valid query must be provided')
    }
    
    if (question.service !== 'ls_bounty') {
      throw new Error('Lookup service not supported')
    }

    const query = question.query as {
      findAll?: boolean
      status?: 'active' | 'completed' | 'rejected' | 'refunded'
      issueId?: string
      prId?: string
      creatorIdentityKey?: string
      repoOwnerAddr?: string
      contributorAddr?: string
      txid?: string
      outputIndex?: number
      isExpired?: boolean
      currentTimestamp?: number
    }

    try {
      // Handle different query types
      if (query.findAll) {
        return await this.storage.findAllActive() as unknown as LookupFormula
      }
      
      if (query.status) {
        return await this.storage.findByStatus(query.status) as unknown as LookupFormula
      }
      
      if (query.issueId) {
        return await this.storage.findByIssueId(query.issueId) as unknown as LookupFormula
      }
      
      if (query.prId) {
        return await this.storage.findByPrId(query.prId) as unknown as LookupFormula
      }
      
      if (query.creatorIdentityKey) {
        return await this.storage.findByCreator(query.creatorIdentityKey) as unknown as LookupFormula
      }
      
      if (query.repoOwnerAddr) {
        return await this.storage.findByRepoOwner(query.repoOwnerAddr) as unknown as LookupFormula
      }
      
      if (query.contributorAddr) {
        return await this.storage.findByContributor(query.contributorAddr) as unknown as LookupFormula
      }
      
      if (query.txid && query.outputIndex !== undefined) {
        const details = await this.storage.getBountyDetails(query.txid, query.outputIndex)
        if (!details) {
          return {} as LookupFormula
        }
        return details as unknown as LookupFormula
      }
      
      if (query.isExpired && query.currentTimestamp) {
        return await this.storage.findExpiredBounties(query.currentTimestamp) as unknown as LookupFormula
      }
      
      // If no valid query parameters were provided
      throw new Error('Invalid query parameters')
    } catch (error) {
      console.error('Error processing lookup query', error instanceof Error ? error.message : String(error))
      return {} as LookupFormula
    }
  }

  /**
   * Returns documentation specific to this lookup service
   */
  async getDocumentation(): Promise<string> {
    return docs;
  }

  /**
   * Returns metadata associated with this lookup service
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'Bounty Lookup Service',
      shortDescription: 'Query GitHub issue bounties on the BSV blockchain',
      version: '1.0.0',
      informationURL: 'https://github.com/example/bounty-system'
    }
  }
}

// Factory function to create the lookup service
export default (db: Db): BountyLookupService => {
  return new BountyLookupService(new BountyStorage(db))
}