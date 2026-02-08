import AppKit

let size: CGFloat = 1024
let outputPath = CommandLine.arguments.count > 1
  ? CommandLine.arguments[1]
  : "assets/icon/weekly-status-1024.png"

let rect = NSRect(x: 0, y: 0, width: size, height: size)

let image = NSImage(size: rect.size)
image.lockFocus()

guard let ctx = NSGraphicsContext.current?.cgContext else {
  fputs("Failed to acquire graphics context\n", stderr)
  exit(1)
}

ctx.setAllowsAntialiasing(true)
ctx.setShouldAntialias(true)

// Canvas background with subtle glow.
let bgGradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.09, green: 0.15, blue: 0.24, alpha: 1.0),
  NSColor(calibratedRed: 0.04, green: 0.08, blue: 0.14, alpha: 1.0)
])!
bgGradient.draw(in: rect, angle: -90)

ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -22), blur: 44, color: NSColor(calibratedWhite: 0, alpha: 0.45).cgColor)
let outer = NSBezierPath(roundedRect: rect.insetBy(dx: 70, dy: 70), xRadius: 205, yRadius: 205)
NSColor(calibratedWhite: 0.08, alpha: 1.0).setFill()
outer.fill()
ctx.restoreGState()

let cardRect = rect.insetBy(dx: 86, dy: 86)
let cardPath = NSBezierPath(roundedRect: cardRect, xRadius: 190, yRadius: 190)

ctx.saveGState()
cardPath.addClip()

let cardGradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.12, green: 0.20, blue: 0.33, alpha: 1.0),
  NSColor(calibratedRed: 0.08, green: 0.13, blue: 0.24, alpha: 1.0)
])!
cardGradient.draw(in: cardRect, angle: -95)

let topGlow = NSGradient(colors: [
  NSColor(calibratedRed: 0.33, green: 0.70, blue: 0.95, alpha: 0.22),
  NSColor(calibratedRed: 0.33, green: 0.70, blue: 0.95, alpha: 0.0)
])!
let glowRect = NSRect(x: cardRect.minX, y: cardRect.midY + 40, width: cardRect.width, height: cardRect.height / 2)
topGlow.draw(in: glowRect, angle: -90)
ctx.restoreGState()

NSColor(calibratedRed: 0.27, green: 0.38, blue: 0.56, alpha: 0.35).setStroke()
cardPath.lineWidth = 4
cardPath.stroke()

// Header strap for calendar vibe.
let strapRect = NSRect(x: cardRect.minX + 64, y: cardRect.maxY - 226, width: cardRect.width - 128, height: 126)
let strap = NSBezierPath(roundedRect: strapRect, xRadius: 50, yRadius: 50)
let strapGradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.26, green: 0.61, blue: 0.78, alpha: 1.0),
  NSColor(calibratedRed: 0.18, green: 0.45, blue: 0.63, alpha: 1.0)
])!
strapGradient.draw(in: strap, angle: -90)

NSColor(calibratedWhite: 1, alpha: 0.26).setStroke()
strap.lineWidth = 2
strap.stroke()

func ring(centerX: CGFloat) {
  let ringRect = NSRect(x: centerX - 19, y: strapRect.midY + 40, width: 38, height: 68)
  let ringPath = NSBezierPath(roundedRect: ringRect, xRadius: 16, yRadius: 16)
  NSColor(calibratedRed: 0.83, green: 0.93, blue: 1.0, alpha: 0.93).setFill()
  ringPath.fill()
}

ring(centerX: strapRect.minX + 82)
ring(centerX: strapRect.maxX - 82)

// Tile lines inside card.
func tileLine(y: CGFloat, width: CGFloat, alpha: CGFloat) {
  let lineRect = NSRect(x: cardRect.minX + 118, y: y, width: width, height: 32)
  let line = NSBezierPath(roundedRect: lineRect, xRadius: 15, yRadius: 15)
  NSColor(calibratedRed: 0.47, green: 0.62, blue: 0.83, alpha: alpha).setFill()
  line.fill()
}

tileLine(y: cardRect.minY + 410, width: 520, alpha: 0.52)
tileLine(y: cardRect.minY + 330, width: 660, alpha: 0.42)
tileLine(y: cardRect.minY + 250, width: 430, alpha: 0.5)

// Accent check badge.
let badgeRect = NSRect(x: cardRect.maxX - 300, y: cardRect.minY + 150, width: 186, height: 186)
let badge = NSBezierPath(roundedRect: badgeRect, xRadius: 60, yRadius: 60)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -8), blur: 22, color: NSColor(calibratedRed: 0.20, green: 0.84, blue: 0.76, alpha: 0.55).cgColor)
let badgeGradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.26, green: 0.90, blue: 0.80, alpha: 1.0),
  NSColor(calibratedRed: 0.15, green: 0.67, blue: 0.61, alpha: 1.0)
])!
badgeGradient.draw(in: badge, angle: -90)
ctx.restoreGState()

NSColor(calibratedWhite: 1, alpha: 0.22).setStroke()
badge.lineWidth = 2
badge.stroke()

let check = NSBezierPath()
check.move(to: CGPoint(x: badgeRect.minX + 50, y: badgeRect.midY - 5))
check.line(to: CGPoint(x: badgeRect.minX + 84, y: badgeRect.midY - 41))
check.line(to: CGPoint(x: badgeRect.maxX - 50, y: badgeRect.midY + 37))
check.lineCapStyle = .round
check.lineJoinStyle = .round
check.lineWidth = 24
NSColor(calibratedRed: 0.02, green: 0.23, blue: 0.20, alpha: 0.9).setStroke()
check.stroke()

image.unlockFocus()

let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
guard let png = rep.representation(using: .png, properties: [:]) else {
  fputs("Failed to encode PNG\n", stderr)
  exit(1)
}

let outputURL = URL(fileURLWithPath: outputPath)
try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
try png.write(to: outputURL)
print("Wrote icon PNG to \(outputPath)")
