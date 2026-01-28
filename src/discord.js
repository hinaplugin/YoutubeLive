const COLOR_MAP = {
  yellowgreen: 0x9acd32,
  orange: 0xffa500,
  lightskyblue: 0x87cefa,
  red: 0xff0000
};

const TYPE_LABELS = {
  scheduled_created: '配信予定が登録されました',
  scheduled_updated: '配信予定が更新されました',
  live_started: '配信が開始されました',
  live_ended: '配信が終了しました'
};

function formatJstYmdHm(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return value;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  const jst = new Date(ts + 9 * 60 * 60 * 1000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function resolveColor(colorValue) {
  if (typeof colorValue === 'number') return colorValue;
  if (!colorValue) return 0x2f3136;
  const key = String(colorValue).toLowerCase();
  if (COLOR_MAP[key]) return COLOR_MAP[key];

  if (key.startsWith('#')) {
    const parsed = parseInt(key.slice(1), 16);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const parsed = parseInt(key, 16);
  if (!Number.isNaN(parsed)) return parsed;

  return 0x2f3136;
}

function buildEmbed({ type, video, notificationConfig, channelName }) {
  const fieldsConfig = notificationConfig?.embed?.fields || [
    'title',
    'url',
    'thumbnail',
    'start_time'
  ];

  const colorValue = notificationConfig?.embed?.colors?.[type];
  const embed = {
    color: resolveColor(colorValue),
    description: channelName ? `Channel: ${channelName}` : undefined,
    author: { name: TYPE_LABELS[type] || type }
  };

  if (fieldsConfig.includes('title')) embed.title = video.title;
  if (fieldsConfig.includes('url')) embed.url = video.url;
  if (fieldsConfig.includes('thumbnail') && video.thumbnail) {
    embed.thumbnail = { url: video.thumbnail };
  }
  if (fieldsConfig.includes('start_time') && video.start_time) {
    embed.fields = [
      {
        name: 'Start Time',
        value: formatJstYmdHm(video.start_time),
        inline: false
      }
    ];
  }

  return embed;
}

async function sendWebhook({ webhookUrl, embed }) {
  const payload = { embeds: [embed] };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook error ${res.status}: ${text}`);
  }
}

module.exports = { buildEmbed, sendWebhook };
