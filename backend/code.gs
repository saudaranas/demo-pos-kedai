// ============================================
// POSKedai - Google Apps Script (GABUNGAN OPTIMAL)
// Features: Staff Isolation + All Fixes from Script 1
// ============================================

const ss = SpreadsheetApp.getActiveSpreadsheet();
const CACHE = CacheService.getScriptCache();
const CACHE_TTL = 60;

// ============================================
// MAIN HANDLER
// ============================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ success: false, error: "Request kosong atau tidak sah." });
    }

    let request;
    try {
      request = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return respond({ success: false, error: "Format request tidak sah (bukan JSON)." });
    }

    if (!verifyApiKey(request.apiKey)) {
      return respond({ success: false, error: "Unauthorized - API key salah." });
    }

    const { action, data = {} } = request;

    const actions = {
      'login':              () => loginStaff(data),
      'getMenu':            () => getMenu(),
      'addMenu':            () => addMenu(data),
      'updateMenu':         () => updateMenu(data),
      'deleteMenu':         () => deleteMenu(data),
      'createOrder':        () => createOrder(data),
      'saveOrder':          () => saveOrder(data),
      'completeOrder':      () => completeOrder(data),
      'getOrders':          () => getOrders(data),
      'updateOrder':        () => updateOrder(data),
      'cancelOrder':        () => cancelOrder(data),
      'getDailySales':      () => getDailySales(data),
      'getWeeklySales':     () => getWeeklySales(data),
      'getMonthlySales':    () => getMonthlySales(data),
      'getShopInfo':        () => getShopInfo(),
      'getTodayOrderCount': () => getTodayOrderCount(),
      'getStaffList':       () => getStaffList(),
      'addStaff':           () => addStaff(data),
      'deleteStaff':        () => deleteStaff(data),
      'saveSettings':       () => saveSettings(data),
      'getSettings':        () => getSettings(),
    };

    const handler = actions[action];
    if (!handler) {
      return respond({ success: false, error: "Action tidak dikenali: " + action });
    }
    return respond(handler());

  } catch (err) {
    console.error("doPost error:", err.toString());
    return respond({ success: false, error: "Server error: " + err.toString() });
  }
}

function doGet() {
  return respond({ success: true, message: "POSKedai API Running" });
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// HELPERS
// ============================================
function verifyApiKey(key) {
  const map = getConfigMap();
  return map.API_KEY === key;
}

function genId(prefix) {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

function myDate() {
  return Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyy-MM-dd");
}

function myTime() {
  return Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "HH:mm:ss");
}

function getRowDate(row, col) {
  try {
    const val = row[col];
    if (val instanceof Date) {
      return Utilities.formatDate(val, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
    }
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
      return val.substring(0, 10);
    }
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
      }
    }
    return '';
  } catch (e) {
    console.error("getRowDate error:", e, "val:", row[col]);
    return '';
  }
}

// ============================================
// CACHE HELPERS
// ============================================
function getCachedData(key, fetchFn) {
  const cached = CACHE.get(key);
  if (cached) {
    try { return JSON.parse(cached); }
    catch (e) { /* cache rosak, fetch semula */ }
  }
  const data = fetchFn();
  try {
    const str = JSON.stringify(data);
    if (str.length < 90000) {
      CACHE.put(key, str, CACHE_TTL);
    }
  } catch (e) {
    console.warn("Cache put error:", e);
  }
  return data;
}

function getConfigMap() {
  return getCachedData('config_data', () => {
    const sheet = ss.getSheetByName("Config");
    if (!sheet) return {};
    const rows = sheet.getDataRange().getValues();
    const map = {};
    rows.forEach(row => {
      if (row[0]) map[String(row[0]).trim()] = row[1];
    });
    return map;
  });
}

// ============================================
// LOGIN (UPDATED - Return PIN untuk reference)
// ============================================
function loginStaff(data) {
  if (!data || !data.pin) {
    return { success: false, error: "PIN diperlukan!" };
  }

  const sheet = ss.getSheetByName("Staff");
  if (!sheet) return { 
    success: true, 
    staff: { 
      name: "Admin", 
      role: "admin",
      pin: data.pin 
    } 
  };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.pin).trim()) {
      return {
        success: true,
        staff: { 
          name: rows[i][1], 
          role: rows[i][2] || "staff",
          pin: String(rows[i][0]) // ⬅️ IMPROVEMENT: Return PIN
        }
      };
    }
  }
  return { success: false, error: "PIN tidak sah!" };
}

// ============================================
// STAFF MANAGEMENT
// ============================================
function getStaffList() {
  return getCachedData('staff_data', () => {
    const sheet = ss.getSheetByName("Staff");
    if (!sheet) return { success: true, staffList: [] };
    const rows = sheet.getDataRange().getValues();
    const staffList = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0]) {
        staffList.push({
          pin:  String(rows[i][0]),
          name: rows[i][1],
          role: rows[i][2] || "staff"
        });
      }
    }
    return { success: true, staffList };
  });
}

function addStaff(data) {
  if (!data.pin || !data.name) {
    return { success: false, error: "PIN dan Nama diperlukan!" };
  }
  const sheet = ss.getSheetByName("Staff");
  if (!sheet) return { success: false, error: "Sheet Staff tidak dijumpai!" };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.pin)) {
      return { success: false, error: "PIN sudah digunakan!" };
    }
  }
  sheet.appendRow([String(data.pin), data.name, data.role || "staff"]);
  CACHE.remove('staff_data');
  return { success: true, message: "Staff '" + data.name + "' ditambah!" };
}

function deleteStaff(data) {
  if (!data.pin) return { success: false, error: "PIN diperlukan!" };
  const sheet = ss.getSheetByName("Staff");
  if (!sheet) return { success: false, error: "Sheet Staff tidak dijumpai!" };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.pin)) {
      sheet.deleteRow(i + 1);
      CACHE.remove('staff_data');
      return { success: true, message: "Staff dipadam!" };
    }
  }
  return { success: false, error: "Staff tidak dijumpai!" };
}

// ============================================
// SETTINGS
// ============================================
function getSettings() {
  const info = getConfigMap();
  return {
    success:     true,
    qrImage:     info.QR_IMAGE     || "",
    bankName:    info.BANK_NAME    || "",
    bankAccount: info.BANK_ACCOUNT || "",
    bankHolder:  info.BANK_HOLDER  || ""
  };
}

function saveSettings(data) {
  const sheet = ss.getSheetByName("Config");
  if (!sheet) return { success: false, error: "Sheet Config tidak dijumpai!" };

  const rows = sheet.getDataRange().getValues();
  const keysToUpdate = {};
  if (data.qrImage     !== undefined) keysToUpdate["QR_IMAGE"]     = data.qrImage;
  if (data.bankName    !== undefined) keysToUpdate["BANK_NAME"]    = data.bankName;
  if (data.bankAccount !== undefined) keysToUpdate["BANK_ACCOUNT"] = data.bankAccount;
  if (data.bankHolder  !== undefined) keysToUpdate["BANK_HOLDER"]  = data.bankHolder;

  for (const [key, value] of Object.entries(keysToUpdate)) {
    let found = false;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow([key, value]);
  }

  CACHE.remove('config_data');
  return { success: true, message: "Tetapan disimpan!" };
}

function getShopInfo() {
  const info = getConfigMap();
  return {
    success:      true,
    shopName:     info.SHOP_NAME    || "Kedai Makan",
    shopAddress:  info.SHOP_ADDRESS || "",
    shopPhone:    info.SHOP_PHONE   || "",
    brandColor:   info.BRAND_COLOR  || "#f97316",
    pakej:        info.PAKEJ        || "premium",
    qrImage:      info.QR_IMAGE     || "",
    bankName:     info.BANK_NAME    || "",
    bankAccount:  info.BANK_ACCOUNT || "",
    bankHolder:   info.BANK_HOLDER  || ""
  };
}

// ============================================
// MENU
// ============================================
function getMenu() {
  return getCachedData('menu_data', () => {
    const sheet = ss.getSheetByName("Menu");
    if (!sheet) return { success: false, error: "Sheet Menu tidak dijumpai!" };
    const rows = sheet.getDataRange().getValues();
    const menu = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][4] === "active") {
        menu.push({
          id:       rows[i][0],
          name:     rows[i][1],
          price:    parseFloat(rows[i][2]) || 0,
          category: rows[i][3] || "Lain-lain"
        });
      }
    }
    return { success: true, menu };
  });
}

function addMenu(data) {
  if (!data.name || data.price === undefined) {
    return { success: false, error: "Nama dan harga diperlukan!" };
  }
  const id = genId("M");
  const sheet = ss.getSheetByName("Menu");
  if (!sheet) return { success: false, error: "Sheet Menu tidak dijumpai!" };
  sheet.appendRow([id, data.name, parseFloat(data.price), data.category || "Lain-lain", "active"]);
  CACHE.remove('menu_data');
  return { success: true, message: "Menu '" + data.name + "' ditambah!", id };
}

function updateMenu(data) {
  const sheet = ss.getSheetByName("Menu");
  if (!sheet) return { success: false, error: "Sheet Menu tidak dijumpai!" };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      if (data.name)             sheet.getRange(i + 1, 2).setValue(data.name);
      if (data.price !== undefined) sheet.getRange(i + 1, 3).setValue(parseFloat(data.price));
      if (data.category)         sheet.getRange(i + 1, 4).setValue(data.category);
      CACHE.remove('menu_data');
      return { success: true, message: "Menu dikemaskini!" };
    }
  }
  return { success: false, error: "Menu tidak dijumpai!" };
}

function deleteMenu(data) {
  const sheet = ss.getSheetByName("Menu");
  if (!sheet) return { success: false, error: "Sheet Menu tidak dijumpai!" };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sheet.getRange(i + 1, 5).setValue("inactive");
      CACHE.remove('menu_data');
      return { success: true, message: "Menu dipadam!" };
    }
  }
  return { success: false, error: "Menu tidak dijumpai!" };
}

// ============================================
// ORDERS - Helper untuk kira order hari ini
// ============================================
function countTodayOrders(sheet, rows, todayStr) {
  let count = 0;
  for (let i = rows.length - 1; i >= 1; i--) {
    const d = getRowDate(rows[i], 1);
    if (d === todayStr) count++;
    else if (d < todayStr) break;
  }
  return count;
}

function createOrder(data) {
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) return { success: false, error: "Sheet Orders tidak dijumpai!" };

  const id       = genId("ORD");
  const todayStr = myDate();
  const time     = myTime();

  const lastRow = sheet.getLastRow();
  let rows = [];
  if (lastRow > 1) {
    rows = sheet.getDataRange().getValues();
  }
  const orderNo = countTodayOrders(sheet, rows, todayStr) + 1;

  let subtotal = 0;
  (data.items || []).forEach(item => { subtotal += (item.price || 0) * (item.qty || 1); });
  const discountAmt = parseFloat(data.discount) || 0;
  const total       = Math.max(0, subtotal - discountAmt);

  sheet.appendRow([
    id, todayStr, time,
    JSON.stringify(data.items || []),
    subtotal.toFixed(2),
    discountAmt.toFixed(2),
    total.toFixed(2),
    "completed",
    data.tableNo || "-",
    data.paymentMethod || "cash",
    data.staffName || "-",
    orderNo
  ]);

  return {
    success:  true,
    message:  "Order #" + orderNo + " berjaya!",
    orderId:  id,
    orderNo:  orderNo,
    total:    total.toFixed(2)
  };
}

function saveOrder(data) {
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) return { success: false, error: "Sheet Orders tidak dijumpai!" };

  const id       = genId("ORD");
  const todayStr = myDate();
  const time     = myTime();

  const lastRow = sheet.getLastRow();
  let rows = [];
  if (lastRow > 1) {
    rows = sheet.getDataRange().getValues();
  }
  const orderNo = countTodayOrders(sheet, rows, todayStr) + 1;

  let subtotal = 0;
  (data.items || []).forEach(item => { subtotal += (item.price || 0) * (item.qty || 1); });
  const discountAmt = parseFloat(data.discount) || 0;
  const total       = Math.max(0, subtotal - discountAmt);

  sheet.appendRow([
    id, todayStr, time,
    JSON.stringify(data.items || []),
    subtotal.toFixed(2),
    discountAmt.toFixed(2),
    total.toFixed(2),
    "pending",
    data.tableNo || "-",
    "-",
    data.staffName || "-",
    orderNo
  ]);

  return {
    success:  true,
    message:  "Pesanan #" + orderNo + " disimpan!",
    orderId:  id,
    orderNo:  orderNo,
    total:    total.toFixed(2)
  };
}

function completeOrder(data) {
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) return { success: false, error: "Sheet Orders tidak dijumpai!" };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      if (rows[i][7] !== "pending") {
        return { success: false, error: "Pesanan ini bukan pending!" };
      }
      sheet.getRange(i + 1, 8).setValue("completed");
      sheet.getRange(i + 1, 10).setValue(data.paymentMethod || "cash");

      let items = [];
      try { items = JSON.parse(rows[i][3]); } catch (e) {}

      const order = {
        orderId:       rows[i][0],
        date:          getRowDate(rows[i], 1),
        time:          String(rows[i][2]),
        items:         items,
        subtotal:      parseFloat(rows[i][4]) || 0,
        discount:      parseFloat(rows[i][5]) || 0,
        total:         parseFloat(rows[i][6]) || 0,
        tableNo:       rows[i][8] || "-",
        paymentMethod: data.paymentMethod || "cash",
        staffName:     rows[i][10] || "-",
        orderNo:       rows[i][11] || 0
      };
      return { success: true, message: "Pesanan #" + order.orderNo + " selesai!", order };
    }
  }
  return { success: false, error: "Pesanan tidak dijumpai!" };
}

// ============================================
// GET ORDERS (IMPROVEMENT - Staff Isolation)
// ============================================
function getOrders(data) {
  const target = data.date || myDate();
  const staffName = data.staffName;
  const staffRole = data.staffRole;
  
  const orders = getOrdersForDateRange(target, target);
  
  // ⬅️ IMPROVEMENT: Filter by staff role
  // Admin nampak semua, Staff biasa nampak order dia sahaja
  let filteredOrders = orders;
  if (staffRole !== "admin" && staffName) {
    filteredOrders = orders.filter(o => o.staffName === staffName);
  }
  
  filteredOrders.reverse(); // terbaru dulu
  return { 
    success: true, 
    orders: filteredOrders, 
    date: target,
    totalOrders: filteredOrders.length
  };
}

function updateOrder(data) {
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) return { success: false, error: "Sheet Orders tidak dijumpai!" };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      let subtotal = 0;
      (data.items || []).forEach(item => { subtotal += (item.price || 0) * (item.qty || 1); });
      const discount = parseFloat(data.discount) || parseFloat(rows[i][5]) || 0;
      const total    = Math.max(0, subtotal - discount);

      sheet.getRange(i + 1, 4).setValue(JSON.stringify(data.items || []));
      sheet.getRange(i + 1, 5).setValue(subtotal.toFixed(2));
      sheet.getRange(i + 1, 6).setValue(discount.toFixed(2));
      sheet.getRange(i + 1, 7).setValue(total.toFixed(2));
      if (data.tableNo)       sheet.getRange(i + 1, 9).setValue(data.tableNo);
      if (data.paymentMethod) sheet.getRange(i + 1, 10).setValue(data.paymentMethod);

      return { success: true, message: "Order dikemaskini!", total: total.toFixed(2) };
    }
  }
  return { success: false, error: "Order tidak dijumpai!" };
}

function cancelOrder(data) {
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) return { success: false, error: "Sheet Orders tidak dijumpai!" };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      sheet.getRange(i + 1, 8).setValue("cancelled");
      return { success: true, message: "Order dibatalkan!" };
    }
  }
  return { success: false, error: "Order tidak dijumpai!" };
}

function getTodayOrderCount() {
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) return { success: true, count: 0 };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, count: 0 };

  const rows     = sheet.getDataRange().getValues();
  const todayStr = myDate();
  return { success: true, count: countTodayOrders(sheet, rows, todayStr) };
}

function getOrdersForDateRange(startDate, endDate) {
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const MAX_ROWS = 2000;
  const startRow = Math.max(2, lastRow - MAX_ROWS + 1);
  const numRows  = lastRow - startRow + 1;

  const rows = sheet.getRange(startRow, 1, numRows, 12).getValues();

  const orders = [];
  for (let i = 0; i < rows.length; i++) {
    const d = getRowDate(rows[i], 1);
    if (!d) continue;
    if (d >= startDate && d <= endDate) {
      let items = [];
      try { items = JSON.parse(rows[i][3]); } catch (e) {}
      orders.push({
        orderId:       rows[i][0],
        date:          d,
        month:         d.substring(0, 7),
        time:          String(rows[i][2]),
        hour:          String(rows[i][2]).substring(0, 2),
        items:         items,
        subtotal:      parseFloat(rows[i][4]) || 0,
        discount:      parseFloat(rows[i][5]) || 0,
        total:         parseFloat(rows[i][6]) || 0,
        status:        rows[i][7],
        tableNo:       rows[i][8]  || "-",
        paymentMethod: rows[i][9]  || "cash",
        staffName:     rows[i][10] || "-",
        orderNo:       rows[i][11] || 0
      });
    }
  }
  return orders;
}

// ============================================
// SALES - Helper aggregate satu hari
// ============================================
function aggregateDay(orders, targetDate) {
  let totalSales = 0, totalOrders = 0, cancelled = 0, pending = 0;
  let totalDiscount = 0, pendingAmount = 0;
  const items    = {};
  const payments = { cash: 0, qr: 0, transfer: 0, cashCount: 0, qrCount: 0, transferCount: 0 };
  const hourly   = {};

  orders.forEach(o => {
    if (o.date !== targetDate) return;

    if (o.status === "completed") {
      totalSales    += o.total;
      totalOrders++;
      totalDiscount += o.discount;

      const pm = o.paymentMethod || "cash";
      if (payments[pm] !== undefined) payments[pm] += o.total;
      if (pm === "cash")     payments.cashCount++;
      else if (pm === "qr")  payments.qrCount++;
      else if (pm === "transfer") payments.transferCount++;

      const hr = o.hour || "00";
      hourly[hr] = (hourly[hr] || 0) + o.total;

      o.items.forEach(item => {
        if (items[item.name]) {
          items[item.name].qty     += item.qty;
          items[item.name].revenue += item.price * item.qty;
        } else {
          items[item.name] = { qty: item.qty, revenue: item.price * item.qty };
        }
      });
    } else if (o.status === "cancelled") {
      cancelled++;
    } else if (o.status === "pending") {
      pending++;
      pendingAmount += o.total;
    }
  });

  const topItems = Object.entries(items)
    .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
    .sort((a, b) => b.qty - a.qty);

  return {
    totalSales, totalOrders, cancelled, pending, pendingAmount,
    totalDiscount, topItems, payments, hourly,
    averageOrder: totalOrders > 0 ? totalSales / totalOrders : 0
  };
}

// ============================================
// SALES REPORTS
// ============================================
function getDailySales(data) {
  const target   = data.date || myDate();
  const prevDate = new Date(target + "T00:00:00");
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = Utilities.formatDate(prevDate, "Asia/Kuala_Lumpur", "yyyy-MM-dd");

  const orders     = getOrdersForDateRange(prevDateStr, target);
  const result     = aggregateDay(orders, target);
  const prevResult = aggregateDay(orders, prevDateStr);

  return {
    success:        true,
    date:           target,
    totalSales:     result.totalSales.toFixed(2),
    totalOrders:    result.totalOrders,
    cancelledOrders: result.cancelled,
    pendingOrders:  result.pending,
    pendingAmount:  result.pendingAmount.toFixed(2),
    totalDiscount:  result.totalDiscount.toFixed(2),
    averageOrder:   result.averageOrder.toFixed(2),
    topItems:       result.topItems,
    paymentBreakdown: {
      cash:          result.payments.cash,
      qr:            result.payments.qr,
      transfer:      result.payments.transfer,
      cashCount:     result.payments.cashCount,
      qrCount:       result.payments.qrCount,
      transferCount: result.payments.transferCount
    },
    hourlyData: result.hourly,
    previousDay: {
      totalSales:   prevResult.totalSales,
      totalOrders:  prevResult.totalOrders,
      averageOrder: prevResult.averageOrder
    }
  };
}

function getWeeklySales(data) {
  const days = [], prevDays = [];
  for (let d = 13; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const ds = Utilities.formatDate(date, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
    if (d <= 6) days.push(ds);
    else prevDays.push(ds);
  }

  const allOrders = getOrdersForDateRange(prevDays[0], days[days.length - 1]);
  const dailyData = {};
  days.forEach(d => { dailyData[d] = { sales: 0, orders: 0 }; });

  let totalWeek = 0, totalOrders = 0, prevTotal = 0, prevOrders = 0;
  const items    = {};
  const payments = { cash: 0, qr: 0, transfer: 0, cashCount: 0, qrCount: 0, transferCount: 0 };

  allOrders.forEach(o => {
    if (o.status !== "completed") return;

    if (dailyData[o.date] !== undefined) {
      dailyData[o.date].sales  += o.total;
      dailyData[o.date].orders++;
      totalWeek += o.total;
      totalOrders++;

      const pm = o.paymentMethod || "cash";
      if (payments[pm] !== undefined) payments[pm] += o.total;
      if (pm === "cash")     payments.cashCount++;
      else if (pm === "qr")  payments.qrCount++;
      else if (pm === "transfer") payments.transferCount++;

      o.items.forEach(item => {
        if (items[item.name]) {
          items[item.name].qty     += item.qty;
          items[item.name].revenue += item.price * item.qty;
        } else {
          items[item.name] = { qty: item.qty, revenue: item.price * item.qty };
        }
      });
    }

    if (prevDays.includes(o.date)) {
      prevTotal += o.total;
      prevOrders++;
    }
  });

  const topItems = Object.entries(items)
    .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return {
    success:        true,
    weeklyTotal:    totalWeek.toFixed(2),
    totalOrders,
    dailyData,
    days,
    topItems,
    paymentBreakdown: payments,
    previousWeek: { total: prevTotal, orders: prevOrders }
  };
}

function getMonthlySales(data) {
  const targetMonth = data.month || Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyy-MM");
  const parts  = targetMonth.split("-");
  const year   = parseInt(parts[0]);
  const month  = parseInt(parts[1]);

  const prevDate  = new Date(year, month - 2, 1);
  const prevMonth = Utilities.formatDate(prevDate, "Asia/Kuala_Lumpur", "yyyy-MM");
  const startDate = prevMonth + "-01";
  const lastDay   = new Date(year, month, 0).getDate();
  const endDate   = targetMonth + "-" + String(lastDay).padStart(2, '0');

  const allOrders = getOrdersForDateRange(startDate, endDate);

  let totalMonth = 0, totalOrders = 0, totalDiscount = 0;
  let prevTotalMonth = 0, prevTotalOrders = 0;
  const items     = {};
  const dailyData = {};
  const payments  = { cash: 0, qr: 0, transfer: 0, cashCount: 0, qrCount: 0, transferCount: 0 };

  allOrders.forEach(o => {
    if (o.status !== "completed") return;

    if (o.month === targetMonth) {
      totalMonth    += o.total;
      totalOrders++;
      totalDiscount += o.discount;

      const pm = o.paymentMethod || "cash";
      if (payments[pm] !== undefined) payments[pm] += o.total;
      if (pm === "cash")     payments.cashCount++;
      else if (pm === "qr")  payments.qrCount++;
      else if (pm === "transfer") payments.transferCount++;

      if (!dailyData[o.date]) dailyData[o.date] = { sales: 0, orders: 0 };
      dailyData[o.date].sales  += o.total;
      dailyData[o.date].orders++;

      o.items.forEach(item => {
        if (items[item.name]) {
          items[item.name].qty     += item.qty;
          items[item.name].revenue += item.price * item.qty;
        } else {
          items[item.name] = { qty: item.qty, revenue: item.price * item.qty };
        }
      });
    }

    if (o.month === prevMonth) {
      prevTotalMonth += o.total;
      prevTotalOrders++;
    }
  });

  const topItems = Object.entries(items)
    .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  return {
    success:       true,
    month:         targetMonth,
    totalSales:    totalMonth.toFixed(2),
    totalOrders,
    totalDiscount: totalDiscount.toFixed(2),
    averageOrder:  totalOrders > 0 ? (totalMonth / totalOrders).toFixed(2) : "0.00",
    topItems,
    dailyData,
    paymentBreakdown: payments,
    previousMonth: { totalSales: prevTotalMonth, totalOrders: prevTotalOrders }
  };
}

// ============================================
// TEST FUNCTION
// ============================================
function testLogin() {
  const result = loginStaff({ pin: "9640" });
  Logger.log(JSON.stringify(result));
}
