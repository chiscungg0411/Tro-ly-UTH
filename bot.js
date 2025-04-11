// bot.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { getSchedule, getTuition } = require("./schedule");

puppeteerExtra.use(StealthPlugin());

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

// Hàm khởi động trình duyệt
async function launchBrowser() {
  try {
    const browser = await puppeteerExtra.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--single-process",
        "--no-zygote",
        "--disable-accelerated-2d-canvas",
        "--disable-features=site-per-process",
      ],
      defaultViewport: { width: 1280, height: 720 },
      timeout: 120000,
      pipe: true,
    });
    console.log("✅ Trình duyệt Puppeteer đã khởi động.");
    return browser;
  } catch (error) {
    console.error("❌ Lỗi khởi động trình duyệt:", error.message);
    throw new Error("Không thể khởi động trình duyệt.");
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "👋 Xin chào! Mình là Trợ lý UTH, luôn cập nhật thông tin nhanh và tiện nhất đến cho bé Nguyệt :>.\n" +
      "📅 /tuannay - Lấy lịch học tuần này.\n" +
      "📆 /tuansau - Lấy lịch học tuần sau.\n" +
      "💰 /congno - Tổng hợp tín chỉ và học phí.\n" +
      "💡Mẹo: Nhấn nút Menu 📋 bên cạnh để chọn lệnh nhanh hơn!"
  );
});

bot.onText(/\/tuannay/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📅 Đang lấy lịch học tuần này, vui lòng chờ trong giây lát... ⌛");

  try {
    const schedule = await getSchedule(launchBrowser, false);
    let message = "📅 **Lịch học tuần này:**\n------------------------------------\n";
    let hasSchedule = false;

    for (const [date, events] of Object.entries(schedule)) {
      hasSchedule = true;
      message += `📌 **${date}**:\n`;
      events.forEach((event) => {
        message += `   ⏰ ${event.time}: ${event.title}\n`;
      });
      message += "\n";
    }

    if (!hasSchedule) {
      message = "📅 Tuần này không có lịch học.";
    }

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy lịch học: ${error.message}`);
  }
});

bot.onText(/\/tuansau/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📆 Đang lấy lịch học tuần sau, vui lòng chờ trong giây lát... ⌛");

  try {
    const schedule = await getSchedule(launchBrowser, true);
    let message = "📆 **Lịch học tuần sau:**\n------------------------------------\n";
    let hasSchedule = false;

    for (const [date, events] of Object.entries(schedule)) {
      hasSchedule = true;
      message += `📌 **${date}**:\n`;
      events.forEach((event) => {
        message += `   ⏰ ${event.time}: ${event.title}\n`;
      });
      message += "\n";
    }

    if (!hasSchedule) {
      message = "📆 Tuần sau không có lịch học.";
    }

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy lịch học: ${error.message}`);
  }
});

bot.onText(/\/congno/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "💰 Đang lấy thông tin công nợ, vui lòng chờ trong giây lát... ⌛");

  try {
    const { totalCredits, totalTuition, totalDebt } = await getTuition(launchBrowser);
    const message =
      `💰 **Thông tin công nợ của bạn:**\n` +
      `------------------------------------\n` +
      `📚 **Tổng tín chỉ:** ${totalCredits}\n` +
      `💸 **Tổng học phí:** ${totalTuition}\n` +
      `📉 **Công nợ:** ${totalDebt}\n` +
      `------------------------------------\n` +
      `✅ Dữ liệu được lấy từ tab "Học phí ngành" với tùy chọn "Tất cả".`;

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy thông tin công nợ: ${error.message}`);
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
