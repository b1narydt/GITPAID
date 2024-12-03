import { Collection, Db } from 'mongodb'
import { MeterRecord, UTXOReference } from 'src/types.js'

// Implements a Lookup StorageEngine for Meter
export class MeterStorage {
  private readonly records: Collection<MeterRecord>

  /**
   * Constructs a new MeterStorageEngine instance
   * @param {Db} db - connected mongo database instance
   */
  constructor(private readonly db: Db) {
    this.records = db.collection<MeterRecord>('MeterRecords')
  }

  /**
   * Stores meter record
   * @param {string} txid transaction id
   * @param {number} outputIndex index of the UTXO
   * @param {string} value - meter value to save
   */
  async storeRecord(txid: string, outputIndex: number, value: number, creatorIdentityKey: string): Promise<void> {
    // Insert new record
    await this.records.insertOne({
      txid,
      outputIndex,
      value,
      creatorIdentityKey,
      createdAt: new Date()
    })
  }

  /**
   * Delete a matching Meter record
   * @param {string} txid transaction id
   * @param {number} outputIndex Output index of the UTXO
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.records.deleteOne({ txid, outputIndex })
  }

  /**
   * Returns all results tracked by the overlay
   * @returns {Promise<UTXOReference[]>} returns matching UTXO references
   */
  async findAll(): Promise<UTXOReference[]> {
    return await this.records.find({})
      .project<UTXOReference>({ txid: 1, outputIndex: 1 })
      .toArray()
      .then(results => results.map(record => ({
        txid: record.txid,
        outputIndex: record.outputIndex
      })))
  }
}
