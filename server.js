const express = require('express');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Exa.ai API key (hard-coded for dev; move to .env for production)
const EXA_API_KEY = "921da8ea-1c29-4732-a820-13281fce2b85";
const EXA_API_URL = "https://api.exa.ai/search";

// Summarizer service endpoint (Summy AI)
const SUMMARIZER_URL = "http://localhost:4000/summarize";

// Simple in-memory cache for summaries
const summaries = {}; // { query: { summy: "...", sourceTitle: "..." } }

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔎 Search route
app.post('/search', async (req, res) => {
    const query = req.body.query;
    if (!query) return res.status(400).json({ error: 'No query provided' });

    try {
        // 1. Call Exa.ai for results
        const exaResponse = await axios.post(EXA_API_URL, { query }, {
            headers: { Authorization: `Bearer ${EXA_API_KEY}` }
        });
        const results = exaResponse.data.results || exaResponse.data.documents || [];

        // 2. Return results immediately (no waiting for summary)
        res.json({ results });

        // 3. Trigger Summy AI in background
        axios.post(SUMMARIZER_URL, { query })
            .then(sumResponse => {
                summaries[query] = {
                    summy: sumResponse.data.summary,
                    sourceTitle: sumResponse.data.sourceTitle
                };
                console.log("Summy AI finished:", sumResponse.data.summary);
            })
            .catch(err => {
                console.error("Summy AI error:", err.message);
                summaries[query] = { summy: "Summy AI could not generate a digest.", sourceTitle: null };
            });

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
});

// 🧠 Endpoint to fetch Summy AI’s digest
app.get('/summary', (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'No query provided' });

    if (summaries[query]) {
        res.json(summaries[query]);
    } else {
        res.json({ summy: null, sourceTitle: null });
    }
});

app.listen(PORT, () => {
    console.log(`EAELL server running on http://localhost:${PORT}`);
});
