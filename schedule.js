require("dotenv").config();
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteerExtra.use(StealthPlugin());

async function login(page, username, password) {
  try {
    await page.goto("https://portal.ut.edu.vn", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Log URL hiện tại để debug
    const currentUrl = page.url();
    console.log(`DEBUG: URL hiện tại sau khi goto: ${currentUrl}`);

    // Chờ selector #username hoặc timeout
    await page.waitForSelector("#username", { timeout: 10000 }).catch(async (err) => {
      console.error("❌ Không tìm thấy #username:", err.message);
      const pageContent = await page.content();
      console.log("DEBUG: Nội dung trang:", pageContent.slice(0, 500)); // Log 500 ký tự đầu
      throw new Error("Không tìm thấy trường nhập username trên trang đăng nhập.");
    });

    await page.type("#username", username);
    await page.type("#password", password);
    await page.click("#submitButton");

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
    console.log("✅ Đăng nhập thành công.");
  } catch (error) {
    console.error("❌ Lỗi trong login:", error.message);
    throw error;
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

async function getSchedule(launchBrowser, isNextWeek) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await login(page, process.env.UT_USERNAME, process.env.UT_PASSWORD);

    await page.goto("https://portal.ut.edu.vn/schedule", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    // Giả định logic lấy lịch học (thay bằng code thật của bạn)
    const schedule = await page.evaluate(() => {
      return { "Thứ 2": [{ time: "08:00-10:00", title: "Môn A" }] }; // Ví dụ
    });

    return schedule;
  } catch (error) {
    console.error("❌ Lỗi trong getSchedule:", error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  getSchedule,
  getTuition,
};
