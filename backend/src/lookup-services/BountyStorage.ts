import { Collection, Db } from 'mongodb'
import { UTXOReference } from '../types.js'

/**
 * Represents a bounty record in the database
 */
export interface BountyRecord {
  txid: string
  outputIndex: number
  value: number
  creatorAddr: string
  repoOwnerAddr: string
  contributorAddr: string
  issueId: string
  prId: string
  deadline: number
  creatorIdentityKey: string
  status: 'active' | 'completed' | 'rejected' | 'refunded'
  createdAt: Date
}

/**
 * Implements a storage engine for Bounty contract records
 */
export class BountyStorage {
  private readonly records: Collection<BountyRecord>

  /**
   * Constructs a new BountyStorage instance
   * @param {Db} db - connected mongo database instance
   */
  constructor(private readonly db: Db) {
    this.records = db.collection<BountyRecord>('BountyRecords')
  }

  /**
   * Stores a new bounty record
   * 
   * @param txid Transaction ID containing the bounty
   * @param outputIndex Index of the output in the transaction
   * @param value Value in satoshis of the bounty
   * @param creatorAddr Address of the bounty creator
   * @param repoOwnerAddr Address of the repository owner
   * @param contributorAddr Address of the intended contributor
   * @param issueId GitHub issue ID (repo/owner/issue)
   * @param prId GitHub PR ID (repo/owner/pr)
   * @param deadline Contract deadline timestamp or block height
   * @param creatorIdentityKey Public key of the creator for authentication
   */
  async storeRecord(
    txid: string,
    outputIndex: number,
    value: number,
    creatorAddr: string,
    repoOwnerAddr: string,
    contributorAddr: string,
    issueId: string,
    prId: string,
    deadline: number,
    creatorIdentityKey: string
  ): Promise<void> {
    await this.records.insertOne({
      txid,
      outputIndex,
      value,
      creatorAddr,
      repoOwnerAddr,
      contributorAddr,
      issueId,
      prId,
      deadline,
      creatorIdentityKey,
      status: 'active',
      createdAt: new Date()
    })
  }

  /**
   * Update a bounty's status
   * 
   * @param txid Transaction ID of the bounty
   * @param outputIndex Output index
   * @param status New status value
   */
  async updateStatus(
    txid: string,
    outputIndex: number,
    status: 'active' | 'completed' | 'rejected' | 'refunded'
  ): Promise<void> {
    await this.records.updateOne(
      { txid, outputIndex },
      { $set: { status } }
    )
  }

  /**
   * Delete a matching Bounty record
   * 
   * @param txid Transaction ID
   * @param outputIndex Output index
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.records.deleteOne({ txid, outputIndex })
  }

  /**
   * Find all active bounties
   * 
   * @returns List of active bounty UTXOs
   */
  async findAllActive(): Promise<UTXOReference[]> {
    return await this.records
      .find({ status: 'active' })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }

  /**
   * Find all bounties by status
   * 
   * @param status Status to filter by
   * @returns List of bounty UTXOs matching the status
   */
  async findByStatus(status: 'active' | 'completed' | 'rejected' | 'refunded'): Promise<UTXOReference[]> {
    return await this.records
      .find({ status })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }

  /**
   * Find bounties by GitHub issue ID
   * 
   * @param issueId GitHub issue ID (repo/owner/issue)
   * @returns List of bounty UTXOs for the issue
   */
  async findByIssueId(issueId: string): Promise<UTXOReference[]> {
    return await this.records
      .find({ issueId })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }

  /**
   * Find bounties by GitHub PR ID
   * 
   * @param prId GitHub PR ID (repo/owner/pr)
   * @returns List of bounty UTXOs for the PR
   */
  async findByPrId(prId: string): Promise<UTXOReference[]> {
    return await this.records
      .find({ prId })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }

  /**
   * Find bounties created by a specific identity
   * 
   * @param creatorIdentityKey Public key of the creator
   * @returns List of bounty UTXOs created by this identity
   */
  async findByCreator(creatorIdentityKey: string): Promise<UTXOReference[]> {
    return await this.records
      .find({ creatorIdentityKey })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }

  /**
   * Find bounties assigned to a specific repository owner
   * 
   * @param repoOwnerAddr Address of the repository owner
   * @returns List of bounty UTXOs for this repo owner
   */
  async findByRepoOwner(repoOwnerAddr: string): Promise<UTXOReference[]> {
    return await this.records
      .find({ repoOwnerAddr })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }

  /**
   * Find bounties assigned to a specific contributor
   * 
   * @param contributorAddr Address of the contributor
   * @returns List of bounty UTXOs for this contributor
   */
  async findByContributor(contributorAddr: string): Promise<UTXOReference[]> {
    return await this.records
      .find({ contributorAddr })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }

  /**
   * Get full bounty data for a specific UTXO
   * 
   * @param txid Transaction ID
   * @param outputIndex Output index
   * @returns Full bounty record or null if not found
   */
  async getBountyDetails(txid: string, outputIndex: number): Promise<BountyRecord | null> {
    return await this.records.findOne(
      { txid, outputIndex },
      { projection: { _id: 0 } }
    )
  }

  /**
   * Find bounties with deadlines less than the given timestamp/block height
   * 
   * @param currentValue Current timestamp or block height
   * @returns List of expired bounty UTXOs
   */
  async findExpiredBounties(currentValue: number): Promise<UTXOReference[]> {
    return await this.records
      .find({ 
        deadline: { $lt: currentValue },
        status: 'active'
      })
      .project<UTXOReference>({ txid: 1, outputIndex: 1, _id: 0 })
      .toArray()
  }
}