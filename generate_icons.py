import os
import sys
import subprocess

# Secure Pillow installation
try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Installing Pillow library to generate gorgeous icons...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw

def create_icon(size):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Coordinates
    center = size / 2
    radius = size * 0.45
    
    # Draw circular gradient background (simulation using concentric circles)
    steps = int(radius)
    for i in range(steps, 0, -1):
        # Interpolate color from violet (#7f00ff) to pink (#ff007f)
        ratio = i / steps
        r = int(127 + (255 - 127) * (1 - ratio))
        g = 0
        b = int(255 * ratio + 127 * (1 - ratio))
        draw.ellipse(
            [center - i, center - i, center + i, center + i],
            fill=(r, g, b, 255)
        )
        
    # Draw a cute glowing white heart in the center
    # Heart coordinates normalized to 0-1 range
    # Heart shape:
    # Top-left lobe, top-right lobe, bottom point
    w = size * 0.45
    h = size * 0.45
    cx = center
    cy = center - (size * 0.05) # offset slightly upwards
    
    # We can draw the heart using polygons or overlapping circles and a polygon
    # For a high-fidelity heart shape, drawing standard polygon path:
    # x(t) = 16 sin^3(t)
    # y(t) = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)
    import math
    points = []
    num_points = 50
    for step in range(num_points):
        t = step * (2 * math.pi) / num_points
        # parametric heart equations
        x = 16 * (math.sin(t) ** 3)
        y = 13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t)
        
        # Scale and translate
        # equations are centered around 0, and y ranges roughly from -17 to 12
        px = cx + (x * (w / 35))
        py = cy - (y * (h / 35)) # subtract because PIL y-axis goes down
        points.append((px, py))
        
    # Draw glowing outline (slightly translucent white)
    draw.polygon(points, fill=(255, 255, 255, 220))
    
    # Save the file
    os.makedirs('icons', exist_ok=True)
    img.save(f'icons/icon{size}.png', 'PNG')
    print(f"Generated icons/icon{size}.png")

if __name__ == '__main__':
    create_icon(16)
    create_icon(48)
    create_icon(128)
    print("All icons successfully generated!")
