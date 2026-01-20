/**
 * Theme Helper Utilities
 *
 * Shared animation and rendering utilities for themes
 */

import p5 from 'p5'

/**
 * Draw layered glow effect with multiple concentric circles/ellipses
 */
export function drawLayeredGlow(
    p: p5,
    x: number,
    y: number,
    baseSize: number,
    color: number[],
    layers: number = 3,
    falloff: number = 0.3
): void {
    for (let i = layers; i > 0; i--) {
        const alpha = (255 * falloff * i) / layers
        p.fill(color[0], color[1], color[2], alpha)
        p.noStroke()
        const size = baseSize * (1 + i * 0.3)
        p.ellipse(x, y, size, size)
    }
}

/**
 * Get phase offset for position-based animation variation
 */
export function getPhaseOffset(wx: number, wy: number, seed: number = 0): number {
    return (wx * 7 + wy * 13 + seed) % 100
}

/**
 * Pulse animation value (0.8 to 1.2)
 */
export function pulseValue(frameCount: number, speed: number = 0.1, phase: number = 0): number {
    return Math.sin(frameCount * speed + phase) * 0.2 + 1.0
}

/**
 * Glow intensity animation (varies alpha channel)
 */
export function glowIntensity(frameCount: number, speed: number = 0.1, phase: number = 0, min: number = 50, max: number = 200): number {
    return Math.sin(frameCount * speed + phase) * ((max - min) / 2) + (min + max) / 2
}

/**
 * Rotation angle for animated elements
 */
export function rotationAngle(frameCount: number, speed: number = 0.05): number {
    return frameCount * speed
}

/**
 * Draw star field background
 */
export function drawStarField(
    p: p5,
    width: number,
    height: number,
    frameCount: number,
    starCount: number = 80,
    seed: number = 42
): void {
    p.push()
    p.noStroke()

    for (let i = 0; i < starCount; i++) {
        const starSeed = seed + i * 137
        const x = (starSeed * 73) % width
        const y = (starSeed * 97) % height
        const size = ((starSeed * 53) % 3) + 1
        const twinkle = Math.sin(frameCount * 0.05 + starSeed) * 0.3 + 0.7

        p.fill(255, 255, 255, 255 * twinkle)
        p.ellipse(x, y, size, size)
    }

    p.pop()
}

/**
 * Draw perspective grid background
 */
export function drawPerspectiveGrid(
    p: p5,
    width: number,
    height: number,
    frameCount: number,
    color: number[] = [255, 20, 147],
    alpha: number = 100
): void {
    p.push()
    p.stroke(color[0], color[1], color[2], alpha)
    p.strokeWeight(1)
    p.noFill()

    const vanishY = height * 0.65
    const horizonLines = 15
    const verticalLines = 11
    const scrollSpeed = 2
    const scroll = (frameCount * scrollSpeed) % 100

    for (let i = 0; i < horizonLines; i++) {
        const offset = (i * 100 + scroll) % (height - vanishY)
        const y = vanishY + offset
        const perspective = offset / (height - vanishY)
        const lineWidth = width * (0.2 + perspective * 0.8)
        const x1 = (width - lineWidth) / 2
        const x2 = (width + lineWidth) / 2
        p.line(x1, y, x2, y)
    }

    for (let i = 0; i < verticalLines; i++) {
        const t = i / (verticalLines - 1)
        const x = width * t
        p.line(x, vanishY, width / 2, height)
    }

    p.pop()
}

/**
 * Draw scan line effect (CRT aesthetic)
 */
export function drawScanLines(
    p: p5,
    width: number,
    height: number,
    spacing: number = 4,
    alpha: number = 30
): void {
    p.push()
    p.stroke(0, 0, 0, alpha)
    p.strokeWeight(1)

    for (let y = 0; y < height; y += spacing) {
        p.line(0, y, width, y)
    }

    p.pop()
}
