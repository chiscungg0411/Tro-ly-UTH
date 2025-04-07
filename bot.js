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
  bot.sendMessage(
    chatId, "👋 Xin chào! Mình là Trợ lý UTH.\n" +
            "📅 /tuannay - Lấy lịch học tuần này.\n");
});

// Lệnh /lichhoc
bot.onText(/\/lichhoc/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📅 Đang lấy lịch học tuần này, vui lòng chờ trong giây lát ⌛...");

  try {
    const { schedule, week } = await getSchedule();
    let reply = `📅 **Lịch học tuần này của bạn:**\n`;
    reply += "ℹ️ Hãy truy cập [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết.\n\n";

    if (Object.keys(schedule).length) {
      for (const [day, classes] of Object.entries(schedule)) {
        if (classes.length > 0) {
          reply += `**${day}**:\n`;
          classes.forEach((item, index) => {
            reply += `${index + 1}. ${item.shift}: ${item.subject}\n   
            - 🕛 Giờ bắt đầu: ${item.time}\n   
            - 📍 Phòng học: ${item.room}\n`;
          });
          reply += "\n";
        }
      }
      if (reply === `📅 **Lịch học tuần này của bạn:**\nℹ️ Hãy truy cập [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết.\n\n`) {
        reply += "❌ Không có lịch học trong tuần này.";
      }
    } else {
      reply += "❌ Không có lịch học.";
    }
    bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
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