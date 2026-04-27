const AGENT_ID = 'agent_2401kc7w0sbhfjw9xesyb9xxxm00';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' }); return; }

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${AGENT_ID}`,
    { headers: { 'xi-api-key': apiKey } }
  );

  if (!resp.ok) {
    const text = await resp.text();
    res.status(502).json({ error: `ElevenLabs ${resp.status}: ${text.slice(0, 200)}` });
    return;
  }

  const { signed_url } = await resp.json();
  res.json({ signed_url });
}
