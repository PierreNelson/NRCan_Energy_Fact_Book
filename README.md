# NRCan Energy Factbook

An interactive web application presenting the Natural Resources Canada Energy Factbook 2025-2026 data.

## Project Structure

```
NRCan_Energy_Factbook/
├── docs/                    # Documentation files
│   ├── ACCESSIBILITY_GUIDELINES.md
│   ├── Accessibility statement.txt
│   ├── NRCAN Energy Factbook 2025-2026.pdf
│   ├── Cahier d'information sur l'énergie 2025-2026.pdf
│   ├── WEB ACCESSIBILITY & RESPONSIVE DESIGN GUIDELINES.rtf
│   └── Web Experience Toolkit Guidelines.docx
├── public/                  # Static assets served by Vite
│   ├── assets/              # Images
│   └── statcan_data/        # Data files for the web app
├── scripts/                 # Utility scripts
│   ├── data_retrieval.py    # Fetches data from StatCan API
│   ├── start_dev.bat        # Starts development server
│   └── update_data.bat      # Updates data from StatCan
├── src/                     # React source code
│   ├── assets/              # App assets (backgrounds, etc.)
│   ├── components/          # Reusable React components
│   ├── pages/               # Page components
│   ├── utils/               # Utility functions
│   ├── App.jsx              # Main app component
│   ├── App.css              # App-level styles
│   ├── index.css            # Global styles
│   └── main.jsx             # App entry point
├── statcan_data/            # Raw data from StatCan API
├── index.html               # Vite entry HTML
├── package.json             # NPM dependencies
├── vite.config.js           # Vite configuration
└── eslint.config.js         # ESLint configuration
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Python 3.10+ (for data retrieval)

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Or use the batch script (Windows):
```bash
scripts\start_dev.bat
```

### Update Data from StatCan

To fetch the latest data from Statistics Canada:

```bash
cd scripts
python data_retrieval.py
```

Or use the batch script (Windows):
```bash
scripts\update_data.bat
```

### Build for Production

```bash
npm run build
```

## Accessibility

This application follows WCAG 2.1 AA guidelines and Web Experience Toolkit (WET) standards. See the `docs/` folder for detailed accessibility guidelines.

## License

Government of Canada
