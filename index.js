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
const activeUsers = new Map(); // Изменили Set на Map, чтобы хранить пары { chatId: languageCode }
const TIMEZONE = "Europe/Berlin";

// Словари с переводами
const i18n = {
  ru: {
    start: 'Привет! 💧 Я твой водный баланс-тренер. Каждый час с 9:00 до 21:00 я буду напоминать тебе выпить стакан воды.\n\n👉 Напиши /next, чтобы узнать, сколько времени осталось до следующего стакана!',
    stop: 'Напоминания отключены. Нажми /start, если захочешь вернуться.',
    reminder: '💧 Время выпить стакан воды! Твоему организму нужна энергия. За здоровье! 🥤',
    next_prefix: '⏰ *Следующее напоминание:* в *${targetTimeStr}* (по Берлину).',
    countdown_prefix: '⏳ *Осталось подождать:* ',
    hours: 'ч.',
    minutes: 'мин.'
  },
  de: {
    start: 'Hallo! 💧 Ich bin dein Wasser-Erinnerungs-Bot. Von 9:00 bis 21:00 Uhr erinnere ich dich stündlich daran, ein Glas Wasser zu trinken.\n\n👉 Tippe /next, um zu sehen, wie viel Zeit bis zum nächsten Glas verbleibt!',
    stop: 'Erinnerungen deaktiviert. Tippe /start, wenn du zurückkehren möchtest.',
    reminder: '💧 Zeit, ein Glas Wasser zu trinken! Dein Körper braucht Energie. Auf deine Gesundheit! 🥤',
    next_prefix: '⏰ *Nächste Erinnerung:* um *${targetTimeStr}* (Berliner Zeit).',
    countdown_prefix: '⏳ *Verbleibende Zeit:* ',
    hours: 'Std.',
    minutes: 'Min.'
  },
  en: {
    start: 'Hello! 💧 I am your water hydration coach. Every hour between 9:00 AM and 9:00 PM, I will remind you to drink a glass of water.\n\n👉 Type /next to check how much time is left until your next glass!',
    stop: 'Reminders disabled. Type /start if you want to come back.',
    reminder: '💧 Time to drink a glass of water! Your body needs energy. Cheers to health! 🥤',
    next_prefix: '⏰ *Next reminder:* at *${targetTimeStr}* (Berlin time).',
    countdown_prefix: '⏳ *Time remaining:* ',
    hours: 'h.',
    minutes: 'min.'
  }
};

// Хелпер для определения языка (дефолт — английский)
function getLanguage(ctx) {
  const langCode = ctx.from?.language_code?.toLowerCase();
  if (langCode && i18n[langCode]) {
    return langCode;
  }
  return 'en'; 
}

// Вспомогательная функция для получения времени в Берлине
function getBerlinTime() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  const timeObj = {};
  parts.forEach(({ type, value }) => {
    timeObj[type] = parseInt(value, 10);
  });
  
  return { hour: timeObj.hour, minute: timeObj.minute };
}

// Расчет времени до следующего напоминания
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

// Команда /start
bot.start((ctx) => {
  const chatId = ctx.chat.id;
  const lang = getLanguage(ctx);
  
  activeUsers.set(chatId, lang); // Сохраняем пользователя и его язык
  
  ctx.reply(i18n[lang].start);
  console.log(`Пользователь ${chatId} подписался. Язык: ${lang}`);
});

// Команда /next с локализацией таймера
bot.command('next', (ctx) => {
  const lang = getLanguage(ctx);
  const t = i18n[lang];
  const { hoursLeft, minutesLeft, targetTimeStr } = getTargetTimeDiff();
  
  let countdownStr = '';
  if (hoursLeft > 0) {
    countdownStr += `${hoursLeft} ${t.hours} `;
  }
  countdownStr += `${minutesLeft} ${t.minutes}`;

  // Подставляем время в заготовленную строку
  const responseMsg = t.next_prefix.replace('${targetTimeStr}', targetTimeStr) + 
                      `\n\n${t.countdown_prefix}${countdownStr}`;

  ctx.reply(responseMsg, { parse_mode: 'Markdown' });
});

// Команда /stop
bot.command('stop', (ctx) => {
  const chatId = ctx.chat.id;
  const lang = getLanguage(ctx);
  
  activeUsers.delete(chatId);
  ctx.reply(i18n[lang].stop);
  console.log(`Пользователь ${chatId} отписался.`);
});

// Функция ежечасной рассылки с учетом языка каждого пользователя
const sendWaterReminder = () => {
  if (activeUsers.size === 0) return;

  for (const [chatId, lang] of activeUsers.entries()) {
    const text = i18n[lang].reminder;
    
    bot.telegram.sendMessage(chatId, text)
      .catch((err) => {
        if (err.description?.includes('bot was blocked by the user')) {
          activeUsers.delete(chatId);
        }
      });
  }
};

// Планировщик задач (Крон) — теперь строго по UTC, чтобы у Render не ехала крыша
cron.schedule('0 7-19 * * *', () => {
    console.log('Крон сработал по UTC! Запускаю рассылку...');
    sendWaterReminder();
  });

// Мягкая остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
bot.launch().then(() => console.log('🚀 Бот запущен с поддержкой мультиязычности!'));

// Фейковый сервер для Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running alive!');
}).listen(PORT, () => {
  console.log(`Fake web-server listening on port ${PORT}`);
});