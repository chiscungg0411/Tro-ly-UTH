const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

async function launchBrowser() {
  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
      timeout: 60000,
    });
    console.log("✅ Trình duyệt đã khởi động.");
    return browser;
  } catch (error) {
    console.error("❌ Lỗi khởi động trình duyệt:", error);
    throw new Error("Không thể khởi động trình duyệt.");
  }
}

async function login(browser, page, username, password, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔑 Thử đăng nhập lần ${attempt}...`);
      await page.goto("https://portal.ut.edu.vn/", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      console.log("✅ Trang đăng nhập đã tải.");

      await page.waitForSelector("input[name='username']", { timeout: 30000 });
      await page.type("input[name='username']", username, { delay: 50 });
      await page.waitForSelector("input[name='password']", { timeout: 30000 });
      await page.type("input[name='password']", password, { delay: 50 });
      console.log("✍️ Đã nhập thông tin đăng nhập.");

      await page.click("button[type='submit']");
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
      const finalUrl = page.url();
      console.log(`🌐 URL sau đăng nhập: ${finalUrl}`);

      if (finalUrl.includes("/dashboard")) {
        console.log("✅ Đăng nhập thành công.");
        return true;
      } else {
        throw new Error("Đăng nhập thất bại, kiểm tra thông tin hoặc CAPTCHA.");
      }
    } catch (error) {
      console.error(`❌ Lỗi đăng nhập lần ${attempt}:`, error.message);
      if (attempt === retries) throw new Error(`Đăng nhập thất bại sau ${retries} lần.`);
      await page.close();
      await browser.close();
      browser = await launchBrowser();
      page = await browser.newPage();
    }
  }
}

async function getSchedule() {
  let browser = await launchBrowser();
  let page = await browser.newPage();

  try {
    await login(browser, page, process.env.UT_USERNAME, process.env.UT_PASSWORD);
    await page.goto("https://portal.ut.edu.vn/dashboard/schedule", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log(`🌐 URL lịch học: ${page.url()}`);

    await page.waitForSelector("table", { timeout: 30000 });

    const scheduleData = await page.evaluate(() => {
      const table = document.querySelector("table");
      if (!table) throw new Error("Không tìm thấy bảng lịch học!");

      const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
        th.textContent.trim()
      );
      const days = headers.slice(1);
      const schedule = {};

      days.forEach((day, dayIndex) => {
        schedule[day] = [];
        const cells = table.querySelectorAll(`tbody td:nth-child(${dayIndex + 2})`);
        cells.forEach((cell) => {
          const text = cell.textContent.trim();
          if (text) {
            const [subject, time, room] = text.split(" - ");
            schedule[day].push({
              subject: subject || "Không rõ",
              time: time || "Không rõ",
              room: room || "Không rõ",
            });
          }
        });
      });

      const weekInfo = document.querySelector(".week-info")?.textContent.trim() || "Tuần hiện tại";
      return { schedule, week: weekInfo };
    });

    console.log("✅ Đã lấy lịch học.");
    return scheduleData;
  } catch (error) {
    console.error("❌ Lỗi trong getSchedule:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { getSchedule };