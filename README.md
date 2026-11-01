# SwitchWise

SwitchWise is a site for comparing phone plans from Verizon, AT&T and T-Mobile plus MVNOs and prepaid carriers. Visitors answer four questions, get a ranked list, and compare up to four plans side by side, priced for 1–4 lines.

**Live site:** https://alexmaxham.github.io/Claude/

The site's code and plan data are in [`planfinder/`](planfinder/). See [planfinder/README.md](planfinder/README.md) to run it, edit plans, and add carrier logos, and [planfinder/RESEARCH.md](planfinder/RESEARCH.md) for where each price comes from.

```bash
cd planfinder
npm install
npm run dev     # http://localhost:4321/Claude/
npm test
npm run build
```

Every push to the default branch runs the tests, builds the site and deploys it to GitHub Pages (`.github/workflows/deploy.yml`). Pull requests run the same tests and build without deploying.
