// Local contract address - update after deployment
export const HITBOX_POT_ADDRESS = '0x610178da211fef7d417bc0e6fed39f05609ad788' as const

export const HITBOX_POT_ABI = [
    {
        name: "vote",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "direction", type: "uint8" }],
        outputs: [],
    },
    {
        name: "finalizeTick",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "tick", type: "uint256" },
            { name: "winningDirection", type: "uint8" },
        ],
        outputs: [],
    },
    {
        name: "claim",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    {
        name: "getState",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "_currentTick", type: "uint256" },
            { name: "_tickEndTimestamp", type: "uint256" },
            { name: "_timeoutSeconds", type: "uint256" },
            { name: "_lastMoveTimestamp", type: "uint256" },
            { name: "_lastMover", type: "address" },
            { name: "_pot", type: "uint256" },
            { name: "_minFee", type: "uint256" },
            { name: "_tickDurationSeconds", type: "uint256" },
        ],
    },
    {
        name: "isClaimable",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "getTimeoutRemaining",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "TickFinalized",
        type: "event",
        inputs: [
            { name: "tick", type: "uint256", indexed: true },
            { name: "winningDirection", type: "uint8", indexed: false },
            { name: "lastMover", type: "address", indexed: false },
            { name: "pot", type: "uint256", indexed: false },
        ],
    },
    {
        name: "getTickVotes",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tick", type: "uint256" }],
        outputs: [{ name: "", type: "uint256[4]" }],
    },
] as const
