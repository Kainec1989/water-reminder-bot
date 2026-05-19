import { Telegraf } from 'telegraf';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.BOT_TOKEN) {
  console.error('Error: BOT_TOKEN is missing in .env file');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// В реальном проекте мы бы юзали MongoDB, но для микро-бота пока сохраним в Set (в оперативку)
const activeUsers = new Set();

// Команда /start — подписывает пользователя на уведомления
bot.start((ctx) => {
  const chatId = ctx.chat.id;
  activeUsers.add(chatId);
  
  ctx.reply(
    'Привет! 💧 Я твой водный баланс-тренер. Каждый час с 9:00 до 21:00 я буду напоминать тебе выпить стакан воды.\n\nПервое напоминание прилетит автоматически в ближайший рабочий час!'
  );
  console.log(`Пользователь ${chatId} подписался на уведомления.`);
});

// Команда /stop — отписка
bot.command('stop', (ctx) => {
  const chatId = ctx.chat.id;
  activeUsers.delete(chatId);
  ctx.reply('Напоминания отключены. Если захочешь вернуться, просто нажми /start');
  console.log(`Пользователь ${chatId} отписался.`);
});

// Функция рассылки
const sendWaterReminder = () => {
  if (activeUsers.size === 0) {
    console.log('Нет активных пользователей для рассылки.');
    return;
  }

  console.log(`Запуск рассылки для ${activeUsers.size} пользователей...`);
  for (const chatId of activeUsers) {
    bot.telegram.sendMessage(chatId, '💧 Время выпить стакан воды! Твоему организму нужна энергия. За здоровье! 🥤')
      .catch((err) => {
        console.error(`Не удалось отправить сообщение пользователю ${chatId}:`, err);
        // Если пользователь заблокировал бота, удаляем его из списка
        if (err.description?.includes('bot was blocked by the user')) {
          activeUsers.delete(chatId);
        }
      });
  }
};

// Настройка Планировщика задач (Cron)
// Синтаксис: 'минута час день_месяца месяц день_недели'
// '0 9-21 * * *' означает: Ровно в 0 минут, каждый час с 9 до 21, в любой день.
cron.schedule('0 9-21 * * *', () => {
  sendWaterReminder();
}, {
  scheduled: true,
  timezone: "Europe/Berlin" // Ставим твой часовой пояс, чтобы бот не будил ночью
});

// Запуск бота
bot.launch()
  .then(() => console.log('🚀 Бот успешно запущен и следит за твоим водным балансом!'))
  .catch((err) => console.error('Ошибка запуска бота:', err));

// Мягкая остановка при выключении сервера
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));