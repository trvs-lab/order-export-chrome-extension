from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
SIZES = (16, 32, 48, 128)
CANVAS = 512
SCALE = CANVAS / 128


def s(value):
    return round(value * SCALE)


def box(x1, y1, x2, y2):
    return (s(x1), s(y1), s(x2), s(y2))


def draw_icon(size):
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle(box(8, 8, 120, 120), radius=s(26), fill=(255, 85, 64, 255))
    for y in range(s(8), s(120)):
      ratio = (y - s(8)) / max(1, s(112))
      warm = min(1, ratio * 1.55)
      color = (
          int(255 * (1 - warm) + 245 * warm),
          int(53 * (1 - warm) + 158 * warm),
          int(93 * (1 - warm) + 11 * warm),
          255,
      )
      draw.line((s(8), y, s(120), y), fill=color)

    bg_detail = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_detail)
    bg_draw.pieslice(box(64, 66, 144, 146), 180, 360, fill=(185, 28, 28, 44))
    image.alpha_composite(bg_detail)

    card_shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    card_shadow_draw = ImageDraw.Draw(card_shadow)
    card_shadow_draw.rounded_rectangle(box(24, 22, 90, 104), radius=s(16), fill=(124, 29, 18, 90))
    card_shadow = card_shadow.rotate(-6, center=(s(58), s(61)), resample=Image.Resampling.BICUBIC)
    image.alpha_composite(card_shadow.filter(ImageFilter.GaussianBlur(s(5))))

    card = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle(box(24, 22, 90, 104), radius=s(16), fill=(255, 255, 255, 255))
    card_draw.polygon([(s(74), s(22)), (s(90), s(40)), (s(74), s(40))], fill=(232, 241, 255, 255))
    card_draw.rounded_rectangle(box(38, 40, 72, 47), radius=s(3.5), fill=(17, 24, 39, 255))
    card_draw.rounded_rectangle(box(38, 58, 80, 64), radius=s(3), fill=(148, 163, 184, 255))
    card_draw.rounded_rectangle(box(38, 74, 74, 80), radius=s(3), fill=(203, 213, 225, 255))
    card_draw.ellipse(box(26.5, 57.5, 33.5, 64.5), fill=(255, 53, 93, 255))
    card_draw.ellipse(box(26.5, 73.5, 33.5, 80.5), fill=(255, 107, 45, 255))
    card = card.rotate(-6, center=(s(58), s(61)), resample=Image.Resampling.BICUBIC)
    image.alpha_composite(card)

    badge_shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    badge_shadow_draw = ImageDraw.Draw(badge_shadow)
    badge_shadow_draw.ellipse(box(62, 60, 116, 114), fill=(6, 95, 70, 92))
    image.alpha_composite(badge_shadow.filter(ImageFilter.GaussianBlur(s(5))))

    mask = Image.new("L", (CANVAS, CANVAS), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse(box(62, 60, 116, 114), fill=255)
    badge = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    badge_draw = ImageDraw.Draw(badge)
    for y in range(s(60), s(114)):
      ratio = (y - s(60)) / max(1, s(54))
      color = (
          int(34 * (1 - ratio) + 16 * ratio),
          int(211 * (1 - ratio) + 185 * ratio),
          int(238 * (1 - ratio) + 129 * ratio),
          255,
      )
      badge_draw.line((s(62), y, s(116), y), fill=color)
    image.alpha_composite(Image.composite(badge, Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0)), mask))

    draw = ImageDraw.Draw(image)
    line_width = s(9)
    draw.line((s(90), s(69), s(90), s(95)), fill=(255, 255, 255, 255), width=line_width)
    draw.line((s(77), s(84), s(90), s(97), s(103), s(84)), fill=(255, 255, 255, 255), width=line_width, joint="curve")
    draw.line((s(75), s(105), s(105), s(105)), fill=(255, 255, 255, 255), width=s(8))
    draw.line((s(104), s(38), s(114), s(38)), fill=(255, 255, 255, 230), width=s(5))
    draw.line((s(109), s(33), s(109), s(43)), fill=(255, 255, 255, 230), width=s(5))

    if size == CANVAS:
        return image

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    for size in SIZES:
        draw_icon(size).save(OUT / f"icon-{size}.png")


if __name__ == "__main__":
    main()
