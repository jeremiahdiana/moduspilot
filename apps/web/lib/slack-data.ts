export interface SlackMessage {
  channel: string;
  text: string;
  ts: string;
}

export async function getRecentSlackActivity(accessToken: string, limit = 8): Promise<SlackMessage[]> {
  try {
    const chRes = await fetch(
      'https://slack.com/api/conversations.list?limit=15&types=public_channel,private_channel&exclude_archived=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!chRes.ok) return [];
    const chData = await chRes.json() as { ok: boolean; channels?: { id: string; name: string; is_member: boolean }[] };
    if (!chData.ok) return [];

    const channels = (chData.channels ?? []).filter(c => c.is_member).slice(0, 6);
    const messages: SlackMessage[] = [];

    await Promise.all(channels.map(async channel => {
      try {
        const msgRes = await fetch(
          `https://slack.com/api/conversations.history?channel=${channel.id}&limit=3`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) return;
        const msgData = await msgRes.json() as { ok: boolean; messages?: { type: string; subtype?: string; text?: string; ts?: string }[] };
        if (!msgData.ok) return;
        for (const msg of msgData.messages ?? []) {
          if (msg.type !== 'message' || msg.subtype) continue;
          const text = (msg.text ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 150);
          if (!text) continue;
          const ts = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString().slice(0, 16).replace('T', ' ') : '';
          messages.push({ channel: channel.name, text, ts });
        }
      } catch { /* skip channel */ }
    }));

    return messages.slice(0, limit);
  } catch {
    return [];
  }
}
