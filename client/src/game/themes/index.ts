/**
 * Theme System
 *
 * Ported from HITBOX_HTML sketch.js
 *
 * Themes define the visual appearance of the game while keeping
 * the core gameplay logic identical.
 */

import p5 from 'p5'
import { drawStarField, drawPerspectiveGrid, drawScanLines } from './helpers'

export interface Theme {
    name: string
    colors: {
        deepPurple: number[]
        purple: number[]
        cyan: number[]
        pink: number[]
        [key: string]: number[]
    }
    setup?: (p: p5) => void
    drawBackground: (p: p5, viewPixels: number, frameCount: number) => void
    drawTile: (
        p: p5,
        type: string,
        x: number,
        y: number,
        wx: number,
        wy: number,
        tileSize: number,
        explosionTimer?: number
    ) => void
    drawPlayer: (p: p5, x: number, y: number, tileSize: number, hurt: boolean) => void
    drawHoverHighlight: (p: p5, tx: number, ty: number, tileSize: number) => void
    drawHUD: (
        p: p5,
        score: number,
        lives: number,
        tileInfo: { type: string; x: number; y: number } | null,
        viewPixels: number
    ) => void
}

/**
 * Default/Vaporwave Theme
 * Neon aesthetic with animated perspective grid
 */
export const VAPORWAVE_THEME: Theme = {
    name: 'Vaporwave',
    colors: {
        deepPurple: [25, 25, 46],
        purple: [138, 43, 226],
        cyan: [0, 255, 255],
        pink: [255, 20, 147],
    },
    setup: (p) => {
        p.smooth()
    },
    drawBackground: (p, viewPixels, frameCount) => {
        const bgGradientOffset = frameCount * 0.003

        const topR = 25
        const topG = 25 + p.sin(bgGradientOffset) * 20
        const topB = 46 + p.cos(bgGradientOffset) * 30
        const topColor = p.color(topR, topG, topB)

        const bottomR = 75 + p.sin(bgGradientOffset + p.PI) * 30
        const bottomG = 0
        const bottomB = 130
        const bottomColor = p.color(bottomR, bottomG, bottomB)

        for (let y = 0; y < viewPixels; y++) {
            const inter = p.map(y, 0, viewPixels, 0, 1)
            const c = p.lerpColor(topColor, bottomColor, inter)
            p.stroke(c)
            p.line(0, y, viewPixels, y)
        }

        drawStarField(p, viewPixels, viewPixels, frameCount, 80, 42)

        drawPerspectiveGrid(p, viewPixels, viewPixels, frameCount, [255, 71, 184], 100)

        drawScanLines(p, viewPixels, viewPixels, 4, 30)
    },
    drawTile: (p, type, x, y, wx, wy, tileSize, explosionTimer) => {
        const cx = x + tileSize / 2
        const cy = y + tileSize / 2
        const base = tileSize * 0.6

        p.push()
        p.noStroke()

        switch (type) {
            case 'floor':
                p.fill(0, 255, 255, 30)
                p.ellipse(cx, cy, base * 1.1)
                p.fill(0, 255, 255, 150)
                p.ellipse(cx, cy, base * 0.6)
                break
            case 'grass':
                p.fill(0, 255, 150, 40)
                p.ellipse(cx, cy, base * 1.2)
                p.fill(0, 255, 150)
                p.ellipse(cx, cy, base * 0.7)
                break
            case 'lava':
                const glow = 100 + p.sin(p.frameCount * 0.2 + wx) * 100
                p.fill(255, 20, 147, 80)
                p.ellipse(cx, cy, base * 1.4)
                p.fill(255, 20, glow)
                p.ellipse(cx, cy, base * 0.8)
                break
            case 'coin':
                const pulse = p.sin(p.frameCount * 0.1 + wx) * 0.2 + 0.8
                p.fill(255, 215, 0, 80)
                p.ellipse(cx, cy, base * 1.1 * pulse)
                p.fill(255, 223, 0)
                p.ellipse(cx, cy, base * 0.6)
                break
            case 'wall':
                p.fill(138, 43, 226, 200)
                p.ellipse(cx, cy, base)
                p.fill(138, 43, 226, 100)
                p.ellipse(cx, cy, base * 0.5)
                break
            case 'shrine':
                const rotation = p.frameCount * 0.05
                const shrineGlow = p.sin(p.frameCount * 0.1) * 0.5 + 0.5
                p.fill(255, 255, 255, 100 * shrineGlow)
                p.ellipse(cx, cy, base * 1.5)
                p.push()
                p.translate(cx, cy)
                p.rotate(rotation)
                p.fill(0, 255, 255, 200)
                p.noStroke()
                p.quad(-base * 0.4, 0, 0, -base * 0.4, base * 0.4, 0, 0, base * 0.4)
                p.pop()
                p.fill(255, 255, 255)
                p.ellipse(cx, cy, base * 0.2)
                break
            case 'explosion':
                if (explosionTimer !== undefined) {
                    const timer = explosionTimer
                    const danger = timer < 30 ? p.map(timer, 0, 30, 255, 0) : 0
                    const warning = timer > 30 ? p.sin(timer * 0.3) * 128 + 128 : 255

                    if (timer <= 10) {
                        p.fill(255, 100, 0, 200)
                        p.ellipse(cx, cy, base * 1.8)
                        p.fill(255, 200, 0)
                        p.ellipse(cx, cy, base * 1.2)
                    } else if (timer < 30) {
                        p.fill(255, danger, 0, 150)
                        p.ellipse(cx, cy, base * 1.3)
                        p.fill(255, 150, 0)
                        p.ellipse(cx, cy, base * 0.8)
                    } else {
                        p.fill(255, 200, 0, warning * 0.5)
                        p.ellipse(cx, cy, base * 1.1)
                        p.fill(255, 200, 0, warning)
                        p.ellipse(cx, cy, base * 0.6)
                    }
                }
                break
            case 'moving_hazard':
                const movePulse = p.sin(p.frameCount * 0.2) * 0.3 + 0.7
                const moveGlow = p.sin(p.frameCount * 0.15) * 100 + 155
                p.fill(255, 50, 0, 100 * movePulse)
                p.ellipse(cx, cy, base * 1.6)
                p.fill(255, moveGlow, 0)
                p.ellipse(cx, cy, base * 1.0 * movePulse)
                p.fill(255, 255, 100)
                p.ellipse(cx, cy, base * 0.4)
                break
            default:
                console.warn(`Unknown tile type: ${type} at (${wx}, ${wy})`)
                p.fill(0, 0, 0)
                p.stroke(255, 0, 0)
                p.strokeWeight(2)
                p.rect(x, y, tileSize, tileSize)
                break
        }

        p.pop()
    },
    drawPlayer: (p, x, y, tileSize, hurt) => {
        p.push()
        if (hurt) {
            p.fill(255, 20, 147, 200)
            p.stroke(255, 20, 147, 100)
        } else {
            p.fill(255, 255, 0, 80)
            p.noStroke()
            p.ellipse(x, y, tileSize * 0.8)
            p.fill(255, 255, 0)
            p.stroke(255, 255, 100, 150)
        }
        p.strokeWeight(3)
        p.ellipse(x, y, tileSize * 0.6)
        p.pop()
    },
    drawHoverHighlight: (p, tx, ty, tileSize) => {
        p.push()
        const pulse = p.sin(p.frameCount * 0.1) * 0.3 + 0.7
        p.fill(255, 71, 184, 40 * pulse)
        p.ellipse(tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2, tileSize * 0.95)
        p.noFill()
        p.stroke(255, 71, 184, 100 * pulse)
        p.strokeWeight(2)
        p.ellipse(tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2, tileSize * 0.9)
        p.pop()
    },
    drawHUD: (p, score, lives, tileInfo, viewPixels) => {
        const tileSize = viewPixels / 32
        const pad = p.max(tileSize * 0.4, 8)
        const fontSize = p.max(tileSize * 0.45, 11)
        const lineHeight = fontSize * 1.4
        const boxPadding = p.max(tileSize * 0.2, 6)
        const h = boxPadding * 2 + lineHeight * 2
        const w = p.max(tileSize * 5, viewPixels * 0.22)

        // Left box (score/lives)
        p.push()
        p.fill(25, 25, 46, 220)
        p.noStroke()
        p.rect(pad, pad, w, h, 6)
        p.noFill()
        p.stroke(255, 20, 147)
        p.strokeWeight(2)
        p.rect(pad, pad, w, h, 6)
        p.pop()

        p.push()
        p.fill(0, 255, 255)
        p.noStroke()
        p.textAlign(p.LEFT, p.TOP)
        p.textSize(fontSize)
        p.text(`Score: ${score}`, pad + boxPadding, pad + boxPadding)
        p.text(`Lives: ${lives}`, pad + boxPadding, pad + boxPadding + lineHeight)
        p.pop()

        // Right box (tile info)
        if (tileInfo) {
            const ix = viewPixels - w - pad
            p.push()
            p.fill(25, 25, 46, 220)
            p.noStroke()
            p.rect(ix, pad, w, h, 6)
            p.noFill()
            p.stroke(255, 20, 147)
            p.strokeWeight(2)
            p.rect(ix, pad, w, h, 6)
            p.pop()

            p.push()
            p.fill(0, 255, 255)
            p.noStroke()
            p.textSize(fontSize * 0.9)
            p.textAlign(p.LEFT, p.TOP)
            p.text(`${tileInfo.type}`, ix + boxPadding, pad + boxPadding)
            p.text(`[${tileInfo.x},${tileInfo.y}]`, ix + boxPadding, pad + boxPadding + lineHeight)
            p.pop()
        }
    },
}

/**
 * Pixel Art Retro Theme
 * 8-bit NES-style with blocky pixels
 */
export const PIXEL_ART_THEME: Theme = {
    name: 'Pixel Art Retro',
    colors: {
        deepPurple: [0, 0, 0],
        purple: [128, 0, 128],
        cyan: [0, 255, 255],
        pink: [255, 192, 203],
    },
    setup: (p) => {
        p.noSmooth()
    },
    drawBackground: (p, viewPixels, frameCount) => {
        p.background(0, 0, 0)
    },
    drawTile: (p, type, x, y, wx, wy, tileSize, explosionTimer) => {
        switch (type) {
            case 'floor':
                p.fill(68, 68, 68)
                p.stroke(85, 85, 85)
                p.rect(x, y, tileSize, tileSize)
                break
            case 'grass':
                p.fill(34, 139, 34)
                p.stroke(0, 100, 0)
                p.rect(x, y, tileSize, tileSize)
                break
            case 'lava':
                p.fill(255, 0, 0)
                p.noStroke()
                p.rect(x, y, tileSize, tileSize)
                break
            case 'wall':
                p.fill(85, 85, 85)
                p.stroke(102, 102, 102)
                p.rect(x, y, tileSize, tileSize)
                break
            case 'coin':
                p.fill(255, 215, 0)
                p.noStroke()
                p.rect(x + tileSize * 0.2, y + tileSize * 0.2, tileSize * 0.6, tileSize * 0.6)
                break
            case 'shrine':
                p.fill(128, 0, 128)
                p.stroke(255, 192, 203)
                p.rect(x + tileSize * 0.1, y + tileSize * 0.1, tileSize * 0.8, tileSize * 0.8)
                break
            case 'explosion':
                if (explosionTimer !== undefined) {
                    if (explosionTimer > 90) {
                        p.fill(255, 255, 0)
                    } else if (explosionTimer > 30) {
                        const alpha = p.sin(p.frameCount * 0.3) * 100 + 155
                        p.fill(255, 0, 0, alpha)
                    } else {
                        p.fill(255, 165, 0)
                    }
                    p.noStroke()
                    p.rect(x, y, tileSize, tileSize)
                }
                break
            case 'moving_hazard':
                // Moving fireball hazard (pixel art style)
                p.fill(255, 0, 0)
                p.noStroke()
                p.rect(x + tileSize * 0.15, y + tileSize * 0.15, tileSize * 0.7, tileSize * 0.7)
                break
            default:
                console.warn(`Unknown tile type: ${type} at (${wx}, ${wy})`)
                p.fill(0, 0, 0)
                p.stroke(255, 0, 0)
                p.strokeWeight(2)
                p.rect(x, y, tileSize, tileSize)
                break
        }
    },
    drawPlayer: (p, x, y, tileSize, hurt) => {
        if (hurt) {
            p.fill(255, 0, 0)
        } else {
            p.fill(0, 255, 0)
        }
        p.stroke(255, 255, 255)
        p.strokeWeight(2)
        p.rect(x + tileSize * 0.1, y + tileSize * 0.1, tileSize * 0.8, tileSize * 0.8)
    },
    drawHoverHighlight: (p, tx, ty, tileSize) => {
        p.fill(255, 255, 255, 50)
        p.noStroke()
        p.rect(tx * tileSize, ty * tileSize, tileSize, tileSize)
    },
    drawHUD: (p, score, lives, tileInfo, viewPixels) => {
        p.fill(255, 255, 255, 200)
        p.noStroke()
        p.textAlign(p.LEFT, p.TOP)
        p.textSize(14)
        p.text(`Score: ${score}`, 10, 10)
        p.text(`Lives: ${lives}`, 10, 30)
        if (tileInfo) {
            p.text(`Tile: ${tileInfo.type} (${tileInfo.x}, ${tileInfo.y})`, 10, 50)
        }
    },
}

export const THEMES: Theme[] = [VAPORWAVE_THEME, PIXEL_ART_THEME]

export function getTheme(name: string): Theme {
    return THEMES.find(t => t.name === name) || VAPORWAVE_THEME
}
