import axios from 'axios';
import Busboy from 'busboy';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const bb = Busboy({ headers: req.headers });
    let fileBuffer, filename;

    bb.on('file', (_, file, info) => {
        filename = info.filename;
        const chunks = [];
        file.on('data', d => chunks.push(d));
        file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on('finish', async () => {
        if (!fileBuffer) return res.status(400).json({ error: 'No file' });

        const cleanName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const base64 = fileBuffer.toString('base64');

        const { GH_TOKEN, GH_USERNAME, GH_REPO, GH_BRANCH = 'main' } = process.env;
        const url = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/images/${cleanName}`;

        try {
            // Check if exists to get SHA (for overwrite)
            let sha = null;
            try {
                const existing = await axios.get(url, { headers: { Authorization: `Bearer ${GH_TOKEN}` } });
                sha = existing.data.sha;
            } catch (e) {}

            const payload = {
                message: `Upload ${cleanName}`,
                content: base64,
                branch: GH_BRANCH
            };
            if (sha) payload.sha = sha;

            await axios.put(url, payload, {
                headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
            });

            res.status(200).json({ filename: cleanName });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'GitHub upload failed' });
        }
    });

    req.pipe(bb);
}

export const config = { api: { bodyParser: false } };