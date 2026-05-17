import axios from 'axios';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { GH_TOKEN, GH_USERNAME, GH_REPO, GH_BRANCH = 'main' } = process.env;
    const FOLDER = 'images';

    // Check env vars
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) {
        console.error('[image] Missing environment variables');
        return res.status(500).send('Server configuration error');
    }

    const { id } = req.query;

    // Serve single image
    if (id) {
        const rawUrl = `https://raw.githubusercontent.com/${GH_USERNAME}/${GH_REPO}/${GH_BRANCH}/${FOLDER}/${id}`;
        try {
            const response = await axios.get(rawUrl, {
                headers: { Authorization: `Bearer ${GH_TOKEN}` },
                responseType: 'stream'
            });
            res.setHeader('Content-Type', response.headers['content-type']);
            response.data.pipe(res);
        } catch (err) {
            console.error(`[image] Failed to fetch ${id}:`, err.response?.status);
            res.status(404).send('Image not found');
        }
        return;
    }

    // Gallery view: list all images
    try {
        const listUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${FOLDER}?ref=${GH_BRANCH}`;
        const listRes = await axios.get(listUrl, {
            headers: { Authorization: `Bearer ${GH_TOKEN}` }
        });

        const files = listRes.data.filter(f => f.type === 'file').map(f => f.name);

        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Image Gallery</title><style>
                body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:1rem}
                img{max-width:100%;height:auto;border-radius:8px}
                .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
                .card{border:1px solid #ddd;border-radius:8px;padding:0.5rem;text-align:center}
                .error{color:red}
            </style></head>
            <body>
                <h1>📸 Image Gallery</h1>
                ${files.length === 0 ? '<p class="error">No images found. Create an "images" folder in your repo and upload some images.</p>' : `
                <div class="gallery">
                    ${files.map(name => `
                        <div class="card">
                            <img src="/api/image?id=${encodeURIComponent(name)}" alt="${name}">
                            <p>${name}</p>
                        </div>
                    `).join('')}
                </div>
                `}
                <p><a href="/">← Upload more</a></p>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('[image] Gallery error:', err.response?.data || err.message);
        res.status(500).send(`Error loading gallery: ${err.message}`);
    }
}