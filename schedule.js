require("dotenv").config();

function cleanText(text) {
  const validPattern = /[A-Za-zÀ-ỹ0-9\s/:.\-₫]/; // Thêm ₫ để giữ đơn vị tiền
  return Array.from(text)
    .filter((char) => validPattern.test(char))
    .join("")
    .trim();
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

async function getSchedule(launchBrowser, nextWeek = false) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await login(page, process.env.UT_USERNAME, process.env.UT_PASSWORD);

    await page.goto("https://portal.ut.edu.vn/calendar", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("DEBUG: URL hiện tại sau khi goto calendar:", page.url());

    // Chờ bất kỳ phần tử nào có thể chứa lịch (table, div, hoặc FullCalendar)
    await page.waitForSelector("table, .fc, .calendar, div[data-date]", {
      timeout: 60000,
    });
    console.log("✅ Đã tải trang lịch học.");

    // Log nội dung trang để debug
    const pageContent = await page.content();
    console.log("DEBUG: Nội dung trang lịch (1000 ký tự đầu):", pageContent.slice(0, 1000));

    // Kiểm tra xem có FullCalendar không
    const hasFullCalendar = await page.evaluate(() => !!document.querySelector(".fc"));
    console.log("DEBUG: Có FullCalendar trên trang:", hasFullCalendar);

    const scheduleData = await page.evaluate((isNextWeek) => {
      let schedule = {};

      // Thử lấy từ FullCalendar
      const calendar = document.querySelector(".fc");
      if (calendar) {
        const weekElements = document.querySelectorAll(".fc-daygrid-day, .fc-multimonth-month");
        const targetWeek = isNextWeek && weekElements.length > 1 ? weekElements[1] : weekElements[0];
        if (!targetWeek) return { error: "Không tìm thấy tuần yêu cầu." };

        const events = targetWeek.querySelectorAll(".fc-daygrid-event, .fc-event");
        events.forEach((event) => {
          const titleEl = event.querySelector(".fc-event-title");
          const timeEl = event.querySelector(".fc-event-time");
          if (titleEl && timeEl) {
            const title = titleEl.textContent.trim();
            const time = timeEl.textContent.trim();
            const dateEl = event.closest(".fc-daygrid-day");
            const date = dateEl ? dateEl.getAttribute("data-date") || "Unknown Date" : "Unknown Date";

            if (!schedule[date]) schedule[date] = [];
            schedule[date].push({ time, title });
          }
        });
      } else {
        // Fallback: Thử lấy từ bảng hoặc div nếu không phải FullCalendar
        const events = document.querySelectorAll("div[data-date], tr, .event");
        events.forEach((event) => {
          const title = event.querySelector(".event-title, td:nth-child(2)")?.textContent.trim();
          const time = event.querySelector(".event-time, td:nth-child(1)")?.textContent.trim();
          const date = event.getAttribute("data-date") || event.querySelector("td")?.textContent.trim() || "Unknown Date";

          if (title && time) {
            if (!schedule[date]) schedule[date] = [];
            schedule[date].push({ time, title });
          }
        });
      }

      if (Object.keys(schedule).length === 0) {
        return { error: isNextWeek ? "Không có lịch tuần sau." : "Không có lịch tuần này." };
      }

      return schedule;
    }, nextWeek);

    if (scheduleData.error) throw new Error(scheduleData.error);

    console.log("✅ Đã lấy lịch học thành công.");
    return scheduleData;
  } catch (error) {
    console.error("❌ Lỗi trong getSchedule:", error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

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
    await page.waitForSelector(comboboxSelector, { timeout: 10000 });
    const currentValue = await page.$eval(comboboxSelector, (el) => el.textContent.trim());
    if (currentValue !== "Tất cả") {
      await page.click(comboboxSelector);
      await page.waitForSelector(".MuiMenu-list", { timeout: 10000 });
      await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll(".MuiMenuItem-root"));
        const allOption = options.find((opt) => opt.textContent.trim() === "Tất cả");
        if (allOption) allOption.click();
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log("✅ Đã chọn 'Tất cả' trong combobox.");
    } else {
      console.log("✅ Combobox đã ở trạng thái 'Tất cả'.");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("⏳ Đã đợi thêm để bảng tải hoàn toàn.");

    const tuitionData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTable-root");
      if (!table) return { error: "Không tìm thấy bảng công nợ." };

      const rows = table.querySelectorAll("tbody tr");
      if (rows.length === 0) return { error: "Không có dữ liệu trong bảng." };

      console.log(`DEBUG: Số dòng trong bảng: ${rows.length}`);
      rows.forEach((row, index) => {
        console.log(`DEBUG: Dòng ${index}: ${row.textContent.trim()}`);
      });

      const totalRow = Array.from(rows).slice(-1)[0];
      if (!totalRow || !totalRow.querySelector("td[colspan='4']")) {
        console.log("DEBUG: Không tìm thấy dòng 'Tổng' với colspan=4");
        return { error: "Không tìm thấy dòng tổng kết hợp lệ." };
      }

      const totalCells = totalRow.querySelectorAll("td");
      console.log(`DEBUG: Số cột trong dòng tổng: ${totalCells.length}`);
      console.log(`DEBUG: Nội dung dòng tổng: ${totalRow.textContent.trim()}`);

      const totalText = totalRow.textContent.trim();
      const numbers = totalText.match(/\d+(?:\.\d+)?/g) || [];
      console.log(`DEBUG: Các số tìm thấy trong dòng tổng: ${numbers}`);

      const totalCredits = numbers.length > 0 ? parseInt(numbers[0]) || 0 : 0;
      const totalTuition = numbers.length > 1 ? parseInt(numbers[1]) || 0 : 0;
      const totalDebt = numbers.length > 2 ? parseInt(numbers[numbers.length - 1]) || 0 : 0;

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

module.exports = { getSchedule, getTuition };
