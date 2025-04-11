require("dotenv").config();
const puppeteer = require("puppeteer");
const TelegramBot = require("node-telegram-bot-api");

// Khởi tạo bot Telegram với token từ .env
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Hàm khởi tạo Puppeteer
const launchBrowser = async () => {
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

// Hàm đăng nhập
async function login(page, username, password) {
  await page.goto("https://portal.ut.edu.vn", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await page.type("#username", username);
  await page.type("#password", password);
  await page.click("#submitButton");
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("✅ Đăng nhập thành công.");
}

// Hàm lấy thông tin công nợ
async function getTuition(launchBrowser) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await login(page, process.env.UT_USERNAME, process.env.UT_PASSWORD);

    await page.goto("https://portal.ut.edu.vn/tuition", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await page.waitForSelector(".MuiTable-root", { timeout: 30000 });
    console.log("✅ Đã tải trang công nợ.");

    const comboboxSelector = ".MuiSelect-select.MuiSelect-outlined";
    const currentValue = await page.$eval(comboboxSelector, (el) => el.textContent.trim());
    if (currentValue !== "Tất cả") {
      await page.click(comboboxSelector);
      await page.waitForSelector(".MuiMenu-list", { timeout: 10000 });
      await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll(".MuiMenuItem-root"));
        const allOption = options.find((opt) => opt.textContent.trim() === "Tất cả");
        if (allOption) allOption.click();
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log("✅ Đã chọn 'Tất cả' trong combobox.");
    } else {
      console.log("✅ Combobox đã ở trạng thái 'Tất cả'.");
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("⏳ Đã đợi thêm để bảng tải hoàn toàn.");

    const tuitionData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTable-root");
      if (!table) return { error: "Không tìm thấy bảng công nợ." };

      const rows = table.querySelectorAll("tbody tr");
      if (rows.length === 0) return { error: "Không có dữ liệu trong bảng." };

      const totalRow = Array.from(rows).slice(-1)[0];
      if (!totalRow || !totalRow.querySelector("td[colspan='4']")) {
        console.log("DEBUG: Không tìm thấy dòng 'Tổng' với colspan=4");
        return { error: "Không tìm thấy dòng tổng kết hợp lệ." };
      }

      const totalCells = totalRow.querySelectorAll("td");
      console.log(`DEBUG: Số cột trong dòng tổng: ${totalCells.length}`);
      console.log(`DEBUG: Nội dung dòng tổng: ${totalRow.textContent.trim()}`);

      const totalCredits = totalCells[4]
        ? parseInt(totalCells[4].textContent.trim()) || 0
        : 0;
      const totalTuitionText = totalCells[5]
        ? totalCells[5].textContent.trim().replace(/[^0-9]/g, "")
        : "0";
      const totalTuition = parseInt(totalTuitionText) || 0;
      const totalDebtText = totalCells[12]
        ? totalCells[12].textContent.trim().replace(/[^0-9]/g, "")
        : "0";
      const totalDebt = parseInt(totalDebtText) || 0;

      return { totalCredits, totalTuition, totalDebt };
    });

    if (tuitionData.error) throw new Error(tuitionData.error);

    console.log("✅ Đã lấy thông tin công nợ thành công.");
    return {
      totalCredits: tuitionData.totalCredits,
      totalTuition: tuitionData.totalTuition.toLocaleString("vi-VN") + " ₫",
      totalDebt: tuitionData.totalDebt.toLocaleString("vi-VN") + " ₫",
    };
  } catch (error) {
    console.error("❌ Lỗi trong getTuition:", error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

// Xử lý lệnh /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Chào mừng bạn! Gửi /conjno để xem thông tin công nợ.");
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
