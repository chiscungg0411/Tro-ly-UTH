// schedule.js
function cleanText(text) {
  const validPattern = /[A-Za-zÀ-ỹ0-9\s/:.\-₫]/; // Thêm ₫ để giữ đơn vị tiền
  return Array.from(text)
    .filter(char => validPattern.test(char))
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

    await page.goto("https://portal.ut.edu.vn/schedule", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await page.waitForSelector("#schedule-grid", { timeout: 30000 });
    console.log("✅ Đã tải trang lịch học.");

    const weekOptions = await page.$$eval(".fc-multimonth-title", (elements) =>
      elements.map((el) => el.textContent.trim())
    );
    const currentWeekIndex = nextWeek ? 1 : 0;

    if (weekOptions.length <= currentWeekIndex) {
      throw new Error("Không có lịch tuần sau để lấy.");
    }

    if (nextWeek) {
      await page.click(".fc-next-button");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Thay waitForTimeout
      console.log("✅ Đã chuyển sang tuần sau.");
    }

    const scheduleData = await page.evaluate((weekIndex) => {
      const weekElements = document.querySelectorAll(".fc-multimonth-month");
      const targetWeek = weekElements[weekIndex];
      if (!targetWeek) return { error: "Không tìm thấy tuần yêu cầu." };

      const events = targetWeek.querySelectorAll(".fc-daygrid-event");
      const schedule = {};

      events.forEach((event) => {
        const titleEl = event.querySelector(".fc-event-title");
        const timeEl = event.querySelector(".fc-event-time");
        if (titleEl && timeEl) {
          const title = titleEl.textContent.trim();
          const time = timeEl.textContent.trim();
          const dateEl = event.closest(".fc-daygrid-day");
          const date = dateEl ? dateEl.getAttribute("data-date") : "Unknown Date";

          if (!schedule[date]) schedule[date] = [];
          schedule[date].push({ time, title });
        }
      });

      return schedule;
    }, currentWeekIndex);

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

    // Kiểm tra và chọn "Tất cả" trong combobox
    const comboboxSelector = ".MuiSelect-select.MuiSelect-outlined";
    const currentValue = await page.$eval(comboboxSelector, el => el.textContent.trim());
    if (currentValue !== "Tất cả") {
      await page.click(comboboxSelector);
      await page.waitForSelector(".MuiMenu-list", { timeout: 10000 });
      await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll(".MuiMenuItem-root"));
        const allOption = options.find(opt => opt.textContent.trim() === "Tất cả");
        if (allOption) allOption.click();
      });
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Thay waitForTimeout
      console.log("✅ Đã chọn 'Tất cả' trong combobox.");
    } else {
      console.log("✅ Combobox đã ở trạng thái 'Tất cả'.");
    }

    const tuitionData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTable-root");
      if (!table) return { error: "Không tìm thấy bảng công nợ." };

      const rows = table.querySelectorAll("tbody tr");
      let totalCredits = 0;
      let totalTuition = 0;

      rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length > 5) { // Đảm bảo là dòng dữ liệu, không phải dòng tổng
          const credits = parseInt(cells[4].textContent.trim()) || 0; // Cột "TC"
          const tuitionText = cells[5].textContent.trim().replace(/[^0-9]/g, ""); // Cột "Học phí"
          const tuition = parseInt(tuitionText) || 0;

          totalCredits += credits;
          totalTuition += tuition;
        }
      });

      // Lấy dòng tổng (nếu có)
      const totalRow = Array.from(rows).find(row => row.textContent.includes("Tổng"));
      if (totalRow) {
        const totalCells = totalRow.querySelectorAll("td");
        totalCredits = parseInt(totalCells[4].textContent.trim()) || totalCredits; // Cột "TC" tổng
        const totalTuitionText = totalCells[5].textContent.trim().replace(/[^0-9]/g, ""); // Cột "Học phí" tổng
        totalTuition = parseInt(totalTuitionText) || totalTuition;
      }

      return { totalCredits, totalTuition };
    });

    if (tuitionData.error) throw new Error(tuitionData.error);

    console.log("✅ Đã lấy thông tin công nợ thành công.");
    return {
      totalCredits: tuitionData.totalCredits,
      totalTuition: tuitionData.totalTuition.toLocaleString("vi-VN") + " ₫" // Định dạng tiền VNĐ
    };
  } catch (error) {
    console.error("❌ Lỗi trong getTuition:", error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { getSchedule, getTuition };
