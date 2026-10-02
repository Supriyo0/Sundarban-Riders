import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

os.makedirs('public/playstore', exist_ok=True)
os.makedirs('builds/playstore', exist_ok=True)

logo_path = 'public/sundarban-logo.png'
raw_logo = Image.open(logo_path).convert('RGB')

# 1. Create a circular antialiased alpha mask for the logo to remove white corners
w, h = raw_logo.size
# Supersample 4x for silky smooth antialiased circular edge
supersample = 4
mask_hi = Image.new('L', (w * supersample, h * supersample), 0)
mask_draw = ImageDraw.Draw(mask_hi)
# The circular badge is slightly offset or centered; standard ellipse fit
padding = 4 * supersample
mask_draw.ellipse([padding, padding, w * supersample - padding, h * supersample - padding], fill=255)
mask = mask_hi.resize((w, h), Image.Resampling.LANCZOS)

clean_logo = raw_logo.convert('RGBA')
clean_logo.putalpha(mask)

# Save clean circular logo
clean_logo.save('public/playstore/logo-clean-circle.png')

# 2. Generate 512x512 App Icon for Google Play
# Play Store icon specs: 512x512 px, 32-bit PNG, max 1MB
icon_size = (512, 512)
app_icon = Image.new('RGBA', icon_size, (0, 0, 0, 0)) # transparent background

# Size to 490x490 centered
target_icon_size = 490
logo_resized = clean_logo.resize((target_icon_size, target_icon_size), Image.Resampling.LANCZOS)
paste_x = (512 - target_icon_size) // 2
paste_y = (512 - target_icon_size) // 2

app_icon.paste(logo_resized, (paste_x, paste_y), logo_resized)
app_icon.save('public/playstore/app-icon-512.png', 'PNG', optimize=True)
app_icon.save('builds/playstore/app-icon-512.png', 'PNG', optimize=True)
print("Saved 512x512 App Icon: builds/playstore/app-icon-512.png")

# Also generate a solid background variant if preferred by store
app_icon_solid = Image.new('RGB', icon_size, (15, 23, 42)) # Slate 900
app_icon_solid.paste(clean_logo.resize((480, 480), Image.Resampling.LANCZOS), (16, 16), clean_logo.resize((480, 480), Image.Resampling.LANCZOS))
app_icon_solid.save('public/playstore/app-icon-512-solid.png', 'PNG', optimize=True)
app_icon_solid.save('builds/playstore/app-icon-512-solid.png', 'PNG', optimize=True)

# 3. Generate 1024x500 Feature Graphic for Google Play
# Play Store feature graphic specs: 1024x500 px, 24-bit PNG or JPG (no alpha), max 15MB
banner_width = 1024
banner_height = 500
banner = Image.new('RGB', (banner_width, banner_height), (15, 23, 42)) # Deep sleek slate background
draw = ImageDraw.Draw(banner)

# Subtle diagonal gradient / dark luxury atmosphere
for y in range(banner_height):
    ratio = y / banner_height
    r = int(11 + ratio * 8)
    g = int(24 + ratio * 45)
    b = int(43 + ratio * 35)
    draw.line([(0, y), (banner_width, y)], fill=(r, g, b))

# Add a subtle luminous teal glow behind logo
glow = Image.new('RGBA', (500, 500), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
glow_draw.ellipse([50, 50, 450, 450], fill=(20, 184, 166, 80))
glow = glow.filter(ImageFilter.GaussianBlur(60))
banner.paste(glow.convert('RGB'), (20, 0), glow.split()[3])

# Paste seamless circular logo on left side
logo_feature_size = 370
logo_feature = clean_logo.resize((logo_feature_size, logo_feature_size), Image.Resampling.LANCZOS)
banner.paste(logo_feature, (55, (banner_height - logo_feature_size) // 2), logo_feature)

# Draw text on right side
try:
    title_font = ImageFont.truetype("arialbd.ttf", 52)
    subtitle_font = ImageFont.truetype("arial.ttf", 25)
    badge_font = ImageFont.truetype("arialbd.ttf", 19)
    bullet_font = ImageFont.truetype("arial.ttf", 20)
except Exception:
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()
    badge_font = ImageFont.load_default()
    bullet_font = ImageFont.load_default()

text_x = 465
# Badge
badge_box = [text_x, 95, text_x + 225, 130]
draw.rounded_rectangle(badge_box, radius=8, fill=(16, 185, 129)) # Emerald badge
draw.text((text_x + 18, 102), "OFFICIAL APP", font=badge_font, fill=(255, 255, 255))

# Title
draw.text((text_x, 150), "Sundarban Riders", font=title_font, fill=(255, 255, 255))

# Subtitle
draw.text((text_x, 222), "Online Smart Toto & E-Rickshaw Booking", font=subtitle_font, fill=(45, 212, 191)) # Teal
draw.text((text_x, 260), "Fast, Reliable & Transparent Delta Transit", font=subtitle_font, fill=(226, 232, 240)) # Slate 200

# Bullet highlights
highlights = [
    " Verified Local Toto Drivers",
    " Live GPS Tracking & Upfront Fares",
    " Secure OTP Verification & Safe Rides"
]

y_bullet = 315
for h in highlights:
    draw.text((text_x, y_bullet), h, font=bullet_font, fill=(203, 213, 225))
    y_bullet += 32

banner.save('public/playstore/feature-graphic-1024x500.png', 'PNG')
banner.save('builds/playstore/feature-graphic-1024x500.png', 'PNG')
print("Saved 1024x500 Feature Graphic: builds/playstore/feature-graphic-1024x500.png")
