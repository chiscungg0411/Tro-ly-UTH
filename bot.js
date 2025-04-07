require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { getSchedule } = require("./schedule");

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const app = express();
app.use(express.json());

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Xin chào! Mình là trợ lý UTH.\n- /tuannay: Xem lịch học tuần này");
});

bot.onText(/\/tuannay/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📅 Đang lấy lịch học tuần này, vui lòng chờ... ⌛");

  try {
    const { schedule, week } = await getSchedule();
    let message = `📅 **Lịch học tuần này của bạn:**\n------------------------------------\n`;

    const days = Object.keys(schedule);
    days.forEach((day, index) => {
      const [thu, ngay] = day.split(/(\d{2}\/\d{2}\/\d{4})/);
      const formattedDay = `${thu} - ${ngay}`.trim();
      
      const classes = schedule[day];
      message += `⭐ **${formattedDay}:**\n`;
      if (classes.length) {
        classes.forEach((c) => {
          message += `⏰ **${c.shift}**\n` +
                     `📖 **Môn:** ${c.subject}\n` +
                     `📅 **Tiết:** ${c.periods}\n` +
                     `🕛 **Giờ bắt đầu:** ${c.startTime}\n` +
                     `📍 **Phòng:** ${c.room}\n\n`;
        });
      } else {
        message += "❌ Không có lịch\n";
      }
      if (index < days.length - 1) message += "\n";
    });

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy lịch học: ${error.message}`);
  }
});

app.get("/ping", (req, res) => {
  console.log("🏓 Ping từ Render!");
  res.status(200).send("Bot is alive!");
});

const PORT = process.env.PORT || 10001;
app.listen(PORT, () => {
  console.log(`Server chạy trên port ${PORT}`);
  console.log("🤖 Bot Telegram đang hoạt động...");
});

bot.on("polling_error", (error) => {
  console.error("❌ Polling error:", error.message);
});