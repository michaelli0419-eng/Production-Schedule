const wait = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
const stub = async (entity) => {
  await wait();
  return { entity, syncStatus: "PENDING", rows: [], syncedAt: new Date().toISOString() };
};

export async function syncCustomers() { return stub("customers"); }
export async function syncItems() { return stub("items"); }
export async function syncSalesOrders() { return stub("sales_orders"); }
export async function syncInventory() { return stub("inventory"); }
export async function syncPurchaseOrders() { return stub("purchase_orders"); }
export async function getCustomerById(id) { return { id, netsuiteCustomerId: id, syncStatus: "PENDING" }; }
export async function getItemById(id) { return { id, netsuiteItemId: id, syncStatus: "PENDING" }; }
export async function getSalesOrderById(id) { return { id, netsuiteSalesOrderId: id, syncStatus: "PENDING" }; }
