// Local contract address - update after deployment
export const HITBOX_POT_ADDRESS = '0xFD471836031dc5108809D173A067e8486B9047A3' as const

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
        name: "VoteCast",
        type: "event",
        inputs: [
            { name: "voter", type: "address", indexed: true },
            { name: "tick", type: "uint256", indexed: true },
            { name: "direction", type: "uint8", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
        ],
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
        name: "Claimed",
        type: "event",
        inputs: [
            { name: "winner", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "getTickVotes",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tick", type: "uint256" }],
        outputs: [{ name: "", type: "uint256[4]" }],
    },
    {
        name: "genesisTimestamp",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const
