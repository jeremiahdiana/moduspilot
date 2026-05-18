export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get('audio') as File;
  if (!audio) return Response.json({ error: 'No audio' }, { status: 400 });

  const groqForm = new FormData();
  groqForm.append('file', audio, 'audio.webm');
  groqForm.append('model', 'whisper-large-v3');
  groqForm.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!res.ok) return Response.json({ error: 'Transcription failed' }, { status: 500 });
  const data = await res.json() as { text: string };
  return Response.json({ text: data.text });
}
