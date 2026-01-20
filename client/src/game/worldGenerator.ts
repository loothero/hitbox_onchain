/**
 * World Generator - Infinite Procedural Generation
 *
 * Deterministic world generation based on a seed
 * Supports infinite coordinate space (positive and negative)
 *
 * The world should be the same for all players based on the contract's season seed
 */

export interface Tile {
    type: 'floor' | 'grass' | 'lava' | 'wall' | 'coin' | 'shrine' | 'explosion' | 'moving_hazard'
    biome: 'neon_city' | 'lava_fields' | 'crystal_garden' | 'void' | 'safe_zone'
    explosionTimer?: number // 60-180 for explosion tiles
}

export interface MovingHazard {
    x: number
    y: number
    direction: 'horizontal' | 'vertical'
    pathStart: number
    pathEnd: number
    position: number // Current position in path
    speed: number
}

export interface World {
    seed: number
    getTileAt: (x: number, y: number) => Tile
    movingHazards: MovingHazard[]
}

const REGION_SIZE = 16
const SAFE_ZONE_RADIUS = 8

/**
 * Simple deterministic PRNG based on seed
 */
class SeededRandom {
    private seed: number

    constructor(seed: number) {
        this.seed = seed
    }

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280
        return this.seed / 233280
    }

    random(min: number = 0, max: number = 1): number {
        return min + this.next() * (max - min)
    }

    randomInt(min: number, max: number): number {
        return Math.floor(this.random(min, max + 1))
    }
}

/**
 * Determine biome for a given region
 * Works for any coordinate (positive or negative)
 */
function getBiomeForRegion(rx: number, ry: number, worldSeed: number): Tile['biome'] {
    const regionSeed = worldSeed + rx * 1000 + ry * 10000
    const regionRng = new SeededRandom(regionSeed)

    const biomeRoll = regionRng.next()
    if (biomeRoll < 0.25) return 'neon_city'
    else if (biomeRoll < 0.5) return 'lava_fields'
    else if (biomeRoll < 0.8) return 'crystal_garden'
    else return 'void'
}

/**
 * Check if coordinates are inside a shrine
 * Shrines are deterministically placed based on seed
 */
function isInShrine(x: number, y: number, worldSeed: number): { isShrine: boolean; isCoin: boolean } {
    // Check if this coordinate matches any shrine pattern
    // We generate shrine locations deterministically based on region
    const rx = Math.floor(x / REGION_SIZE)
    const ry = Math.floor(y / REGION_SIZE)

    // One shrine per region (10% chance)
    const shrineRng = new SeededRandom(worldSeed + rx * 7919 + ry * 7907)
    if (shrineRng.next() > 0.1) return { isShrine: false, isCoin: false }

    // Determine shrine center within region
    const shrineX = rx * REGION_SIZE + shrineRng.randomInt(3, REGION_SIZE - 3)
    const shrineY = ry * REGION_SIZE + shrineRng.randomInt(3, REGION_SIZE - 3)

    // Check if current position is shrine center
    if (x === shrineX && y === shrineY) {
        return { isShrine: true, isCoin: false }
    }

    // Check if current position is one of 4 surrounding coins (N, S, E, W)
    const dx = Math.abs(x - shrineX)
    const dy = Math.abs(y - shrineY)
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        return { isShrine: false, isCoin: true }
    }

    return { isShrine: false, isCoin: false }
}

/**
 * Check if coordinates are inside a room
 */
function isInRoom(x: number, y: number, worldSeed: number): { inRoom: boolean; isWall: boolean } {
    const rx = Math.floor(x / REGION_SIZE)
    const ry = Math.floor(y / REGION_SIZE)

    // Generate rooms deterministically per region
    const roomRng = new SeededRandom(worldSeed + rx * 3001 + ry * 3011)

    // 20% chance of room in this region
    if (roomRng.next() > 0.2) return { inRoom: false, isWall: false }

    const roomX = rx * REGION_SIZE + roomRng.randomInt(2, REGION_SIZE - 8)
    const roomY = ry * REGION_SIZE + roomRng.randomInt(2, REGION_SIZE - 8)
    const roomW = roomRng.randomInt(4, 8)
    const roomH = roomRng.randomInt(4, 8)

    // Check if point is in room bounds
    if (x >= roomX && x < roomX + roomW && y >= roomY && y < roomY + roomH) {
        // Check if it's a wall (edge with 80% probability)
        const isEdge = x === roomX || x === roomX + roomW - 1 || y === roomY || y === roomY + roomH - 1
        const wallRng = new SeededRandom(worldSeed + x * 59 + y * 61)
        const isWall = isEdge && wallRng.next() > 0.2
        return { inRoom: true, isWall }
    }

    return { inRoom: false, isWall: false }
}

/**
 * Generate tile at specific coordinates
 * Works for any coordinate (positive or negative)
 */
function generateTileAt(x: number, y: number, worldSeed: number): Tile {
    // Check safe zone around origin
    const distFromOrigin = Math.sqrt(x * x + y * y)
    if (distFromOrigin < SAFE_ZONE_RADIUS) {
        return { type: 'floor', biome: 'safe_zone' }
    }

    // Check if in shrine
    const shrineCheck = isInShrine(x, y, worldSeed)
    if (shrineCheck.isShrine) {
        const rx = Math.floor(x / REGION_SIZE)
        const ry = Math.floor(y / REGION_SIZE)
        const biome = getBiomeForRegion(rx, ry, worldSeed)
        return { type: 'shrine', biome }
    }
    if (shrineCheck.isCoin) {
        const rx = Math.floor(x / REGION_SIZE)
        const ry = Math.floor(y / REGION_SIZE)
        const biome = getBiomeForRegion(rx, ry, worldSeed)
        return { type: 'coin', biome }
    }

    // Check if in room
    const roomCheck = isInRoom(x, y, worldSeed)
    if (roomCheck.inRoom) {
        const rx = Math.floor(x / REGION_SIZE)
        const ry = Math.floor(y / REGION_SIZE)
        const biome = getBiomeForRegion(rx, ry, worldSeed)
        if (roomCheck.isWall) {
            return { type: 'wall', biome }
        } else {
            return { type: 'floor', biome }
        }
    }

    // Determine biome for this coordinate
    const rx = Math.floor(x / REGION_SIZE)
    const ry = Math.floor(y / REGION_SIZE)
    const biome = getBiomeForRegion(rx, ry, worldSeed)

    // Generate tile based on biome
    const tileSeed = worldSeed + x * 100 + y * 10000
    const tileRng = new SeededRandom(tileSeed)

    const tile: Tile = { type: 'floor', biome }

    switch (biome) {
        case 'neon_city':
            if (tileRng.next() < 0.3) {
                tile.type = 'wall'
            } else {
                tile.type = 'floor'
                if (tileRng.next() < 0.15) {
                    tile.type = 'coin'
                }
            }
            break

        case 'lava_fields':
            if (tileRng.next() < 0.1) {
                tile.type = 'lava'
            } else if (tileRng.next() < 0.05) {
                tile.type = 'explosion'
                tile.explosionTimer = tileRng.randomInt(60, 180)
            } else if (tileRng.next() < 0.02) {
                tile.type = 'moving_hazard'
            }
            break

        case 'crystal_garden':
            tile.type = tileRng.next() < 0.7 ? 'grass' : 'floor'
            if (tileRng.next() < 0.1) {
                tile.type = 'coin'
            }
            break

        case 'void':
            tile.type = 'floor'
            if (tileRng.next() < 0.02) {
                tile.type = 'coin'
            }
            break
    }

    return tile
}

/**
 * Generate moving hazards for visible area
 * Called periodically as player explores
 */
function generateMovingHazards(centerX: number, centerY: number, radius: number, worldSeed: number): MovingHazard[] {
    const hazards: MovingHazard[] = []

    // Scan area for hazard tiles
    for (let y = centerY - radius; y <= centerY + radius; y++) {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            const tile = generateTileAt(x, y, worldSeed)
            if (tile.type === 'moving_hazard') {
                const tileSeed = worldSeed + x * 100 + y * 10000
                const tileRng = new SeededRandom(tileSeed)

                // Consume same randoms as tile generation to stay in sync
                tileRng.next() // biome check
                tileRng.next() // lava check
                tileRng.next() // explosion check
                tileRng.next() // hazard check (this triggered it)

                const direction = tileRng.next() < 0.5 ? 'horizontal' : 'vertical'
                const pathLength = tileRng.randomInt(3, 8)

                hazards.push({
                    x,
                    y,
                    direction,
                    pathStart: direction === 'horizontal' ? x : y,
                    pathEnd: direction === 'horizontal' ? x + pathLength : y + pathLength,
                    position: direction === 'horizontal' ? x : y,
                    speed: 0.02,
                })
            }
        }
    }

    return hazards
}

/**
 * Generate infinite procedural world
 *
 * @param seed - World seed (should come from contract's season seed)
 * @returns Generated world with infinite tile access
 */
export function generateWorld(seed: number): World {
    // Tile cache for performance
    const tileCache = new Map<string, Tile>()

    const getTileAt = (x: number, y: number): Tile => {
        const key = `${x},${y}`
        if (tileCache.has(key)) {
            return tileCache.get(key)!
        }

        const tile = generateTileAt(x, y, seed)

        // Debug: Log first few generated tiles
        if (tileCache.size < 20) {
            console.log(`Generated tile at [${x}, ${y}]:`, tile)
        }

        tileCache.set(key, tile)

        // Limit cache size to prevent memory issues
        if (tileCache.size > 10000) {
            const firstKey = tileCache.keys().next().value
            if (firstKey !== undefined) {
                tileCache.delete(firstKey)
            }
        }

        return tile
    }

    // Generate initial moving hazards around origin
    const movingHazards = generateMovingHazards(0, 0, 32, seed)

    return {
        seed,
        getTileAt,
        movingHazards,
    }
}

/**
 * Get world seed from contract
 *
 * Phase 1 (MVP): Derive from contract address + genesis timestamp
 * Phase 2 (Future): Read seasonSeed from contract when available
 *
 * This ensures deterministic world generation that's the same for all clients
 */
export function getWorldSeed(
    contractAddress: string,
    genesisTimestamp?: number,
    seasonSeed?: bigint
): number {
    // Phase 2: If season seed is available from contract, use it
    if (seasonSeed !== undefined) {
        return Number(seasonSeed)
    }

    // Phase 1: Derive deterministic seed from contract address + genesis
    // This ensures the same world for all players without contract changes
    let hash = 0
    for (let i = 0; i < contractAddress.length; i++) {
        hash = ((hash << 5) - hash) + contractAddress.charCodeAt(i)
        hash = hash & hash
    }

    // Add genesis timestamp if available for more uniqueness
    if (genesisTimestamp !== undefined) {
        hash = hash ^ genesisTimestamp
    }

    return Math.abs(hash)
}
