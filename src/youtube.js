const API_BASE = 'https://www.googleapis.com/youtube/v3';

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

async function searchVideosByEventType({ channelId, eventType, apiKey, maxResults }) {
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set('part', 'id');
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('eventType', eventType);
  url.searchParams.set('type', 'video');
  url.searchParams.set('order', 'date');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('key', apiKey);

  const data = await fetchJson(url.toString());
  const ids = (data.items || [])
    .map((item) => item.id && item.id.videoId)
    .filter(Boolean);

  return ids;
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

async function getChannelVideos({ channelId, apiKey, maxResults }) {
  const [upcomingIds, liveIds, completedIds] = await Promise.all([
    searchVideosByEventType({ channelId, eventType: 'upcoming', apiKey, maxResults }),
    searchVideosByEventType({ channelId, eventType: 'live', apiKey, maxResults }),
    searchVideosByEventType({ channelId, eventType: 'completed', apiKey, maxResults })
  ]);

  const allIds = Array.from(new Set([...upcomingIds, ...liveIds, ...completedIds]));
  const details = await fetchVideoDetails({ ids: allIds, apiKey });

  return {
    upcomingIds: new Set(upcomingIds),
    liveIds: new Set(liveIds),
    completedIds: new Set(completedIds),
    details
  };
}

module.exports = { getChannelName, getChannelVideos };
