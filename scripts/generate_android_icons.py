import os
from PIL import Image, ImageOps, ImageDraw

def make_icon(logo, size, padding_ratio=0.8, is_round=False):
    # Create white canvas
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    
    # Calculate target logo size
    target_dim = int(size * padding_ratio)
    logo_copy = logo.copy().convert("RGBA")
    logo_copy.thumbnail((target_dim, target_dim), Image.Resampling.LANCZOS)
    
    # Center position
    offset_x = (size - logo_copy.width) // 2
    offset_y = (size - logo_copy.height) // 2
    
    canvas.paste(logo_copy, (offset_x, offset_y), logo_copy)
    
    if is_round:
        # Create circular mask
        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size, size), fill=255)
        rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        rounded.paste(canvas, (0, 0), mask)
        return rounded
    
    return canvas

def make_foreground(logo, size):
    # For adaptive icons, canvas is transparent with logo centered inside 66% safe zone
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target_dim = int(size * 0.68)
    logo_copy = logo.copy().convert("RGBA")
    logo_copy.thumbnail((target_dim, target_dim), Image.Resampling.LANCZOS)
    
    offset_x = (size - logo_copy.width) // 2
    offset_y = (size - logo_copy.height) // 2
    
    canvas.paste(logo_copy, (offset_x, offset_y), logo_copy)
    return canvas

def make_splash(logo, width, height):
    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    max_dim = min(width, height) * 0.40
    logo_copy = logo.copy().convert("RGBA")
    logo_copy.thumbnail((int(max_dim), int(max_dim)), Image.Resampling.LANCZOS)
    
    offset_x = (width - logo_copy.width) // 2
    offset_y = (height - logo_copy.height) // 2
    
    canvas.paste(logo_copy, (offset_x, offset_y), logo_copy)
    return canvas

def main():
    logo_path = "public/sundarban-logo.png"
    if not os.path.exists(logo_path):
        logo_path = "public/logo.png"
    
    logo = Image.open(logo_path)
    res_dir = "android/app/src/main/res"
    
    # 1. Mipmap icons mapping (density -> size, foreground_size)
    mipmaps = {
        "mipmap-mdpi": (48, 108),
        "mipmap-hdpi": (72, 162),
        "mipmap-xhdpi": (96, 216),
        "mipmap-xxhdpi": (144, 324),
        "mipmap-xxxhdpi": (192, 432),
    }
    
    for folder, (size, fg_size) in mipmaps.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Standard launcher
        icon = make_icon(logo, size, padding_ratio=0.88, is_round=False)
        icon.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
        
        # Round launcher
        round_icon = make_icon(logo, size, padding_ratio=0.88, is_round=True)
        round_icon.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
        
        # Adaptive foreground
        fg = make_foreground(logo, fg_size)
        fg.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
        print(f"Generated icons for {folder}: {size}x{size}, FG: {fg_size}x{fg_size}")
        
    # 2. Splash screens mapping
    splash_screens = {
        "drawable": (480, 320),
        "drawable-land-hdpi": (800, 480),
        "drawable-land-mdpi": (480, 320),
        "drawable-land-xhdpi": (1280, 720),
        "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
        "drawable-port-hdpi": (480, 800),
        "drawable-port-mdpi": (320, 480),
        "drawable-port-xhdpi": (720, 1280),
        "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
    }
    
    for folder, (w, h) in splash_screens.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        splash = make_splash(logo, w, h)
        splash.save(os.path.join(folder_path, "splash.png"), "PNG")
        print(f"Generated splash for {folder}: {w}x{h}")

    print("\nAll Android app launcher icons and splash screens successfully created with official Sundarban Riders branding!")

if __name__ == "__main__":
    main()
