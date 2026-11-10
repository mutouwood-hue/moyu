import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Crop { let name: String; let x: Int; let y: Int; let width: Int; let height: Int }

func split(source: String, destination: String, crops: [Crop]) throws {
    let url = URL(fileURLWithPath: source)
    guard let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        throw NSError(domain: "AssetSplit", code: 1)
    }
    try FileManager.default.createDirectory(atPath: destination, withIntermediateDirectories: true)
    for crop in crops {
        guard let part = image.cropping(to: CGRect(x: crop.x, y: crop.y, width: crop.width, height: crop.height)) else { continue }
        let output = URL(fileURLWithPath: destination).appendingPathComponent(crop.name)
        guard let writer = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { continue }
        CGImageDestinationAddImage(writer, part, nil)
        CGImageDestinationFinalize(writer)
    }
}

try split(source: "assets/v1a/character/capybara-sheet-source.png", destination: "assets/v1a/character", crops: [
    Crop(name: "capybara_master.png", x: 0, y: 0, width: 390, height: 724),
    Crop(name: "capybara_work.png", x: 390, y: 0, width: 410, height: 724),
    Crop(name: "capybara_slack.png", x: 790, y: 0, width: 460, height: 724),
    Crop(name: "capybara_offwork.png", x: 1250, y: 0, width: 430, height: 724),
    Crop(name: "capybara_pajamas.png", x: 1680, y: 0, width: 492, height: 724),
])

let muyuNames = [
    ["muyu_normal_idle.png", "muyu_normal_pressed.png", "muyu_normal_rebound.png", "muyu_hammer_01.png"],
    ["muyu_gold_idle.png", "muyu_gold_pressed.png", "muyu_gold_rebound.png", "muyu_hammer_02.png"],
    ["muyu_boss_idle.png", "muyu_boss_pressed.png", "muyu_boss_rebound.png", "muyu_hammer_03.png"],
    ["muyu_strike_01.png", "muyu_strike_02.png", "muyu_strike_03.png", "muyu_strike_04.png"],
]
var muyuCrops: [Crop] = []
let xs = [0, 271, 542, 814], widths = [271, 271, 272, 272]
for row in 0..<4 { for column in 0..<4 {
    muyuCrops.append(Crop(name: muyuNames[row][column], x: xs[column], y: row * 362, width: widths[column], height: 362))
}}
try split(source: "assets/v1a/muyu/muyu-sheet-source.png", destination: "assets/v1a/muyu", crops: muyuCrops)
try split(source: "assets/v1a/muyu/muyu-sheet-source.png", destination: "assets/v1a/muyu", crops: [
    Crop(name: "muyu_hammer_01.png", x: 850, y: 0, width: 236, height: 362),
    Crop(name: "muyu_hammer_02.png", x: 850, y: 362, width: 236, height: 362),
    Crop(name: "muyu_hammer_03.png", x: 850, y: 724, width: 236, height: 362),
])
let fm = FileManager.default
for target in ["muyu_strike_05.png", "muyu_strike_06.png"] {
    let path = "assets/v1a/muyu/" + target
    try? fm.removeItem(atPath: path)
    try fm.copyItem(atPath: "assets/v1a/muyu/muyu_strike_04.png", toPath: path)
}
try? fm.removeItem(atPath: "assets/v1a/muyu/muyu_reduced_motion.png")
try fm.copyItem(atPath: "assets/v1a/muyu/muyu_normal_idle.png", toPath: "assets/v1a/muyu/muyu_reduced_motion.png")
