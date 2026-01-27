const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { getStatePath, loadState, saveState } = require('./store');
const { getChannelVideos } = require('./youtube');
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

async function pollOnce({ config, configDir, logger, state, statePath }) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set in .env');
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL is not set in .env');

  const notificationConfig = config.notification || {};
  const maxResults = config.max_results || 10;

  for (const ch of config.channels) {
    const channelId = ch.channel_id;
    const channelName = ch.name || channelId;

    logger.info('Polling channel', { channelId, channelName });

    const result = await getChannelVideos({ channelId, apiKey, maxResults });
    const { upcomingIds, liveIds, completedIds, details } = result;

    for (const item of details) {
      const info = toVideoInfo(item);
      const prev = state.videos[info.id];

      let type = null;
      let status = prev?.status || null;

      if (upcomingIds.has(info.id)) {
        if (!prev) {
          type = 'scheduled_created';
        } else if (prev.status === 'upcoming' && diffFields(prev, info)) {
          type = 'scheduled_updated';
        } else if (prev.status !== 'upcoming' && diffFields(prev, info)) {
          type = 'scheduled_updated';
        }
        status = 'upcoming';
      } else if (liveIds.has(info.id)) {
        if (prev?.status !== 'live') {
          type = 'live_started';
        }
        status = 'live';
      } else if (completedIds.has(info.id)) {
        if (prev?.status !== 'completed') {
          type = 'live_ended';
        }
        status = 'completed';
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
  }

  saveState(statePath, state);
}

async function main() {
  const { config, configDir } = loadConfig();
  const logger = createLogger();
  const statePath = getStatePath(configDir);
  const state = loadState(statePath);

  const pollMinutes = config.poll_interval_minutes;
  const intervalMs = pollMinutes * 60 * 1000;

  logger.info('Bot started', { poll_interval_minutes: pollMinutes, configDir });

  await pollOnce({ config, configDir, logger, state, statePath });
  setInterval(() => {
    pollOnce({ config, configDir, logger, state, statePath }).catch((err) => {
      logger.error('Poll failed', { error: err.message });
    });
  }, intervalMs);
}

main().catch((err) => {
  const logger = createLogger();
  logger.error('Fatal error', { error: err.message });
  process.exit(1);
});
