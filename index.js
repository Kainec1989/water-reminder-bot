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
const activeUsers = new Set();
const TIMEZONE = "Europe/Berlin";

// Вспомогательная функция для получения текущего времени в часовом поясе Берлина
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

// Функция расчета времени до следующего напоминания
function getTargetTimeDiff() {
  const { hour, minute } = getBerlinTime();
  let targetHour;

  if (hour < 9) {
    // Если еще нет 9 утра, то ближайшее напоминание будет сегодня в 9:00
    targetHour = 9;
  } else if (hour >= 21) {
    // If it's 21:00 or later, the next reminder is tomorrow at 9:00 AM
    targetHour = 9 + 24;
  } else {
    // В рабочее время (9-20) следующее напоминание — начало следующего часа
    targetHour = hour + 1;
  }

  // Считаем общую разницу в минутах
  const currentTotalMinutes = hour * 60 + minute;
  const targetTotalMinutes = targetHour * 60; // так как минуты всегда 00
  
  const diffMinutes = targetTotalMinutes - currentTotalMinutes;
  
  const hoursLeft = Math.floor(diffMinutes / 60);
  const minutesLeft = diffMinutes % 60;

  // Форматируем красивую строчку целевого часа (без учета +24 для завтрашнего дня)
  const displayTargetHour = targetHour >= 24 ? targetHour - 24 : targetHour;
  const formattedTargetTime = `${String(displayTargetHour).padStart(2, '0')}:00`;

  return {
    hoursLeft,
    minutesLeft,
    targetTimeStr: formattedTargetTime
  };
}

// Команда /start
bot.start((ctx) => {
  const chatId = ctx.chat.id;
  activeUsers.add(chatId);
  
  ctx.reply(
    'Привет! 💧 Я твой водный баланс-тренер. Каждый час с 9:00 до 21:00 я буду напоминать тебе выпить стакан воды.\n\n👉 Напиши /next, чтобы узнать, сколько времени осталось до следующего стакана!'
  );
  console.log(`Пользователь ${chatId} подписался.`);
});

// Новая команда /next — показывает таймер
bot.command('next', (ctx) => {
  const { hoursLeft, minutesLeft, targetTimeStr } = getTargetTimeDiff();
  
  let countdownStr = '';
  if (hoursLeft > 0) {
    countdownStr += `${hoursLeft} ч. `;
  }
  countdownStr += `${minutesLeft} мин.`;

  ctx.reply(
    `⏰ *Следующее напоминание:* в *${targetTimeStr}* (по Берлину).\n\n⏳ *Осталось подождать:* ${countdownStr}`,
    { parse_mode: 'Markdown' }
  );
});

// Команда /stop
bot.command('stop', (ctx) => {
  const chatId = ctx.chat.id;
  activeUsers.delete(chatId);
  ctx.reply('Напоминания отключены. Нажми /start, если захочешь вернуться.');
  console.log(`Пользователь ${chatId} отписался.`);
});

// Функция рассылки
const sendWaterReminder = () => {
  if (activeUsers.size === 0) return;

  for (const chatId of activeUsers) {
    bot.telegram.sendMessage(chatId, '💧 Время выпить стакан воды! Твоему организму нужна энергия. За здоровье! 🥤')
      .catch((err) => {
        if (err.description?.includes('bot was blocked by the user')) {
          activeUsers.delete(chatId);
        }
      });
  }
};

// Планировщик задач (Крон)
cron.schedule('0 9-21 * * *', () => {
  sendWaterReminder();
}, {
  scheduled: true,
  timezone: TIMEZONE
});

// Мягкая остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
bot.launch().then(() => console.log('🚀 Бот запущен!'));

// Фейковый сервер для Render (чтобы не падал по Port Binding)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running alive!');
}).listen(PORT, () => {
  console.log(`Fake web-server listening on port ${PORT}`);
});