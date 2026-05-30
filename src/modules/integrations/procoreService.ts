const wait = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
const stub = async (entity) => {
  await wait();
  return { entity, syncStatus: "PENDING", rows: [], syncedAt: new Date().toISOString() };
};

export async function syncProjects() { return stub("projects"); }
export async function syncDrawings() { return stub("drawings"); }
export async function syncRFIs() { return stub("rfis"); }
export async function syncSubmittals() { return stub("submittals"); }
export async function getProjectById(id) { return { id, procoreProjectId: id, syncStatus: "PENDING" }; }
export async function getDrawingLinks(projectId) { return { projectId, links: [] }; }
export async function getRFIStatus(projectId) { return { projectId, open: 0, overdue: 0 }; }
