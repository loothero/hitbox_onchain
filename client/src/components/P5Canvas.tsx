/**
 * P5Canvas Component
 * 
 * Visual layer for Hitbox Onchain game using p5.js
 * 
 * Features:
 * - Deterministic world generation from onchain seed
 * - Grid-based world exploration
 * - Fog-of-war system
 * - Cursor position tracking
 * - Game elements (coins, obstacles, hazards)
 * - Theme support for different art styles
 */

import { useEffect, useRef, useMemo } from 'react'
import p5 from 'p5'
import { generateWorld, getWorldSeed, type World } from '../game/worldGenerator'
import { getTheme, type Theme } from '../game/themes'
import { HITBOX_POT_ADDRESS } from '../onchain/contracts'

export interface P5CanvasProps {
    cursorX: number
    cursorY: number
    exploredTiles?: Set<string>
    currentTick?: number
    pot?: bigint
    genesisTimestamp?: number
    theme?: string // 'Vaporwave' | 'Pixel Art Retro'
    width?: number
    height?: number
}

const TILE_SIZE = 32
const VIEWPORT_TILES = 32 // 32x32 tiles visible
const FOG_RADIUS = 1 // Tiles visible around cursor

/**
 * P5Canvas Component
 * 
 * Wraps p5.js sketch in a React component
 * Receives cursor position and game state from parent
 */
export function P5Canvas({
    cursorX,
    cursorY,
    exploredTiles = new Set(),
    currentTick = 0,
    pot = 0n,
    genesisTimestamp,
    theme = 'Vaporwave',
    width = 1024,
    height = 1024,
}: P5CanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const p5InstanceRef = useRef<p5 | null>(null)
    const worldRef = useRef<World | null>(null)
    const themeRef = useRef<Theme | null>(null)
    
    // Game state ref for p5 sketch access
    const gameStateRef = useRef({
        cursorX: 0,
        cursorY: 0,
        exploredTiles: new Set<string>(),
        currentTick: 0,
        pot: 0n,
    })

    // Generate world once - use a stable seed that doesn't change
    // We'll use contract address + a fixed value if timestamp isn't available yet
    const stableSeed = useMemo(() => {
        // Use timestamp if available, otherwise use 0 as fallback (stable)
        return getWorldSeed(HITBOX_POT_ADDRESS, genesisTimestamp ?? 0)
    }, [genesisTimestamp]) // Only regenerate when timestamp changes
    
    const world = useMemo(() => {
        console.log('🌍 Generating infinite world with seed:', stableSeed, 'genesisTimestamp:', genesisTimestamp)
        const generated = generateWorld(stableSeed)
        console.log('✅ Infinite world generated with', generated.movingHazards.length, 'initial hazards')
        return generated
    }, [stableSeed]) // Only regenerate if seed actually changes

    // Get theme
    const currentTheme = useMemo(() => {
        return getTheme(theme)
    }, [theme])

    // Update game state when props change
    useEffect(() => {
        gameStateRef.current.cursorX = cursorX
        gameStateRef.current.cursorY = cursorY
        gameStateRef.current.exploredTiles = exploredTiles
        gameStateRef.current.currentTick = currentTick
        gameStateRef.current.pot = pot
    }, [cursorX, cursorY, exploredTiles, currentTick, pot])

    // Store world and theme in refs (update when they change)
    useEffect(() => {
        worldRef.current = world
    }, [world])

    useEffect(() => {
        themeRef.current = currentTheme
    }, [currentTheme])

    useEffect(() => {
        if (!containerRef.current) return
        if (!world || !currentTheme) {
            console.warn('⏳ Waiting for world and theme to load...')
            return
        }

        console.log('🎨 Initializing P5 canvas...')

        // Create p5 sketch
        const sketch = (p: p5) => {
            let movingHazards: Array<{
                x: number
                y: number
                direction: 'horizontal' | 'vertical'
                pathStart: number
                pathEnd: number
                position: number
                speed: number
            }> = []

            p.setup = () => {
                p.createCanvas(width, height)
                console.log('🎨 P5 canvas setup complete', {
                    width,
                    height,
                    world: worldRef.current ? 'loaded' : 'missing',
                    theme: themeRef.current ? themeRef.current.name : 'missing',
                })
                
                // Initialize moving hazards from world
                if (worldRef.current) {
                    movingHazards = worldRef.current.movingHazards.map(h => ({
                        ...h,
                        position: h.direction === 'horizontal' ? h.x : h.y,
                    }))
                    console.log('🔥 Initialized', movingHazards.length, 'moving hazards')
                } else {
                    console.warn('⚠️ World not available during setup')
                }

                // Call theme setup
                if (themeRef.current?.setup) {
                    themeRef.current.setup(p)
                }
            }

            p.draw = () => {
                const state = gameStateRef.current
                const world = worldRef.current
                const theme = themeRef.current

                if (!world || !theme) {
                    // Show loading state
                    p.background(20, 20, 30)
                    p.fill(255, 255, 255)
                    p.textAlign(p.CENTER, p.CENTER)
                    p.textSize(16)
                    p.text('Loading world...', width / 2, height / 2)
                    return
                }

                const centerX = state.cursorX
                const centerY = state.cursorY

                // Debug: Log first frame
                if (p.frameCount === 1) {
                    console.log('🎬 First frame drawing:', {
                        centerX,
                        centerY,
                        worldSeed: world.seed,
                        explored: state.exploredTiles.size,
                    })
                }

                // Draw background
                try {
                    theme.drawBackground(p, width, p.frameCount)
                } catch (error) {
                    console.error('Error drawing background:', error)
                    p.background(20, 20, 30)
                }

                // Reset p5 state after background to prevent contamination
                p.resetMatrix()
                p.noStroke()
                p.fill(255)

                // Update moving hazards
                movingHazards.forEach(hazard => {
                    if (hazard.direction === 'horizontal') {
                        hazard.position += hazard.speed
                        if (hazard.position >= hazard.pathEnd || hazard.position <= hazard.pathStart) {
                            hazard.speed = -hazard.speed
                        }
                        hazard.x = Math.max(hazard.pathStart, Math.min(hazard.pathEnd, Math.round(hazard.position)))
                    } else {
                        hazard.position += hazard.speed
                        if (hazard.position >= hazard.pathEnd || hazard.position <= hazard.pathStart) {
                            hazard.speed = -hazard.speed
                        }
                        hazard.y = Math.max(hazard.pathStart, Math.min(hazard.pathEnd, Math.round(hazard.position)))
                    }
                })

                // Camera follows cursor (allow negative coordinates for onchain gameplay)
                // Reference clamps to [0, 128-32] but starts at (64,64)
                // Onchain starts at (0,0) and can go negative, so no lower bound
                const camX = centerX - VIEWPORT_TILES / 2
                const camY = centerY - VIEWPORT_TILES / 2

                // Draw tiles (loop through VIEW coordinates, not world coordinates)
                for (let y = 0; y < VIEWPORT_TILES; y++) {
                    for (let x = 0; x < VIEWPORT_TILES; x++) {
                        const wx = Math.floor(camX + x)
                        const wy = Math.floor(camY + y)
                        const screenX = x * TILE_SIZE
                        const screenY = y * TILE_SIZE

                        const tileKey = `${wx},${wy}`
                        const isExplored = state.exploredTiles.has(tileKey)

                        if (isExplored) {
                            // Tile is explored - generate and render it
                            const tile = world.getTileAt(wx, wy)

                            // Debug: Log first few explored tiles
                            if (p.frameCount === 1 && wx >= 0 && wx < 10 && wy >= 0 && wy < 10) {
                                console.log(`Tile at [${wx}, ${wy}]: type=${tile.type}, biome=${tile.biome}`)
                            }

                            try {
                                // Draw tile (type includes coins, shrines, etc)
                                theme.drawTile(
                                    p,
                                    tile.type,
                                    screenX,
                                    screenY,
                                    wx,
                                    wy,
                                    TILE_SIZE,
                                    tile.explosionTimer
                                )

                                // Draw moving hazards if present at this tile
                                const hasHazard = movingHazards.some(h =>
                                    Math.round(h.x) === wx && Math.round(h.y) === wy
                                )
                                if (hasHazard) {
                                    theme.drawTile(p, 'moving_hazard', screenX, screenY, wx, wy, TILE_SIZE)
                                }
                            } catch (error) {
                                console.error(`Error drawing tile at (${wx}, ${wy}):`, error)
                            }
                        } else {
                            // Fog of war: semi-transparent fill + subtle border
                            p.fill(25, 25, 46, 180)
                            p.noStroke()
                            p.rect(screenX, screenY, TILE_SIZE, TILE_SIZE)
                            p.noFill()
                            p.stroke(138, 43, 226, 30)
                            p.strokeWeight(1)
                            p.rect(screenX, screenY, TILE_SIZE, TILE_SIZE)
                        }
                    }
                }

                // Draw player cursor
                const playerScreenX = (centerX - camX) * TILE_SIZE + TILE_SIZE / 2
                const playerScreenY = (centerY - camY) * TILE_SIZE + TILE_SIZE / 2
                try {
                    theme.drawPlayer(p, playerScreenX, playerScreenY, TILE_SIZE, false)
                } catch (error) {
                    console.error('Error drawing player:', error)
                    // Fallback player
                    p.fill(255, 255, 0)
                    p.noStroke()
                    p.ellipse(playerScreenX, playerScreenY, TILE_SIZE * 0.6)
                }

                // Draw HUD
                try {
                    // Count coins in explored tiles
                    let score = 0
                    state.exploredTiles.forEach((tileKey) => {
                        const [x, y] = tileKey.split(',').map(Number)
                        const tile = world.getTileAt(x, y)
                        if (tile.type === 'coin') score++
                    })

                    const cursorTile = world.getTileAt(state.cursorX, state.cursorY)
                    const tileInfo = { type: cursorTile.type, x: state.cursorX, y: state.cursorY }
                    theme.drawHUD(p, score, 3, tileInfo, width)
                } catch (error) {
                    console.error('Error drawing HUD:', error)
                }
            }
        }

        // Initialize p5
        p5InstanceRef.current = new p5(sketch, containerRef.current)
        console.log('✅ P5 instance created')

        // Cleanup
        return () => {
            if (p5InstanceRef.current) {
                console.log('🧹 Cleaning up P5 instance')
                p5InstanceRef.current.remove()
                p5InstanceRef.current = null
            }
        }
    }, [width, height]) // Only recreate on size changes, not world/theme changes

    return (
        <div
            ref={containerRef}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                border: '2px solid #333',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#1a1a2e',
            }}
        />
    )
}
