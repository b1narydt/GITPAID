export interface MeterRecord {
  txid: string
  outputIndex: number
  value: number
  creatorIdentityKey: string
  createdAt: Date
}

export interface UTXOReference {
  txid: string
  outputIndex: number
}