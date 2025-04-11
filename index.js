require("dotenv").config();
const puppeteer = require("puppeteer");
const TelegramBot = require("node-telegram-bot-api");
const { getTuition } = require("./schedule.js");

// Khởi tạo bot Telegram với token từ .env
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Hàm khởi tạo Puppeteer
const launchBrowser = async () => {
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

// Xử lý lệnh /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Chào mừng bạn! Gửi /congno để xem thông tin công nợ.");
});

// Xử lý lệnh /congno
bot.onText(/\/congno/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Đang lấy thông tin công nợ, vui lòng chờ...");

  try {
    const tuition = await getTuition(launchBrowser);
    const response = `
💰 **Thông tin công nợ của bạn:**
------------------------------------
📚 **Tổng tín chỉ:** ${tuition.totalCredits}
💸 **Tổng học phí:** ${tuition.totalTuition}
📉 **Công nợ:** ${tuition.totalDebt}
------------------------------------
✅ Dữ liệu được lấy từ tab "Học phí ngành" với tùy chọn "Tất cả".
    `;
    bot.sendMessage(chatId, response);
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy thông tin công nợ: ${error.message}`);
  }
});

// Log khi bot khởi động
console.log("✅ Bot Telegram đã khởi động.");
