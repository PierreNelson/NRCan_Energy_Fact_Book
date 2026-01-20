# NRCan Energy Factbook

An interactive web application presenting the Natural Resources Canada Energy Factbook 2025-2026 data.

## Project Structure

```
NRCan_Energy_Factbook/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment
├── docs/                       # Documentation files
│   ├── Cahier d'information sur l'énergie 2025-2026.pdf
│   ├── MASTER PAGE BUILDING GUIDE & TEMPLATE.docx
│   └── NRCAN Energy Factbook 2025-2026.pdf
├── public/                     # Static assets served by Vite
│   └── data/                   # Data files for the web app
│       ├── data.csv
│       └── metadata.csv
├── scripts/
│   └── data_retrieval.py       # Fetches data from StatCan API
├── src/                        # React source code
│   ├── assets/                 # App assets (backgrounds)
│   │   ├── page1_bg.jpg
│   │   ├── page23_bg.jpg
│   │   └── page26_bg.png
│   ├── components/             # Reusable React components
│   │   ├── GCFooter.jsx
│   │   ├── GCHeader.jsx
│   │   ├── Layout.jsx
│   │   ├── SectionOne.jsx
│   │   ├── SectionTwo.jsx
│   │   └── Sidebar.jsx
│   ├── pages/                  # Page components
│   │   ├── Page1.jsx
│   │   ├── Page23.jsx
│   │   ├── Page24.jsx
│   │   ├── Page25.jsx
│   │   ├── Page26.jsx
│   │   ├── Page27.jsx
│   │   ├── Page31.jsx
│   │   ├── Page32.jsx
│   │   └── Page37.jsx
│   ├── utils/                  # Utility functions
│   │   ├── dataLoader.js
│   │   └── translations.js
│   ├── App.jsx                 # Main app component
│   ├── index.css               # Global styles
│   └── main.jsx                # App entry point
├── .gitignore
├── eslint.config.js            # ESLint configuration
├── index.html                  # Vite entry HTML
├── package.json                # NPM dependencies
├── package-lock.json
└── vite.config.js              # Vite configuration
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

### Update Data from StatCan

To fetch the latest data from Statistics Canada:

```bash
python scripts/data_retrieval.py
```

This will download fresh data from the StatCan API and save it directly to `public/data/`.

## Accessibility

This application follows WCAG 2.1 AA guidelines and Web Experience Toolkit (WET) standards.

## License

Government of Canada
