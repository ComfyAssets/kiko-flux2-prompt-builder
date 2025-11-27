# FLUX 2 Prompt Builder

![FLUX 2 Prompt Builder](ss.png)

A visual prompt builder for AI image generation for FLUX2. Designed with a ComfyUI-inspired interface for building structured prompts with precise camera settings, lighting, composition, and color palettes.

## About This Project

This project is being developed as a **ComfyUI custom node** that will provide a visual prompt building interface directly within ComfyUI workflows. However, ComfyUI custom nodes with complex DOM requirements need special handling for custom UI components.

**While we work on the custom node integration**, we're releasing this standalone version so users can start building prompts immediately.

## Usage Options

### Option 1: Single-Page HTML (Portable)

The simplest way to use this tool is with the standalone HTML file:

```bash
# Just open the HTML file in your browser
open flux2-prompt-node-v2.html 
# Or double-click the file in your file manager
```

**Limitations:**
- EyeDropper (screen color picker) will **not** work due to browser security restrictions, if you server it over https you can use it, we have included a standalone canvas picker, just add an image and you can build your pallet visually. 
- All other features work normally

### Option 2: Node.js Application (Recommended)

For the full experience with all features:

```bash
cd app

# Start the server
./start.sh

# The app will be available at http://localhost:3000

# To stop the server
./stop.sh
```

**Requirements:**
- Node.js 14+ installed
- npm (comes with Node.js)

### Color Picker Options

| Method | Works Without SSL? | Browser Support |
|--------|-------------------|-----------------|
| Color Input (native) | Yes | All browsers |
| Image Upload + Canvas | Yes | All browsers |
| EyeDropper (screen) | Requires HTTPS or localhost | Chrome, Edge, Opera only |

**Note:** Firefox and Safari do not support the EyeDropper API at all. Use the image upload feature as an alternative - drop or upload any image and click on it to pick colors directly from the canvas.

## Features

- **20+ Photography Presets**: Intimate portraits, landscapes, street photography, product shots, and more
- **Detailed Camera Settings**: Angle, shot distance, lens focal length, aperture, ISO, focus description
- **Camera/Film Stock Database**: Authentic camera models and film stocks for realistic rendering
- **Professional Lighting Presets**: Natural light, studio setups, dramatic/cinematic options
- **Composition Guidelines**: Rule of thirds, golden ratio, leading lines, and more
- **Color Palette Builder**:
  - Native color picker
  - Image-based color picking (no SSL required)
  - EyeDropper for screen sampling (HTTPS/localhost only)
- **Mood Presets**: Emotional tones and visual aesthetics
- **Real-time JSON Output**: See your prompt structure as you build
- **Style Presets**: Photography, painting, illustration, drawing, 3D rendering

## Project Structure

```
photo-info/
├── README.md                    # This file
├── photo-prompt-generator.html  # Standalone single-file version
└── app/                         # Node.js application
    ├── server.js                # Express server
    ├── package.json             # Dependencies
    ├── start.sh                 # Start script
    ├── stop.sh                  # Stop script
    └── public/                  # Static files
        ├── index.html           # Main HTML
        ├── css/
        │   └── styles.css       # Styling
        ├── js/
        │   └── app.js           # Application logic
        └── data/                # Preset data (JSON)
            ├── presets.json     # Scene presets
            ├── styles.json      # Style options
            ├── cameras.json     # Camera/film stock database
            ├── lighting.json    # Lighting presets
            ├── mood.json        # Mood options
            └── composition.json # Composition techniques
```

## Running with SSL (For EyeDropper Support)

If you want the screen color picker to work and can't use `localhost`, you'll need to serve over HTTPS. Here are some options:

### Using a reverse proxy (nginx example)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### Using mkcert for local development

```bash
# Install mkcert
brew install mkcert  # macOS
# or see https://github.com/FiloSottile/mkcert for other platforms

# Create local CA and certificates
mkcert -install
mkcert localhost

# Then configure your server to use the generated certificates
```

## ComfyUI Custom Node (Coming Soon)

The ComfyUI version will:
- Integrate directly into ComfyUI workflows
- Output structured prompt data for image generation nodes
- Support custom DOM elements for the visual interface
- Maintain all features of the standalone version

Stay tuned for updates on the custom node release!

## Development

### Modifying Presets

All preset data is stored in JSON files under `app/public/data/`. You can easily:
- Add new camera models to `cameras.json`
- Create custom lighting setups in `lighting.json`
- Define new scene presets in `presets.json`

### API Endpoint

The Node.js server provides a single API endpoint:

```
GET /api/data
```

Returns all preset data combined:
```json
{
  "presets": { ... },
  "styles": { ... },
  "cameras": { ... },
  "lighting": { ... },
  "mood": { ... },
  "composition": { ... }
}
```

## License

MIT License - Feel free to use, modify, and distribute.

## Contributing

Contributions welcome! Feel free to:
- Add new presets
- Improve the UI
- Add new features
- Report bugs

---

*Built for the AI art community*
