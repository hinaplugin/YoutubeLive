const API_BASE = 'https://www.googleapis.com/youtube/v3';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function getChannelName({ channelId, apiKey }) {
  const url = new URL(`${API_BASE}/channels`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', channelId);
  url.searchParams.set('key', apiKey);

  const data = await fetchJson(url.toString());
  const item = (data.items || [])[0];
  return item?.snippet?.title || channelId;
}

async function fetchRssVideoIds({ channelId, maxResults }) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const xml = await fetchText(url);
  const ids = [];
  const regex = /<yt:videoId>([^<]+)<\/yt:videoId>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    ids.push(match[1]);
  }
  const unique = Array.from(new Set(ids));
  if (maxResults && Number.isFinite(maxResults)) {
    return unique.slice(0, maxResults);
  }
  return unique;
}

async function fetchVideoDetails({ ids, apiKey }) {
  if (ids.length === 0) return [];

  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set('part', 'snippet,liveStreamingDetails');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', apiKey);

  const data = await fetchJson(url.toString());
  return data.items || [];
}

module.exports = { getChannelName, fetchRssVideoIds, fetchVideoDetails };
