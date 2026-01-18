import { http, createConfig } from 'wagmi'
import { baseSepolia, foundry } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

const anvil = {
    ...foundry,
    contracts: {
        ...foundry.contracts,
        multicall3: undefined,
    },
}

export const config = createConfig({
    chains: [baseSepolia, anvil],
    connectors: [injected()],
    transports: {
        [baseSepolia.id]: http(),
        [foundry.id]: http('http://127.0.0.1:8545'),
    },
})
