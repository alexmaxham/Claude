# Bundled libraries

`anthropic-sdk.js` is Anthropic's official TypeScript SDK (`@anthropic-ai/sdk` 1.7.0, Apache-2.0, licence in `anthropic-sdk.LICENSE`), bundled unchanged into one browser file. The page only loads it when someone asks Claude to write alt text.

To rebuild it for a newer version:

```bash
npm install @anthropic-ai/sdk esbuild
echo "import Anthropic from '@anthropic-ai/sdk'; window.AnthropicSDK = Anthropic;" > entry.js
npx esbuild entry.js --bundle --minify --format=iife --platform=browser --target=es2020 --outfile=anthropic-sdk.js
```
