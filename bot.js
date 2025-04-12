require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { getSchedule, getTuition } = require("./schedule");

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token); // Không cần polling nữa
const app = express();
app.use(express.json());

// Webhook endpoint để Telegram gửi cập nhật
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body); // Xử lý cập nhật từ Telegram
  res.sendStatus(200); // Phản hồi Telegram với mã 200
});

// Thiết lập webhook khi server khởi động
const webhookUrl = process.env.WEBHOOK_URL || `https://your-domain.com/bot${token}`;
bot.setWebHook(webhookUrl).then(() => {
  console.log(`✅ Webhook được thiết lập tại: ${webhookUrl}`);
}).catch((error) => {
  console.error("❌ Lỗi thiết lập webhook:", error.message);
});

// Lệnh /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "👋 Xin chào! Mình là Trợ lý UTH, luôn cập nhật thông tin nhanh và tiện nhất đến cho bé Nguyệt :>.\n" +
    "📅 /tuannay - Lấy lịch học tuần này.\n" +
    "📆 /tuansau - Lấy lịch học tuần sau.\n" +
    "💰 /congno - Lấy thông tin công nợ.\n" +
    "💡Mẹo: Nhấn nút Menu 📋 bên cạnh để chọn lệnh nhanh hơn!"
  );
});

// Lệnh /tuannay
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
                     `📍 **Phòng học:** ${c.room}\n\n` +
                     `ℹ️ Hãy truy cập vào **[Portal UTH](https://portal.ut.edu.vn/dashboard)** để biết thêm thông tin chi tiết.`;
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

// Lệnh /tuansau
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
                     `📍 **Phòng học:** ${c.room}\n\n` +
                     `ℹ️ Hãy truy cập vào **[Portal UTH](https://portal.ut.edu.vn/dashboard)** để biết thêm thông tin chi tiết.`;
          
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

// Lệnh /congno
bot.onText(/\/congno/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "💰 Đang lấy thông tin công nợ, vui lòng chờ trong giây lát... ⌛");

  try {
    const tuition = await getTuition();
    const message = `💰 **Thông tin công nợ của bạn:**\n------------------------------------\n` +
                    `📊 **Tổng tín chỉ:** ${tuition.totalCredits}\n` +
                    `💸 **Tổng mức nộp:** ${tuition.totalAmountDue} VNĐ\n` +
                    `👛 **Tổng công nợ:** ${tuition.totalDebt} VNĐ\n` +
                    `ℹ️ Hãy truy cập vào **[Portal UTH](https://portal.ut.edu.vn/dashboard)** để biết thêm thông tin chi tiết.`;
            
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy thông tin công nợ: ${error.message}`);
  }
});

// Route để kiểm tra server
app.get("/ping", (req, res) => {
  console.log("🏓 Chatbot được đánh thức bởi cron-job.org!");
  res.status(200).send("Bot is alive!");
});

// Khởi động server
const PORT = process.env.PORT || 10001;
app.listen(PORT, () => {
  console.log(`Server chạy trên port ${PORT}`);
  console.log("🤖 Bot Telegram đang hoạt động với webhook...");
});
