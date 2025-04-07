require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { getSchedule } = require("./schedule");

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const app = express();
app.use(express.json());

// Lệnh /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Xin chào! Mình là trợ lý UTH.\n- /tuannay: Xem lịch học tuần này");
});

// Lệnh /tuannay
bot.onText(/\/tuannay/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📅 Đang lấy lịch học tuần này, vui lòng chờ trong giây lát ⌛...");

  try {
    const { schedule, week } = await getSchedule();
    let message = `📅 **Lịch học tuần này của bạn**\n------------------------------------\n`;

    for (const [ngay, monHocs] of Object.entries(schedule)) {
      message += `📌 **${ngay}:**\n`;
      if (monHocs.length) {
        monHocs.forEach((m) => {
          message += `📖 **Môn học:** ${m.subject}\n` +
                     `📅 **Tiết:** ${m.periods}\n` +
                     `🕛 **Giờ bắt đầu:** ${m.startTime}\n` +
                     `📍 **Phòng học:** ${m.room}\n\n`;
        });
      } else {
        message += "❌ Không có lịch\n\n";
      }
    }

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy lịch học: ${error.message}`);
  }
});

// Endpoint cho Render
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