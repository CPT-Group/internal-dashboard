export async function notifyWebsiteHealthTeams(text: string): Promise<boolean> {
  const url = process.env.WEBSITE_HEALTH_TEAMS_WEBHOOK_URL?.trim();
  if (!url || !url.startsWith('http')) {
    return false;
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
    });
    return true;
  } catch {
    return false;
  }
}

