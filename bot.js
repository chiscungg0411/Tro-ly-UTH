require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const puppeteerExtra = require("puppeteer-extra"); // Thêm import
const StealthPlugin = require("puppeteer-extra-plugin-stealth"); // Thêm import
const { getSchedule } = require("./schedule");

puppeteerExtra.use(StealthPlugin()); // Khởi tạo StealthPlugin

const token = process.env.TELEGRAM_BOT_TOKEN;
const app = express();
app.use(express.json());
const bot = new TelegramBot(token);

// Xử lý SIGTERM gracefully
process.on("SIGTERM", async () => {
  console.log("📴 Nhận tín hiệu SIGTERM, đang dừng bot...");
  try {
    await bot.deleteWebHook();
    console.log("✅ Đã xóa webhook.");
    console.log("✅ Bot đã dừng an toàn.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi dừng bot:", error.message);
    process.exit(1);
  }
});

// Xử lý lỗi hệ thống
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message);
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "👋 Xin chào! Mình là Trợ lý UTH, luôn cập nhật thông tin nhanh và tiện nhất đến cho bé Nguyệt :>.\n" +
    "📅 /tuannay - Lấy lịch học tuần này.\n" +
    "📆 /tuansau - Lấy lịch học tuần sau.\n" +
    "💡Mẹo: Nhấn nút Menu 📋 bên cạnh để chọn lệnh nhanh hơn!"
  );
});

bot.onText(/\/tuannay/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📅 Đang lấy lịch học tuần này, vui lòng chờ trong giây lát... ⌛");

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
                     `📖 **Môn học:** ${c.subject}\n` +
                     `📅 **Tiết:** ${c.periods}\n` +
                     `🕛 **Giờ bắt đầu:** ${c.startTime}\n` +
                     `📍 **Phòng học:** ${c.room}\n\n`;
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

bot.onText(/\/tuansau/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📆 Đang lấy lịch học tuần sau, vui lòng chờ trong giây lát... ⌛");

  try {
    const { schedule, week } = await getSchedule(true);
    let message = `📆 **Lịch học tuần sau của bạn:**\n------------------------------------\n`;

    const days = Object.keys(schedule);
    days.forEach((day, index) => {
      const [thu, ngay] = day.split(/(\d{2}\/\d{2}\/\d{4})/);
      const formattedDay = `${thu} - ${ngay}`.trim();
      
      const classes = schedule[day];
      message += `⭐ **${formattedDay}:**\n`;
      if (classes.length) {
        classes.forEach((c) => {
          message += `⏰ **${c.shift}**\n` +
                     `📖 **Môn học:** ${c.subject}\n` +
                     `📅 **Tiết:** ${c.periods}\n` +
                     `🕛 **Giờ bắt đầu:** ${c.startTime}\n` +
                     `📍 **Phòng học:** ${c.room}\n\n`;
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

// Cấu hình Webhook
const PORT = process.env.PORT || 10001;
const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot${token}`;

// Endpoint nhận tin nhắn từ Telegram
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check endpoint
app.get("/ping", (req, res) => {
  console.log("🏓 Chatbot được đánh thức bởi cron-job.org!");
  res.status(200).send("Bot is alive!");
});

// Khởi động server và thiết lập webhook
app.listen(PORT, async () => {
  console.log(`Server chạy trên port ${PORT}`);
  try {
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook được thiết lập: ${webhookUrl}`);
  } catch (error) {
    console.error("❌ Lỗi thiết lập webhook:", error.message);
  }
  console.log("🤖 Bot Telegram (Webhook) đang hoạt động...");
});
