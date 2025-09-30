const express = require('express');
const bodyParser = require('body-parser');
const wiki = require('wikipedia');
const { pipeline } = require('@xenova/transformers');

const app = express();
app.use(bodyParser.json());

let summarizer;

// Load Hugging Face summarizer locally (no token needed)
(async () => {
    summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-12-6');
    console.log("Summarizer ready");
})();

// POST /summarize { query: "..." }
app.post('/summarize', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'No query provided' });

    try {
        // 1. Search Wikipedia
        const search = await wiki.search(query, { limit: 1 });
        if (!search?.results?.length) {
            return res.json({ summary: `No Wikipedia page found for "${query}".` });
        }

        const title = search.results[0].title;
        const page = await wiki.page(title);
        const content = await page.content();

        // 2. Trim text for speed
        const text = content.slice(0, 3000);

        // 3. Summarize
        if (!summarizer) {
            return res.json({ summary: 'Summarizer warming up, please retry.' });
        }

        const result = await summarizer(text, { max_length: 140, min_length: 60 });
        const summary = result[0]?.summary_text || 'No summary generated.';

        res.json({ summary, sourceTitle: title });
    } catch (err) {
        console.error("Summarizer error:", err.message);
        res.status(500).json({ error: 'Summarization failed', details: err.message });
    }
});

const PORT = process.env.SUMMARY_PORT || 4000;
app.listen(PORT, () => console.log(`Summarizer service running on http://localhost:${PORT}`));
