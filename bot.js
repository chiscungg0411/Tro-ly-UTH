require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { getSchedule, getTuition, getProgress } = require("./schedule");

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
    "🤖 Chào em bé! Mình là Trợ lý UTH, được tạo ra bởi anh Cường đẹp trai! Luôn cập nhật thông tin nhanh và tiện nhất đến cho riêng bé Nguyệt :>\n" +
    "📅 /tuannay: Lấy lịch học tuần này\n" +
    "📅 /tuansau: Lấy lịch học tuần sau\n" +
    "💰 /congno: Lấy thông tin công nợ\n" +
    "🏁 /tiendo: Lấy tiến độ học tập\n" +
    "Mẹo: Nhấn nút Menu bên cạnh để chọn lệnh nhanh hơn nha em bé!"
  );
});

// Lệnh /tuannay
bot.onText(/\/tuannay/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    "Đang lấy lịch học tuần này, em bé vui lòng chờ trong giây lát nha... ⌛"
  );

  try {
    const { schedule, week } = await getSchedule();
    let message = "Lịch học tuần này của em bé:\n";
    let message = "---------------------------------\n";
    const days = Object.keys(schedule);
    for (let day of days) {
      const [thu, ngay] = day.split(/(\d{2}\/\d{2}\/\d{4})/);
      const formattedDay = `${thu} - ${ngay}`.trim();
      message += `⭐**${formattedDay}:**\n`;
      const classes = schedule[day];
      if (classes.length) {
        for (let c of classes) {
          message +=
            `⏰ **Ca học:** ${c.shift}\n` +
            `📖 **Môn học** ${c.subject}\n` +
            `📅 **Tiết:** ${c.periods}\n` +
            `🕛 **Giờ bắt đầu:** ${c.startTime}\n` +
            `📍 **Phòng học:** ${c.room}\n\n` +
            `ℹ️ Hãy truy cập vào [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết nha em bé.`;
        }
      } else {
        message += "Không có lịch học đâu em bé\n";
      }
    }
    message += `ℹ️ Hãy truy cập vào [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết nha em bé.`;
    bot.sendMessage(chatId,
      message,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    bot.sendMessage(chatId,
      "Lỗi lấy lịch học: " + error.message
    );
  }
});

// Lệnh /tuansau
bot.onText(/\/tuansau/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    "Đang lấy lịch học tuần sau, em bé vui lòng chờ trong giây lát nha... ⌛"
  );

  try {
    const { schedule, week } = await getSchedule(true);
    let message = "🌙 **Lịch học tuần sau của em bé:**\n";
    let message = "---------------------------------\n";
    const days = Object.keys(schedule);
    for (let day of days) {
      const [thu, ngay] = day.split(/(\d{2}\/\d{2}\/\d{4})/);
      const formattedDay = `${thu} - ${ngay}`.trim();
      message += `\n**${formattedDay}:**\n`;
      const classes = schedule[day];
      if (classes.length) {
        for (let c of classes) {
          message +=
            `⏰ **Ca học:** ${c.shift}\n` +
            `📖 **Môn học:** ${c.subject}\n` +
            `📅 **Tiết:** ${c.periods}\n` +
            `🕛 **Giờ bắt đầu:** ${c.startTime}\n` +
            `📍 **Phòng học:** ${c.room}\n\n` +
            `ℹ️ Hãy truy cập vào [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết nha em bé.`;
        }
      } else {
        message += "Không có lịch học rồi em bé ơi\n";
      }
    }
    message += `ℹ️ Hãy truy cập vào [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết nha em bé.`;
    bot.sendMessage(chatId,
      message,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    bot.sendMessage(chatId,
      "Lỗi lấy lịch học: " + error.message
    );
  }
});

// Lệnh /congno
bot.onText(/\/congno/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    "Đang lấy thông tin công nợ, em bé vui lòng chờ trong giây lát nha... ⌛"
  );

  try {
    const tuition = await getTuition();
    let message = "Thông tin công nợ của em bé:\n";
    let message = "---------------------------------\n";
    message += `📊 **Tổng tín chỉ:** ${tuition.totalCredits} tín chỉ\n`;
    message += `💸 **Tổng mức nộp:** ${tuition.totalAmountDue} VNĐ\n`;
    message += `⚖️ **Tổng công nợ:** ${tuition.totalDebt} VNĐ\n`;
    message += `ℹ️ Hãy truy cập vào [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết nha em bé.`;
    bot.sendMessage(chatId,
      message,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    bot.sendMessage(chatId,
      "Lỗi lấy thông tin công nợ: " + error.message
    );
  }
});

// Lệnh /tiendo
bot.onText(/\/tiendo/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    "🏁 Đang lấy tiến độ học tập, em bé vui lòng chờ trong giây lát nha... ⌛"
  );

  try {
    const { achieved, total } = await getProgress();
    let message = "🏁 Tiến độ học tập của em bé:\n";
    let message = "---------------------------------\n";
    message += `📚 Tín chỉ đã đạt: ${achieved} tín chỉ\n`;
    message += `📈 Tín chỉ tổng cộng: ${total} tín chỉ\n`;
    message += `📊 Tiến độ: ${((achieved / total) * 100).toFixed(2)}%\n`;
    message += `ℹ️ Hãy truy cập vào [Portal UTH](https://portal.ut.edu.vn/dashboard) để biết thêm thông tin chi tiết nha em bé.`;
    bot.sendMessage(chatId,
      message,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    bot.sendMessage(chatId,
      "❌ Lỗi lấy tiến độ học tập: " + error.message
    );
  }
});

// Route để kiểm tra server
app.get("/ping", (req, res) => {
  console.log("Chatbot được đánh thức bởi cron-job.org!");
  res.status(200).send("Bot is alive!");
});

// Khởi động server
const PORT = process.env.PORT || 10001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Bot Telegram is running with web hook...");
});
