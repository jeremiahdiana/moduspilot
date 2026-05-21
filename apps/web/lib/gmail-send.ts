export async function sendGmailReply(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
): Promise<void> {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

  const payload: Record<string, string> = { raw };
  if (threadId) payload.threadId = threadId;

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }
}
