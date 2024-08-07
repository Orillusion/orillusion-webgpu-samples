![Cover Art](https://github.com/Orillusion/orillusion-webgpu-samples/blob/main/logo_new.png)

# Orillusion-webgpu-samples

## Install and Run

Type the following in any terminal:

```bash
# Clone the repo
git clone https://github.com/Orillusion/orillusion-webgpu-samples.git

# Go inside the folder
cd orillusion-webgpu-samples

# Start installing dependencies
npm install #or yarn

# Run project at localhost:3000
npm run dev #or yarn run dev
```

## Project Layout

```bash
├─ 📂 node_modules/   # Dependencies
│  ├─ 📁 @webgpu      # WebGPU types for TS
│  └─ 📁 ...          # Other dependencies (TypeScript, Vite, etc.)
├─ 📂 src/            # Source files
│  ├─ 📁 shaders      # Folder for shader files
│  └─ 📄 *.ts         # TS files for each demo
├─ 📂 samples/        # Sample html
│  └─ 📄 *.html       # HTML entry for each demo
├─ 📄 .gitignore      # Ignore certain files in git repo
├─ 📄 index.html      # Entry page
├─ 📄 LICENSE         # MIT
├─ 📄 logo.png        # Orillusion logo image
├─ 📄 package.json    # Node package file
├─ 📄 tsconfig.json   # TS configuration file
├─ 📄 vite.config.js  # vite configuration file
└─ 📄 readme.md       # Read Me!
```

## Platform
**Windows/Mac/Linux:**
- Chrome 113+
- Edge: 113+
- Safari: 17.5+ (with `WebGPU` feature flag)

**Android (Behind the `enable-unsafe-webgpu` flag):** 
- Chrome Canary 113+ 
- Edge Canary 113+

**IOS:**
- Safari: 17.5+ (with `WebGPU` feature flag)
