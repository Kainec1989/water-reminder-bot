import { Telegraf } from 'telegraf';
import cron from 'node-cron';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

if (!process.env.BOT_TOKEN) {
  console.error('Error: BOT_TOKEN is missing in .env file');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const activeUsers = new Map(); // chatId -> languageCode
const TIMEZONE = 'Europe/Berlin';

const LANG_ALIASES = { uk: 'ru' };

const REMOVE_CHAT_ERRORS = [
  'bot was blocked by the user',
  'chat not found',
  'user is deactivated',
];

// Словари с переводами
const i18n = {
  ru: {
    start: 'Привет! 💧 Я твой водный баланс-тренер. Каждый час с 9:00 до 21:00 я буду напоминать тебе выпить стакан воды.\n\n👉 Напиши /next, чтобы узнать, сколько времени осталось до следующего стакана!',
    stop: 'Напоминания отключены. Нажми /start, если захочешь вернуться.',
    reminder: '💧 Время выпить стакан воды! Твоему организму нужна энергия. За здоровье! 🥤',
    next_prefix: '⏰ *Следующее напоминание:* в *${targetTimeStr}* (по Берлину).',
    countdown_prefix: '⏳ *Осталось подождать:* ',
    next_need_start: 'Сначала нажми /start, чтобы подписаться на напоминания.',
    hours: 'ч.',
    minutes: 'мин.',
  },
  de: {
    start: 'Hallo! 💧 Ich bin dein Wasser-Erinnerungs-Bot. Von 9:00 bis 21:00 Uhr erinnere ich dich stündlich daran, ein Glas Wasser zu trinken.\n\n👉 Tippe /next, um zu sehen, wie viel Zeit bis zum nächsten Glas verbleibt!',
    stop: 'Erinnerungen deaktiviert. Tippe /start, wenn du zurückkehren möchtest.',
    reminder: '💧 Zeit, ein Glas Wasser zu trinken! Dein Körper braucht Energie. Auf deine Gesundheit! 🥤',
    next_prefix: '⏰ *Nächste Erinnerung:* um *${targetTimeStr}* (Berliner Zeit).',
    countdown_prefix: '⏳ *Verbleibende Zeit:* ',
    next_need_start: 'Tippe zuerst /start, um Erinnerungen zu aktivieren.',
    hours: 'Std.',
    minutes: 'Min.',
  },
  en: {
    start: 'Hello! 💧 I am your water hydration coach. Every hour between 9:00 AM and 9:00 PM, I will remind you to drink a glass of water.\n\n👉 Type /next to check how much time is left until your next glass!',
    stop: 'Reminders disabled. Type /start if you want to come back.',
    reminder: '💧 Time to drink a glass of water! Your body needs energy. Cheers to health! 🥤',
    next_prefix: '⏰ *Next reminder:* at *${targetTimeStr}* (Berlin time).',
    countdown_prefix: '⏳ *Time remaining:* ',
    next_need_start: 'Type /start first to subscribe to reminders.',
    hours: 'h.',
    minutes: 'min.',
  },
};

function formatMsg(lang, key, vars = {}) {
  let text = i18n[lang][key];
  for (const [name, value] of Object.entries(vars)) {
    text = text.replace(`\${${name}}`, value);
  }
  return text;
}

// Язык по коду Telegram (дефолт — английский)
function getLanguage(ctx) {
  const raw = ctx.from?.language_code?.toLowerCase();
  if (!raw) return 'en';
  if (LANG_ALIASES[raw]) return LANG_ALIASES[raw];
  if (i18n[raw]) return raw;
  const prefix = raw.split('-')[0];
  if (i18n[prefix]) return prefix;
  return 'en';
}

function getUserLang(chatId, ctx) {
  return activeUsers.get(chatId) ?? getLanguage(ctx);
}

function getBerlinTime() {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const minute = Number(parts.find((p) => p.type === 'minute').value);
  return { hour, minute };
}

function getTargetTimeDiff() {
  const { hour, minute } = getBerlinTime();
  let targetHour;

  if (hour < 9) {
    targetHour = 9;
  } else if (hour >= 21) {
    targetHour = 9 + 24;
  } else {
    targetHour = hour + 1;
  }

  const currentTotalMinutes = hour * 60 + minute;
  const targetTotalMinutes = targetHour * 60;
  const diffMinutes = targetTotalMinutes - currentTotalMinutes;

  const hoursLeft = Math.floor(diffMinutes / 60);
  const minutesLeft = diffMinutes % 60;

  const displayTargetHour = targetHour >= 24 ? targetHour - 24 : targetHour;
  const formattedTargetTime = `${String(displayTargetHour).padStart(2, '0')}:00`;

  return { hoursLeft, minutesLeft, targetTimeStr: formattedTargetTime };
}

bot.start((ctx) => {
  const chatId = ctx.chat.id;
  const lang = getLanguage(ctx);

  activeUsers.set(chatId, lang);

  ctx.reply(i18n[lang].start);
  console.log(`Пользователь ${chatId} подписался. Язык: ${lang}`);
});

bot.command('next', (ctx) => {
  const chatId = ctx.chat.id;
  const lang = getUserLang(chatId, ctx);
  const t = i18n[lang];

  if (!activeUsers.has(chatId)) {
    ctx.reply(t.next_need_start);
    return;
  }

  const { hoursLeft, minutesLeft, targetTimeStr } = getTargetTimeDiff();

  let countdownStr = '';
  if (hoursLeft > 0) {
    countdownStr += `${hoursLeft} ${t.hours} `;
  }
  countdownStr += `${minutesLeft} ${t.minutes}`;

  const responseMsg =
    formatMsg(lang, 'next_prefix', { targetTimeStr }) +
    `\n\n${t.countdown_prefix}${countdownStr}`;

  ctx.reply(responseMsg, { parse_mode: 'Markdown' });
});

bot.command('stop', (ctx) => {
  const chatId = ctx.chat.id;
  const lang = getUserLang(chatId, ctx);

  activeUsers.delete(chatId);
  ctx.reply(i18n[lang].stop);
  console.log(`Пользователь ${chatId} отписался.`);
});

const sendWaterReminder = () => {
  if (activeUsers.size === 0) return;

  for (const [chatId, lang] of activeUsers.entries()) {
    const text = i18n[lang].reminder;

    bot.telegram.sendMessage(chatId, text).catch((err) => {
      const desc = err.description ?? '';
      if (REMOVE_CHAT_ERRORS.some((e) => desc.includes(e))) {
        activeUsers.delete(chatId);
        console.log(`Removed ${chatId}: ${desc}`);
      } else {
        console.error(`Failed to send to ${chatId}:`, desc || err.message);
      }
    });
  }
};

const reminderJob = cron.schedule(
  '0 9-21 * * *',
  () => {
    console.log('Cron fired (Europe/Berlin). Sending reminders...');
    sendWaterReminder();
  },
  { timezone: TIMEZONE },
);

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running alive!');
});

server.listen(PORT, () => {
  console.log(`Health server listening on port ${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down...`);
  reminderJob.stop();
  await new Promise((resolve) => server.close(resolve));
  await bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

bot.launch().then(() => console.log('🚀 Бот запущен с поддержкой мультиязычности!'));
