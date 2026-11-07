# tinkr

Make thinking and brainstorming fun, with AI.

A writing page with a thinking partner inside it. Write in the Tiptap editor and tinkr reads along, leaving comments in the margin, threaded to the passage they are about. It questions and pushes back, but never writes your prose. The Product lens and the PRD, Decision and Research starters are built for product managers.

- Live at https://tinkr.page, deployed by Vercel on every push to `main`
- AI: any OpenAI-compatible endpoint, set in `.env.local`
- Pages are saved in the browser (localStorage)
- The whole app sits behind one shared password (`ACCESS_PASSWORD`)

## Run

```bash
npm install
cp .env.example .env.local   # fill in every value
npm run dev -- -p 3002
npm test                     # comment anchoring logic
```
