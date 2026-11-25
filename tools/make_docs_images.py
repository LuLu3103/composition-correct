from PIL import Image
import os
os.makedirs('docs/images', exist_ok=True)
jobs = [
    ('shots/manual/home.png', 'docs/images/home.jpg', 430),
    ('shots/manual/review.png', 'docs/images/review.jpg', 430),
    ('shots/manual/review-expanded.png', 'docs/images/review-expanded.jpg', 430),
    ('shots/manual/review-sentences.png', 'docs/images/review-sentences.jpg', 430),
    ('shots/manual/history.png', 'docs/images/history.jpg', 430),
    ('shots/manual/settings.png', 'docs/images/settings.jpg', 430),
    ('shots/manual/picker.png', 'docs/images/picker.jpg', 430),
    ('shots/manual/desktop.png', 'docs/images/desktop.jpg', 960),
]
for src, dst, width in jobs:
    im = Image.open(src).convert('RGB')
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=82, optimize=True)
    print(dst, im.size, os.path.getsize(dst))
