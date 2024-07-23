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

## How to enable WebGPU
1. We have embedded a WebGPU Origin-Trail token in `vite.config.js`, you can use WebGPU at `localhost:3000` via Chrome v94-105 
2. For Edge Canary, please open `edge://flags/#enable-unsafe-webgpu`, and enable the flag
3. For FireFox Nightly, please open `about:config`, and change `dom.webgpu.enabled` to `true`
