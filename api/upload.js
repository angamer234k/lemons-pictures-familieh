import axios from 'axios';

export default async function handler(req, res) {
    // Log the request method for debugging
    console.log(`[upload] Received ${req.method} request`);

    // CORS headers (optional but helpful)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check environment variables first
    const { GH_TOKEN, GH_USERNAME, GH_REPO, GH_BRANCH = 'main' } = process.env;
    if (!GH_TOKEN) {
        console.error('[upload] Missing GH_TOKEN env var');
        return res.status(500).json({ error: 'Server misconfigured: missing GitHub token' });
    }
    if (!GH_USERNAME || !GH_REPO) {
        console.error('[upload] Missing GH_USERNAME or GH_REPO');
        return res.status(500).json({ error: 'Server misconfigured: missing repo info' });
    }

    const { filename, content } = req.body;
    if (!filename || !content) {
        return res.status(400).json({ error: 'Missing filename or content' });
    }

    // Sanitize filename (allow only safe characters)
    const cleanName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    if (!cleanName) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const url = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/images/${cleanName}`;
    console.log(`[upload] Attempting to upload to ${url}`);

    try {
        // Get existing file SHA if any (to overwrite)
        let sha = null;
        try {
            const existing = await axios.get(url, {
                headers: { Authorization: `Bearer ${GH_TOKEN}` }
            });
            sha = existing.data.sha;
            console.log(`[upload] File exists, will overwrite (SHA: ${sha})`);
        } catch (e) {
            console.log(`[upload] File does not exist, will create new`);
        }

        const payload = {
            message: `Upload ${cleanName}`,
            content: content,
            branch: GH_BRANCH
        };
        if (sha) payload.sha = sha;

        const response = await axios.put(url, payload, {
            headers: {
                Authorization: `Bearer ${GH_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        console.log(`[upload] Success: ${cleanName}`);
        res.status(200).json({ filename: cleanName });
    } catch (err) {
        console.error('[upload] GitHub API error:', err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.message;
        res.status(500).json({ error: `GitHub upload failed: ${errorMessage}` });
    }
}