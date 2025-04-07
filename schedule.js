const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

// Hàm làm sạch chuỗi, giữ dấu tiếng Việt và dấu chấm
function cleanText(text) {
  // Giữ chữ, số, khoảng trắng, /, :, -, ., và các ký tự Unicode tiếng Việt
  return text
    .replace(/[^\p{L}\p{N}\s\d\/:-.]/gu, "") // \p{L} cho ký tự chữ (bao gồm tiếng Việt), \p{N} cho số
    .trim();
}

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
        "--no-zygote",
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

async function login(page, username, password, retries = 3) {
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
        throw new Error("Đăng nhập thất bại, kiểm tra thông tin.");
      }
    } catch (error) {
      console.error(`❌ Lỗi đăng nhập lần ${attempt}:`, error.message);
      if (attempt === retries) throw new Error(`Đăng nhập thất bại sau ${retries} lần.`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function getSchedule() {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await login(page, process.env.UT_USERNAME, process.env.UT_PASSWORD);

    await page.goto("https://portal.ut.edu.vn/calendar", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await page.waitForSelector(".MuiTable-root", { timeout: 30000 });
    console.log("✅ Đã tải trang lịch học.");

    const rawScheduleData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTable-root");
      if (!table) return { error: "Không tìm thấy bảng lịch học." };

      const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
        th.textContent.trim().replace(/\n/g, " - ")
      );
      const days = headers.slice(1); // Bỏ cột "Ca học"
      const schedule = {};

      days.forEach((day) => (schedule[day] = []));

      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        const shift = cells[0]?.textContent.trim();
        if (!shift || shift.includes("Sáng") || shift.includes("Chiều") || shift.includes("Tối")) return;

        for (let i = 1; i < cells.length; i++) {
          const day = days[i - 1];
          const cell = cells[i];
          const classBox = cell.querySelector(".MuiBox-root.css-415vdw");

          if (classBox) {
            const subject = classBox.querySelector(".css-eu5kgx")?.textContent.trim() || "Không rõ";
            const details = Array.from(classBox.querySelectorAll(".css-189xydx")).map((p) => p.textContent.trim());
            const periods = details[1]?.replace("Tiết: ", "") || "Không rõ";
            const time = details[2] || "Không rõ";
            const startTime = time.split(" - ")[0] || "Không rõ";
            const room = details[3]?.replace("Phòng: ", "") || "Không rõ";

            schedule[day].push({
              shift,
              subject,
              periods,
              startTime,
              room,
            });
          }
        }
      });

      return { schedule, week: days[0].split(" - ")[1] || "hiện tại" };
    });

    if (rawScheduleData.error) throw new Error(rawScheduleData.error);

    // Làm sạch dữ liệu sau khi lấy từ trang web
    const scheduleData = {
      schedule: {},
      week: cleanText(rawScheduleData.week),
    };
    for (const day in rawScheduleData.schedule) {
      scheduleData.schedule[day] = rawScheduleData.schedule[day].map((classInfo) => ({
        shift: cleanText(classInfo.shift),
        subject: cleanText(classInfo.subject),
        periods: cleanText(classInfo.periods),
        startTime: cleanText(classInfo.startTime),
        room: cleanText(classInfo.room),
      }));
    }

    console.log("✅ Đã lấy và làm sạch lịch học.");
    return scheduleData;
  } catch (error) {
    console.error("❌ Lỗi trong getSchedule:", error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { getSchedule };