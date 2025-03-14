declare module 'react-toastify'

export interface Token {
  rawTX: HexString
  txid: TXIDHexString
  outputIndex: PositiveIntegerOrZero
  lockingScript: HexString
  satoshis: SatoshiValue
}

export interface Meter {
  value: number
  token: Token
  creatorIdentityKey: PubKeyHex
}
