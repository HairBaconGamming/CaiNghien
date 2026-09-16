from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ICO_PATH = ASSETS / "CaiNghienFocusGuard.ico"
PNG_PATH = ASSETS / "CaiNghienFocusGuard-preview.png"
SIZE = 1024


def lerp_color(start: tuple[int, int, int], end: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a + (b - a) * t) for a, b in zip(start, end))


def rounded_gradient_background(size: int) -> Image.Image:
    start = (22, 34, 29)
    end = (196, 108, 47)
    gradient = Image.new("RGBA", (size, size))
    pixels = gradient.load()
    for y in range(size):
        color = lerp_color(start, end, y / (size - 1))
        for x in range(size):
            pixels[x, y] = (*color, 255)

    vignette = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vignette_draw = ImageDraw.Draw(vignette)
    vignette_draw.ellipse((120, -20, size - 120, size - 260), fill=(255, 255, 255, 28))
    vignette_draw.ellipse((180, 260, size + 40, size + 80), fill=(0, 0, 0, 72))
    gradient = Image.alpha_composite(gradient, vignette)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((60, 60, size - 60, size - 60), radius=230, fill=255)
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    base.paste(gradient, (0, 0), mask)
    return base


def add_soft_glows(canvas: Image.Image) -> Image.Image:
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((660, 120, 940, 400), fill=(255, 214, 182, 72))
    draw.ellipse((90, 620, 370, 900), fill=(48, 90, 74, 76))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(28)))


def add_device_shell(canvas: Image.Image) -> Image.Image:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shell_rect = (240, 210, 784, 814)
    shadow_draw.rounded_rectangle(shell_rect, radius=132, fill=(10, 15, 12, 170))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(34)))

    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(shell_rect, radius=132, fill=(255, 247, 238, 255))
    draw.rounded_rectangle((272, 242, 752, 782), radius=104, outline=(225, 212, 194, 255), width=10)
    draw.rounded_rectangle((320, 280, 704, 344), radius=26, fill=(233, 242, 235, 255))
    draw.ellipse((600, 290, 646, 336), fill=(50, 100, 81, 255))
    draw.ellipse((654, 290, 700, 336), fill=(196, 108, 47, 255))
    return Image.alpha_composite(canvas, layer)


def add_lock_mark(canvas: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    draw.rounded_rectangle((428, 356, 596, 540), radius=84, outline=(30, 52, 45, 255), width=34)
    draw.rounded_rectangle((370, 472, 654, 708), radius=70, fill=(196, 108, 47, 255))
    draw.ellipse((488, 548, 536, 596), fill=(255, 247, 238, 255))
    draw.rounded_rectangle((505, 586, 519, 654), radius=7, fill=(255, 247, 238, 255))

    draw.line((338, 742, 688, 742), fill=(34, 60, 52, 255), width=20)
    draw.line((338, 742, 420, 742), fill=(90, 124, 110, 255), width=20)

    return Image.alpha_composite(canvas, layer)


def build_icon() -> Image.Image:
    canvas = rounded_gradient_background(SIZE)
    canvas = add_soft_glows(canvas)
    canvas = add_device_shell(canvas)
    canvas = add_lock_mark(canvas)
    return canvas


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    image = build_icon()
    image.save(PNG_PATH)
    image.save(ICO_PATH, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print(f"Created {ICO_PATH}")
    print(f"Created {PNG_PATH}")


if __name__ == "__main__":
    main()

