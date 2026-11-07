# tinkr

Make thinking and brainstorming fun, with AI.

A writing page with a thinking partner inside it. Write in the Tiptap editor and tinkr reads along, leaving comments in the margin, threaded to the passage they are about. It questions and pushes back, but never writes your prose. The Product lens and the PRD, Decision and Research starters are built for product managers.

- AI: any OpenAI-compatible endpoint, set in `.env.local`
- Pages are saved in the browser (localStorage)

## Run

```bash
npm install
cp .env.example .env.local   # fill in AI_BASE_URL, AI_API_KEY, AI_MODEL
npm run dev
npm test                     # comment anchoring logic
```
