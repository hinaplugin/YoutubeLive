const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { resolveStatePath, loadState, saveState } = require('./store');
const { getChannelName, fetchRssVideoIds, fetchVideoDetails } = require('./youtube');
const { buildEmbed, sendWebhook } = require('./discord');

function toVideoInfo(item) {
  const snippet = item.snippet || {};
  const details = item.liveStreamingDetails || {};

  const url = `https://www.youtube.com/watch?v=${item.id}`;
  const thumbnail = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '';
  const startTime = details.scheduledStartTime || details.actualStartTime || '';

  return {
    id: item.id,
    title: snippet.title || '',
    url,
    thumbnail,
    start_time: startTime
  };
}

function diffFields(prev, next) {
  if (!prev) return true;
  const fields = ['title', 'url', 'thumbnail', 'start_time'];
  return fields.some((f) => prev[f] !== next[f]);
}

function isFutureTime(value, nowMs) {
  if (!value) return false;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return false;
  return ts > nowMs;
}

function deriveStatus(item) {
  const details = item.liveStreamingDetails || {};
  if (details.actualEndTime) return 'completed';
  if (details.actualStartTime) return 'live';
  if (details.scheduledStartTime) return 'upcoming';
  return null;
}

function isQuotaExceededError(err) {
  if (!err || !err.message) return false;
  return err.message.includes('HTTP 403') && err.message.includes('quotaExceeded');
}

async function pollOnce({ config, configDir, logger, state, statePath, isStartup }) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set in .env');
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL is not set in .env');

  const notificationConfig = config.notification || {};
  const maxResults = config.max_results || 10;

  const channelNameCache = new Map();

  const nowMs = isStartup ? Date.now() : null;

  for (const ch of config.channels) {
    const channelId = ch.channel_id;
    let channelName = channelNameCache.get(channelId);
    if (!channelName) {
      try {
        channelName = await getChannelName({ channelId, apiKey });
      } catch (err) {
        logger.warn('Failed to fetch channel name, using channel_id', {
          channelId,
          error: err.message
        });
        channelName = channelId;
      }
      channelNameCache.set(channelId, channelName);
    }

    logger.info('Polling channel', { channelId, channelName });

    let rssIds;
    try {
      rssIds = await fetchRssVideoIds({ channelId, maxResults });
    } catch (err) {
      logger.warn('Failed to fetch RSS feed', { channelId, error: err.message });
      rssIds = [];
    }

    const trackedIds = Object.entries(state.videos)
      .filter(([, info]) => info.channel_id === channelId && (info.status === 'upcoming' || info.status === 'live'))
      .map(([videoId]) => videoId);

    const idsToFetch = Array.from(new Set([...rssIds, ...trackedIds]));
    if (idsToFetch.length === 0) {
      continue;
    }

    let details;
    try {
      details = await fetchVideoDetails({ ids: idsToFetch, apiKey });
    } catch (err) {
      if (isQuotaExceededError(err)) {
        logger.warn('Quota exceeded, skipping channel until next poll', {
          channelId,
          error: err.message
        });
        continue;
      }
      throw err;
    }

    const returnedIds = new Set(details.map((item) => item.id));
    const liveIds = new Set(
      details.filter((item) => deriveStatus(item) === 'live').map((item) => item.id)
    );

    for (const item of details) {
      const info = toVideoInfo(item);
      const prev = state.videos[info.id];

      let type = null;
      const status = deriveStatus(item);
      if (!status) {
        continue;
      }

      if (status === 'upcoming') {
        if (!prev) {
          if (!isStartup || isFutureTime(info.start_time, nowMs)) {
            type = 'scheduled_created';
          }
        } else if (prev.status === 'upcoming' && diffFields(prev, info)) {
          type = 'scheduled_updated';
        } else if (prev.status !== 'upcoming' && diffFields(prev, info)) {
          type = 'scheduled_updated';
        }
      } else if (status === 'live') {
        if (prev?.status !== 'live') {
          type = 'live_started';
        }
      } else if (status === 'completed') {
        if (prev) {
          const suppressEndedNotice = isStartup && prev?.status === 'upcoming';
          if (!suppressEndedNotice && prev?.status !== 'completed') {
            type = 'live_ended';
          }
        }
      }

      state.videos[info.id] = {
        ...info,
        status,
        channel_id: channelId,
        channel_name: channelName
      };

      if (type) {
        try {
          const embed = buildEmbed({
            type,
            video: info,
            notificationConfig,
            channelName
          });
          await sendWebhook({ webhookUrl, embed });
          logger.info('Notification sent', { type, videoId: info.id });
        } catch (err) {
          logger.error('Failed to send notification', { error: err.message, type, videoId: info.id });
        }
      }
    }

    for (const [videoId, prevInfo] of Object.entries(state.videos)) {
      if (prevInfo.channel_id !== channelId) continue;
      if (prevInfo.status !== 'live') continue;
      if (liveIds.has(videoId)) continue;

      prevInfo.status = 'completed';
      state.videos[videoId] = prevInfo;

      if (!isStartup) {
        try {
          const embed = buildEmbed({
            type: 'live_ended',
            video: prevInfo,
            notificationConfig,
            channelName
          });
          await sendWebhook({ webhookUrl, embed });
          logger.info('Notification sent', { type: 'live_ended', videoId });
        } catch (err) {
          logger.error('Failed to send notification', {
            error: err.message,
            type: 'live_ended',
            videoId
          });
        }
      }
    }

    for (const [videoId, prevInfo] of Object.entries(state.videos)) {
      if (prevInfo.channel_id !== channelId) continue;
      if (prevInfo.status !== 'live') continue;
      if (returnedIds.has(videoId)) continue;

      prevInfo.status = 'completed';
      state.videos[videoId] = prevInfo;

      if (!isStartup) {
        try {
          const embed = buildEmbed({
            type: 'live_ended',
            video: prevInfo,
            notificationConfig,
            channelName
          });
          await sendWebhook({ webhookUrl, embed });
          logger.info('Notification sent', { type: 'live_ended', videoId });
        } catch (err) {
          logger.error('Failed to send notification', {
            error: err.message,
            type: 'live_ended',
            videoId
          });
        }
      }
    }
  }

  saveState(statePath, state);
}

async function main() {
  const { config, configDir } = loadConfig();
  const logger = createLogger();
  const statePath = resolveStatePath(configDir, config);
  const state = loadState(statePath);
  const apiKey = process.env.YOUTUBE_API_KEY;

  const pollMinutes = config.poll_interval_minutes;
  const intervalMs = pollMinutes * 60 * 1000;

  logger.info('Bot started', { poll_interval_minutes: pollMinutes, configDir });
  const channelIds = (config.channels || []).map((ch) => ch.channel_id).filter(Boolean);
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set in .env');
  const channelsWithNames = await Promise.all(
    channelIds.map(async (channelId) => {
      try {
        const channelName = await getChannelName({ channelId, apiKey });
        return { channel_id: channelId, channel_name: channelName };
      } catch (err) {
        logger.warn('Failed to fetch channel name, using channel_id', {
          channelId,
          error: err.message
        });
        return { channel_id: channelId, channel_name: channelId };
      }
    })
  );
  logger.info('Target channels', { count: channelsWithNames.length, channels: channelsWithNames });

  await pollOnce({ config, configDir, logger, state, statePath, isStartup: true });
  setInterval(() => {
    pollOnce({ config, configDir, logger, state, statePath, isStartup: false }).catch((err) => {
      logger.error('Poll failed', { error: err.message });
    });
  }, intervalMs);
}

main().catch((err) => {
  const logger = createLogger();
  logger.error('Fatal error', { error: err.message });
  process.exit(1);
});
