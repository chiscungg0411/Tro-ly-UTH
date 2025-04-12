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

    // Chờ bảng lịch học
    await page.waitForSelector(".MuiTable-root", { timeout: 60000 });
    console.log("✅ Đã tải trang lịch học.");

    // Log nội dung trang để debug
    const pageContent = await page.content();
    console.log("DEBUG: Nội dung trang lịch (1000 ký tự đầu):", pageContent.slice(0, 1000));

    // Chuyển sang tuần sau nếu cần
    if (nextWeek) {
      await page
        .click('button[aria-label*="ArrowForwardIcon"], button:has(svg[data-testid="ArrowForwardIcon"])', {
          timeout: 5000,
        })
        .catch(() => {
          console.log("DEBUG: Không tìm thấy nút chuyển tuần, bỏ qua.");
        });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("✅ Đã chuyển sang tuần sau (hoặc thử chuyển).");
      // Đợi bảng tải lại
      await page.waitForSelector(".MuiTable-root", { timeout: 60000 });
    }

    const scheduleData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTable-root");
      if (!table) return { error: "Không tìm thấy bảng lịch học." };

      const headers = table.querySelectorAll("thead th");
      const days = Array.from(headers)
        .slice(2) // Bỏ 2 cột đầu ("Ca học")
        .map((th) => {
          const text = th.textContent.trim();
          const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
          return dateMatch ? dateMatch[0] : "Unknown Date";
        });

      const schedule = {};
      const rows = table.querySelectorAll("tbody tr");

      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) return; // Bỏ qua hàng không có dữ liệu

        const shift = cells[0].textContent.trim(); // "Ca 1", "Ca 2", ...
        if (shift.includes("Sáng") || shift.includes("Chiều") || shift.includes("Tối")) return; // Bỏ hàng tiêu đề ca

        cells.forEach((cell, index) => {
          if (index < 2) return; // Bỏ 2 cột đầu ("Ca học", "Ca X")
          const day = days[index - 2];
          if (!day || day === "Unknown Date") return;

          const eventBox = cell.querySelector(".MuiBox-root.css-415vdw");
          if (eventBox) {
            const title = eventBox.querySelector("p.css-eu5kgx")?.textContent.trim() || "Không có tên môn";
            const timeEl = eventBox.querySelector("p.css-189xydx:has(img[src*='clock-desk'])");
            const time = timeEl ? timeEl.textContent.trim() : "Không rõ thời gian";
            const roomEl = eventBox.querySelector("p.css-189xydx:has(img[src*='door-closed'])");
            const room = roomEl ? roomEl.textContent.trim() : "Không rõ phòng";

            if (!schedule[day]) schedule[day] = [];
            schedule[day].push({ time, title, room });
          }
        });
      });

      if (Object.keys(schedule).length === 0) {
        return { error: nextWeek ? "Không có lịch tuần sau." : "Không có lịch tuần này." };
      }

      return schedule;
    });

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
    const currentValue = await page.$eval(comboboxSelector, (el) => el.textContent.trim());
    if (currentValue !== "Tất cả") {
      await page.click(comboboxSelector);
      await page.waitForSelector(".MuiMenu-list", { timeout: 10000 });
      await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll(".MuiMenuItem-root"));
        const allOption = options.find((opt) => opt.textContent.trim() === "Tất cả");
        if (allOption) allOption.click();
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("✅ Đã chọn 'Tất cả' trong combobox.");
    } else {
      console.log("✅ Combobox đã ở trạng thái 'Tất cả'.");
    }

    const tuitionData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTable-root");
      if (!table) return { error: "Không tìm thấy bảng công nợ." };

      const rows = table.querySelectorAll("tbody tr");
      if (rows.length === 0) return { error: "Không có dữ liệu trong bảng." };

      // Lấy dòng "Tổng" (dòng cuối cùng)
      const totalRow = Array.from(rows).find((row) => row.textContent.includes("Tổng"));
      if (!totalRow) return { error: "Không tìm thấy dòng tổng kết." };

      const totalCells = totalRow.querySelectorAll("td");
      console.log(`DEBUG: Số cột trong dòng tổng: ${totalCells.length}`);

      // Lấy dữ liệu với kiểm tra an toàn
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

module.exports = { getSchedule, getTuition };
