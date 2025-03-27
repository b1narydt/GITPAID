import {
    assert,
    ByteString,
    Addr,
    FixedArray,
    hash256,
    method,
    prop,
    PubKey,
    Sig,
    SigHash,
    SmartContract,
    Utils,
    pubKey2Addr
} from 'scrypt-ts'

// Constants
const UINT_MAX = 0xffffffffn
const LOCKTIME_BLOCK_HEIGHT_MARKER = 500000000n

export class BountyContract extends SmartContract {
    // Number of required approvers (typically just the repo owner)
    static readonly N_APPROVERS = 1

    // Bounty creator address
    @prop()
    readonly creatorAddr: Addr

    // Repository owner address
    @prop()
    readonly repoOwnerAddr: Addr

    // Contributor address (to be paid)
    @prop()
    readonly contributorAddr: Addr

    // GitHub Issue ID (repository/owner/issue)
    @prop()
    readonly issueId: ByteString

    // PR ID (repository/owner/pr)
    @prop()
    readonly prId: ByteString

    // Repository approvers public keys (typically just the repo owner)
    @prop()
    readonly approvers: FixedArray<PubKey, typeof BountyEscrow.N_APPROVERS>

    // Contract deadline (timestamp or block height)
    @prop()
    readonly deadline: bigint

    constructor(
        creatorAddr: Addr,
        repoOwnerAddr: Addr,
        contributorAddr: Addr,
        issueId: ByteString,
        prId: ByteString,
        approvers: FixedArray<PubKey, typeof BountyEscrow.N_APPROVERS>,
        deadline: bigint
    ) {
        super(...arguments)
        this.creatorAddr = creatorAddr
        this.repoOwnerAddr = repoOwnerAddr
        this.contributorAddr = contributorAddr
        this.issueId = issueId
        this.prId = prId
        this.approvers = approvers
        this.deadline = deadline
    }

    // Repository owner approves the PR and confirms payment
    // This releases the bounty to the contributor
    @method(SigHash.ANYONECANPAY_SINGLE)
    public confirmBountyPayment(
        repoOwnerSig: Sig,
        repoOwnerPubKey: PubKey,
        approverSigs: FixedArray<Sig, typeof BountyEscrow.N_APPROVERS>
    ) {
        // Validate repo owner signature
        assert(
            pubKey2Addr(repoOwnerPubKey) == this.repoOwnerAddr,
            'invalid public key for repo owner'
        )
        assert(
            this.checkSig(repoOwnerSig, repoOwnerPubKey),
            'repo owner signature check failed'
        )
        
        // Validate approver signatures (if more than one is configured)
        assert(
            this.checkMultiSig(approverSigs, this.approvers),
            'approvers checkMultiSig failed'
        )

        // Ensure contributor gets paid the bounty amount
        const amount = this.ctx.utxo.value
        const out = Utils.buildPublicKeyHashOutput(this.contributorAddr, amount)
        assert(hash256(out) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }

    // PR is rejected or doesn't meet requirements
    // Bounty is refunded to the creator
    @method()
    public rejectBounty(
        repoOwnerSig: Sig,
        repoOwnerPubKey: PubKey,
        approverSigs: FixedArray<Sig, typeof BountyEscrow.N_APPROVERS>
    ) {
        // Validate repo owner signature
        assert(
            pubKey2Addr(repoOwnerPubKey) == this.repoOwnerAddr,
            'invalid public key for repo owner'
        )
        assert(
            this.checkSig(repoOwnerSig, repoOwnerPubKey),
            'repo owner signature check failed'
        )
        
        // Validate approver signatures (if more than one is configured)
        assert(
            this.checkMultiSig(approverSigs, this.approvers),
            'approvers checkMultiSig failed'
        )

        // Ensure bounty creator gets refund
        const amount = this.ctx.utxo.value
        const out = Utils.buildPublicKeyHashOutput(this.creatorAddr, amount)
        assert(hash256(out) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }

    // If deadline is reached without resolution, bounty creator can get refund
    @method()
    public refundDeadline(
        creatorSig: Sig, 
        creatorPubKey: PubKey
    ) {
        // Validate creator signature
        assert(
            pubKey2Addr(creatorPubKey) == this.creatorAddr,
            'invalid public key for bounty creator'
        )
        assert(
            this.checkSig(creatorSig, creatorPubKey),
            'creator signature check failed'
        )

        // Require nLocktime enabled
        assert(
            this.ctx.sequence < UINT_MAX,
            'require nLocktime enabled'
        )

        // Check if using block height for deadline
        if (this.deadline < LOCKTIME_BLOCK_HEIGHT_MARKER) {
            // Enforce nLocktime field to also use block height
            assert(
                this.ctx.locktime < LOCKTIME_BLOCK_HEIGHT_MARKER
            )
        }
        
        // Verify deadline has been reached
        assert(
            this.ctx.locktime >= this.deadline,
            'deadline not yet reached'
        )

        // Ensure bounty creator gets refund
        const amount = this.ctx.utxo.value
        const out = Utils.buildPublicKeyHashOutput(this.creatorAddr, amount)
        assert(hash256(out) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }

    // Allow for tiered payments to multiple contributors
    @method()
    public splitBountyPayment(
        repoOwnerSig: Sig,
        repoOwnerPubKey: PubKey,
        approverSigs: FixedArray<Sig, typeof BountyEscrow.N_APPROVERS>,
        // Array of contributor addresses and their percentage
        contributorShares: FixedArray<[Addr, bigint], 5> // Max 5 contributors
    ) {
        // Validate repo owner signature
        assert(
            pubKey2Addr(repoOwnerPubKey) == this.repoOwnerAddr,
            'invalid public key for repo owner'
        )
        assert(
            this.checkSig(repoOwnerSig, repoOwnerPubKey),
            'repo owner signature check failed'
        )
        
        // Validate approver signatures
        assert(
            this.checkMultiSig(approverSigs, this.approvers),
            'approvers checkMultiSig failed'
        )

        // Validate all shares add up to 100%
        let totalShares = 0n
        for (let i = 0; i < contributorShares.length; i++) {
            totalShares += contributorShares[i][1]
        }
        assert(totalShares == 100n, 'shares must add up to 100%')

        // Build outputs for each contributor based on their share
        let outputs: ByteString = Utils.buildPublicKeyHashOutput(
            contributorShares[0][0], 
            (this.ctx.utxo.value * contributorShares[0][1]) / 100n
        )
        
        // Add additional outputs for each contributor
        for (let i = 1; i < contributorShares.length; i++) {
            if (contributorShares[i][1] > 0n) {
                const shareAmount = (this.ctx.utxo.value * contributorShares[i][1]) / 100n
                outputs += Utils.buildPublicKeyHashOutput(
                    contributorShares[i][0],
                    shareAmount
                )
            }
        }

        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }
}